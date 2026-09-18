"use client";
import { useEffect, useRef, useState } from "react";
import { ResultText } from "./result-text";
import { ResponsePlayer } from "./response-player";
import { type Citation } from "../lib/web-result";

type JobView = { id: string; title: string; request: string; operation: string; status: string; result: string; error: string; updated_at: string; evidence: { citations?: Citation[]; checkedAt?: string; tool?: string; responseId?: string } };
type QueueData = { jobs: JobView[]; events: { job_id: string; status: string; detail: string; created_at: string }[] };
const groups = [["queued", "À faire"], ["running", "En cours"], ["approval", "En attente de validation"], ["blocked", "Bloqué"], ["done", "Terminé"]];

export function useJobs(onCompleted: () => void) {
  const [data, setData] = useState<QueueData>({ jobs: [], events: [] });
  const [error, setError] = useState("");
  const callback = useRef(onCompleted);
  useEffect(() => { callback.current = onCompleted; }, [onCompleted]);
  const working = useRef(false);
  const lastDone = useRef("");
  async function refresh() {
    if (working.current) return;
    working.current = true;
    try {
      const response = await fetch("/api/jobs", { method: "POST" });
      if (!response.ok) throw new Error("Le suivi des travaux est momentanément indisponible.");
      const next = await response.json() as QueueData;
      const done = next.jobs.filter(j => j.status === "done").map(j => j.id).join(",");
      if (done !== lastDone.current) { lastDone.current = done; callback.current(); }
      setData(next); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Suivi indisponible."); }
    finally { working.current = false; }
  }
  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => { clearTimeout(timeout); clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, []);
  return { data, error, refresh };
}

export function JobsPanel({ queue, waiting, tasks, onTasks, onApprovals }: { queue: ReturnType<typeof useJobs>; waiting: number; tasks: { id: string; title: string; content: string; status: string }[]; onTasks: () => void; onApprovals: () => void }) {
  return <section className="panel"><p className="eyebrow">EXÉCUTION ET RÉSULTATS</p><h2>Travaux Morice</h2>
    <p>Les recherches acceptées continuent chez le moteur même si vous quittez cette page. Morice récupère et sauvegarde leur résultat à l’ouverture et toutes les 15 secondes pendant la consultation. L’exécution planifiée de nuit et les rappels restent à raccorder.</p>
    <button onClick={() => void queue.refresh()}>Actualiser les travaux</button>{queue.error && <p role="alert">{queue.error}</p>}
    <div className="job-groups">{groups.map(([status, label]) => {
      const jobs = queue.data.jobs.filter(j => (j.status === "submitting" ? "running" : j.status) === status);
      const notes = tasks.filter(t => (status === "queued" && t.status === "open") || (status === "done" && t.status === "done"));
      return <section key={status} className="job-group"><h3>{label} · {jobs.length + notes.length + (status === "approval" ? waiting : 0)}</h3>
        {status === "approval" && waiting > 0 && <button onClick={onApprovals}>Examiner {waiting} action(s) à valider</button>}
        {!jobs.length && !notes.length && !(status === "approval" && waiting) && <p>Aucun travail.</p>}
        {notes.map(task => <article className="job-card" key={task.id}><h4>{task.title}</h4><p>{task.content}</p><small>Tâche de suivi · {task.status === "done" ? "Marquée terminée" : "Exécution manuelle"}</small><button className="secondary" onClick={onTasks}>Ouvrir les tâches</button></article>)}
        {jobs.map(job => <article className="job-card" key={job.id}><h4>{job.title}</h4><p>{job.request}</p>
          <small>{job.evidence.tool || job.operation} · {new Date(job.updated_at).toLocaleString("fr-FR")}</small>
          {job.error && <p role="status">{job.error}</p>}
          {job.result && <><ResultText text={job.result} citations={job.evidence.citations} /><ResponsePlayer text={job.result.replace(/[^]*/g, "")} /></>}
          <details><summary>Historique et preuve</summary><p>Référence Morice : {job.id}</p>{job.evidence.responseId && <p>Référence du moteur : {job.evidence.responseId}</p>}{job.evidence.checkedAt && <p>Résultat reçu le {new Date(job.evidence.checkedAt).toLocaleString("fr-FR")}</p>}<ul>{queue.data.events.filter(e => e.job_id === job.id).map((event, n) => <li key={n}>{new Date(event.created_at).toLocaleString("fr-FR")} — {event.detail}</li>)}</ul></details>
        </article>)}
      </section>;
    })}</div>
  </section>;
}
