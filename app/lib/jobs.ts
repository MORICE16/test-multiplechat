import { env } from "cloudflare:workers";
import { now } from "./runtime";
import { createWebResponse, retrieveWebResponse } from "./web-search";
import { webResult } from "./web-result";

export type Job = { id: string; user_id: string; title: string; request: string; operation: string; status: string; response_id: string; result: string; evidence: string; error: string; created_at: string; updated_at: string };

export async function createJob(uid: string, title: string, request: string, operation: string) {
  const id = crypto.randomUUID(); const date = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_jobs(id,user_id,title,request,operation,status,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?)").bind(id, uid, title, request, operation, date, date),
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) VALUES(?,?,'queued','Demande enregistrée',?)").bind(id, uid, date),
  ]);
  return id;
}
export async function transitionJob(uid: string, id: string, status: "running" | "done" | "blocked", detail: string, result = "", evidence: object = {}) {
  const date = now();
  await env.DB.batch([
    // A delayed provider acknowledgement or stale timeout must never reopen a
    // terminal job, erase its result or create an event for a different owner.
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) SELECT id,user_id,?,?,? FROM morice_jobs WHERE id=? AND user_id=? AND status IN ('queued','submitting','running') AND status<>?").bind(status, detail, date, id, uid, status),
    env.DB.prepare("UPDATE morice_jobs SET status=?,result=?,evidence=?,error=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('queued','submitting','running') AND status<>?").bind(status, result, JSON.stringify(evidence), status === "blocked" ? detail : "", date, id, uid, status),
  ]);
}
async function completeResearch(uid: string, id: string, result: ReturnType<typeof webResult>) {
  // D1 batches are transactional: keep result, history and conversation together.
  // The active-state checks also make concurrent retrievals idempotent.
  const date = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) SELECT id,user_id,'done','Recherche Web terminée; sources et résultat conservés',? FROM morice_jobs WHERE id=? AND user_id=? AND status IN ('running','submitting')").bind(date, id, uid),
    env.DB.prepare("UPDATE morice_messages SET text=?,action=? WHERE user_id=? AND role='assistant' AND json_valid(action) AND json_extract(action,'$.jobId')=? AND EXISTS (SELECT 1 FROM morice_jobs WHERE id=? AND user_id=? AND status IN ('running','submitting'))")
      .bind(result.text, JSON.stringify({ id, jobId: id, kind: "result", title: "Recherche terminée", content: result.text, status: "done", label: "Recherche Web terminée", view: "jobs", ...result, text: undefined }), uid, id, id, uid),
    env.DB.prepare("UPDATE morice_jobs SET status='done',result=?,evidence=?,error='',updated_at=? WHERE id=? AND user_id=? AND status IN ('running','submitting')")
      .bind(result.text, JSON.stringify(result), date, id, uid),
  ]);
}
export async function startResearch(uid: string, id: string, query: string) {
  // Claim before sending: an interrupted submission must never start a second paid request automatically.
  const claimed = await env.DB.prepare("UPDATE morice_jobs SET status='submitting',updated_at=? WHERE id=? AND user_id=? AND status='queued'").bind(now(), id, uid).run();
  if (!claimed.meta.changes) return;
  try {
    const response = await createWebResponse(query, true, id);
    if (!response.id || !/^resp_[a-zA-Z0-9_-]+$/.test(response.id)) throw new Error("La recherche n’a pas fourni d’identifiant de suivi.");
    await env.DB.prepare("UPDATE morice_jobs SET response_id=?,updated_at=? WHERE id=? AND user_id=?").bind(response.id, now(), id, uid).run();
    if (response.status === "completed") {
      const result = webResult(response);
      // If saving fails after the provider finished, retain its ID for reconciliation.
      try { await completeResearch(uid, id, result); }
      catch { await env.DB.prepare("UPDATE morice_jobs SET error=? WHERE id=? AND user_id=?").bind("Résultat reçu; enregistrement à reprendre à la prochaine synchronisation.", id, uid).run(); }
    }
    else if (["queued", "in_progress"].includes(response.status || "")) await transitionJob(uid, id, "running", "Recherche acceptée par OpenAI; exécution en arrière-plan", "", { responseId: response.id, tool: "OpenAI · recherche Web" });
    else throw new Error("Le moteur n’a pas accepté cette recherche.");
  } catch (error) {
    await transitionJob(uid, id, "blocked", `${error instanceof Error ? error.message : "Soumission interrompue."} La demande est conservée. Aucun renvoi automatique.`);
  }
}
export async function refreshResearch(uid: string) {
  // Reconcile the remote response only. This endpoint never submits a new search or repeats an external write.
  const jobs = await env.DB.prepare("SELECT * FROM morice_jobs WHERE user_id=? AND status IN ('queued','running','submitting') ORDER BY created_at LIMIT 6").bind(uid).all<Job>();
  for (const job of jobs.results) {
    if (job.status === "queued" && job.operation === "web_search") { await startResearch(uid, job.id, job.request); continue; }
    if (job.operation !== "web_search") {
      if (Date.now() - Date.parse(job.updated_at) > 120_000) await transitionJob(uid, job.id, "blocked", "La lecture a été interrompue. Aucun résultat confirmé n’a été enregistré.");
      continue;
    }
    if (!job.response_id) {
      if (Date.now() - Date.parse(job.updated_at) > 120_000) await transitionJob(uid, job.id, "blocked", "Soumission interrompue avant réception de l’identifiant. Résultat à vérifier; aucun renvoi automatique.");
      continue;
    }
    try {
      const response = await retrieveWebResponse(job.response_id);
      if (response.status === "completed") {
        let result: ReturnType<typeof webResult>;
        try { result = webResult(response); }
        catch (error) { await transitionJob(uid, job.id, "blocked", error instanceof Error ? error.message : "Résultat incomplet."); continue; }
        // Database failures are retried as reads, without marking a valid result failed.
        await completeResearch(uid, job.id, result);
      }
      else if (!["queued", "in_progress"].includes(response.status || "")) await transitionJob(uid, job.id, "blocked", "La recherche s’est arrêtée sans résultat complet. Demande conservée.");
    } catch (error) {
      // Keep the response ID for a later read-only reconciliation, including after reconnecting.
      await env.DB.prepare("UPDATE morice_jobs SET error=? WHERE id=? AND user_id=? AND status IN ('running','submitting')").bind("Résultat momentanément inaccessible. Une prochaine lecture reprendra la récupération sans relancer la recherche.", job.id, uid).run();
    }
  }
}
