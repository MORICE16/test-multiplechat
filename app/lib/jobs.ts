import { env } from "cloudflare:workers";
import { now } from "./runtime";
import { createWebResponse, retrieveWebResponse } from "./web-search";
import { type ModelResponse, webResult } from "./web-result";

export type Job = { id: string; user_id: string; title: string; request: string; operation: string; status: string; response_id: string; result: string; evidence: string; error: string; created_at: string; updated_at: string };

export async function createJob(uid: string, title: string, request: string, operation: string) {
  const id = crypto.randomUUID(); const date = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_jobs(id,user_id,title,request,operation,status,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?)").bind(id, uid, title, request, operation, date, date),
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) VALUES(?,?,'queued','Demande enregistrée',?)").bind(id, uid, date),
  ]);
  return id;
}
export async function transitionJob(uid: string, id: string, status: string, detail: string, result = "", evidence: object = {}) {
  const date = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE morice_jobs SET status=?,result=?,evidence=?,error=?,updated_at=? WHERE id=? AND user_id=?").bind(status, result, JSON.stringify(evidence), status === "blocked" ? detail : "", date, id, uid),
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) VALUES(?,?,?,?,?)").bind(id, uid, status, detail, date),
  ]);
}
async function completeResearch(uid: string, id: string, response: ModelResponse) {
  const result = webResult(response);
  const updated = await env.DB.prepare("UPDATE morice_jobs SET status='done',result=?,evidence=?,error='',updated_at=? WHERE id=? AND user_id=? AND status IN ('running','submitting')")
    .bind(result.text, JSON.stringify(result), now(), id, uid).run();
  if (!updated.meta.changes) return;
  await env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) VALUES(?,?,'done','Recherche Web terminée; sources et résultat conservés',?)").bind(id, uid, now()).run();
  // Update the existing response rather than creating duplicate completion messages.
  await env.DB.prepare("UPDATE morice_messages SET text=?,action=? WHERE user_id=? AND role='assistant' AND json_valid(action) AND json_extract(action,'$.jobId')=?")
    .bind(result.text, JSON.stringify({ id, jobId: id, kind: "result", title: "Recherche terminée", content: result.text, status: "done", label: "Recherche Web terminée", view: "jobs", ...result, text: undefined }), uid, id).run();
}
export async function startResearch(uid: string, id: string, query: string) {
  // Claim before sending: an interrupted submission must never start a second paid request automatically.
  const claimed = await env.DB.prepare("UPDATE morice_jobs SET status='submitting',updated_at=? WHERE id=? AND user_id=? AND status='queued'").bind(now(), id, uid).run();
  if (!claimed.meta.changes) return;
  try {
    const response = await createWebResponse(query, true, id);
    if (!response.id || !/^resp_[a-zA-Z0-9_-]+$/.test(response.id)) throw new Error("La recherche n’a pas fourni d’identifiant de suivi.");
    await env.DB.prepare("UPDATE morice_jobs SET response_id=?,updated_at=? WHERE id=? AND user_id=?").bind(response.id, now(), id, uid).run();
    if (response.status === "completed") await completeResearch(uid, id, response);
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
        try { await completeResearch(uid, job.id, response); }
        catch (error) { await transitionJob(uid, job.id, "blocked", error instanceof Error ? error.message : "Résultat incomplet."); }
      }
      else if (!["queued", "in_progress"].includes(response.status || "")) await transitionJob(uid, job.id, "blocked", "La recherche s’est arrêtée sans résultat complet. Demande conservée.");
    } catch (error) {
      // Keep the response ID for a later read-only reconciliation, including after reconnecting.
      await env.DB.prepare("UPDATE morice_jobs SET error=? WHERE id=? AND user_id=?").bind(error instanceof Error ? error.message : "Résultat momentanément inaccessible.", job.id, uid).run();
    }
  }
}
