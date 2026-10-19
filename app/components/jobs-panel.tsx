"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResultText } from "./result-text";
import { ResponsePlayer } from "./response-player";
import { type Citation } from "../lib/web-result";
import { MultipleChatRelayResult } from './multiplechat-relay-result';

type JobView = { id: string; title: string; request: string; operation: string; status: string; result: string; error: string; updated_at: string; evidence: { citations?: Citation[]; checkedAt?: string; tool?: string; responseId?: string; trace?:string; core?:string; chatUrl?:string; verification?:string; files?:{id:string;name:string;size:number}[] } };
type QueueData = { jobs: JobView[]; events: { job_id: string; status: string; detail: string; created_at: string }[] };
const groups = [["queued", "À faire"], ["awaiting_relay", "Relais MultipleChat"], ["running", "En cours"], ["approval", "En attente de validation"], ["blocked", "Bloqué"], ["done", "Terminé"]];

export function useJobs(onCompleted: () => void) {
  const [data, setData] = useState<QueueData>({ jobs: [], events: [] });
  const [error, setError] = useState("");
  const callback = useRef(onCompleted);
  useEffect(() => { callback.current = onCompleted; }, [onCompleted]);
  const flight = useRef<AbortController|null>(null);
  const disposed = useRef(false);
  const refreshAgain = useRef(false);
  const lastDone = useRef("");
  const active = useRef(false);
  const refresh = useCallback(async function refreshJobs() {
    if(disposed.current)return;
    if (flight.current) { refreshAgain.current = true; return; }
    const controller=new AbortController();flight.current=controller;
    const deadline=window.setTimeout(()=>controller.abort(),35_000);
    let succeeded=false;
    try {
      const response = await fetch("/api/jobs", { method: "POST",signal:controller.signal,cache:'no-store' });
      if (!response.ok) throw new Error("Le suivi des travaux est momentanément indisponible.");
      const next = await response.json() as QueueData;
      if(flight.current!==controller||disposed.current)return;
      if(controller.signal.aborted)throw new Error('Le suivi met trop de temps à répondre. Les derniers résultats restent conservés.');
      if(!next||!Array.isArray(next.jobs)||!Array.isArray(next.events))throw new Error('Réponse du suivi incomplète. Les derniers résultats restent conservés.');
      active.current = next.jobs.some(job => ["queued", "submitting", "running"].includes(job.status));
      const done = next.jobs.filter(j => j.status === "done").map(j => j.id).join(",");
      if (done !== lastDone.current) { lastDone.current = done; callback.current(); }
      setData(next); setError("");succeeded=true;
    } catch (e) { if(flight.current===controller&&!disposed.current)setError(controller.signal.aborted?'Le suivi met trop de temps à répondre. Les derniers résultats restent conservés.':e instanceof Error ? e.message : "Suivi indisponible."); }
    finally {
      window.clearTimeout(deadline);
      if(flight.current===controller){flight.current=null;const again=refreshAgain.current;refreshAgain.current=false;if(again&&succeeded&&!disposed.current)void refreshJobs();}
    }
  }, []);
  useEffect(() => {
    disposed.current=false;
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { if (!document.hidden && navigator.onLine && active.current) void refresh(); }, 15_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => { disposed.current=true;refreshAgain.current=false;flight.current?.abort();flight.current=null;clearTimeout(timeout); clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [refresh]);
  return { data, error, refresh };
}

export function JobsPanel({ queue, waiting, tasks, onTasks, onApprovals }: { queue: ReturnType<typeof useJobs>; waiting: number; tasks: { id: string; title: string; content: string; status: string }[]; onTasks: () => void; onApprovals: () => void }) {
  return <section className="panel"><p className="eyebrow">EXÉCUTION ET RÉSULTATS</p><h2>Travaux Morice</h2>
    <p>Les travaux déjà acceptés par un moteur peuvent continuer pendant votre absence. Morice récupère leur résultat à l’ouverture et toutes les 15 secondes pendant une consultation active. Le relais MultipleChat attend une intervention ; la planification serveur et les rappels restent à raccorder. Le suivi ne relance pas une action externe déjà envoyée.</p>
    <button onClick={() => void queue.refresh()}>Actualiser les travaux</button>{queue.error && <p role="alert">{queue.error}</p>}
    <div className="job-groups">{groups.map(([status, label]) => {
      const jobs = queue.data.jobs.filter(j => (j.status === "submitting" ? "running" : j.status === "relay_in_progress" ? "awaiting_relay" : j.status) === status);
      const notes = tasks.filter(t => (status === "queued" && t.status === "open") || (status === "done" && t.status === "done"));
      return <section key={status} className="job-group"><h3>{label} · {jobs.length + notes.length + (status === "approval" ? waiting : 0)}</h3>
        {status === "approval" && waiting > 0 && <button onClick={onApprovals}>Examiner {waiting} action(s) à valider</button>}
        {!jobs.length && !notes.length && !(status === "approval" && waiting) && <p>Aucun travail.</p>}
        {notes.map(task => <article className="job-card" key={task.id}><h4>{task.title}</h4><p>{task.content}</p><small>Tâche de suivi · {task.status === "done" ? "Marquée terminée" : "Exécution manuelle"}</small><button className="secondary" onClick={onTasks}>Ouvrir les tâches</button></article>)}
        {jobs.map(job => <article className="job-card" key={job.id}><h4>{job.title}</h4><p>{job.request}</p>
          <small>{job.evidence.tool || job.operation} · {new Date(job.updated_at).toLocaleString("fr-FR")}</small>
          {job.evidence.trace && <p className="horizon-caption">{job.evidence.trace} → {job.status === 'done' ? 'résultat enregistré' : job.status === 'blocked' ? 'bloqué' : job.status === 'awaiting_relay' ? 'attente du relais' : 'en cours'}</p>}
          {job.evidence.chatUrl?.startsWith("https://multiplechat.ai/") && <a href={job.evidence.chatUrl} target="_blank" rel="noopener noreferrer">Source MultipleChat ↗</a>}
          {job.evidence.verification && <p className="horizon-caption">{job.evidence.verification}</p>}
          {job.evidence.core && <small>{job.evidence.core}</small>}
          {!!job.evidence.files?.length && <ul aria-label="Pièces jointes conservées">{job.evidence.files.map(file=><li key={file.id}><a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">{file.name} ↗</a> · {Math.ceil(file.size/1024)} Ko</li>)}</ul>}
          {job.error && <p role="status">{job.error}</p>}
          {job.operation === 'multiplechat_relay' && ['awaiting_relay','relay_in_progress'].includes(job.status) && <MultipleChatRelayResult id={job.id} question={job.request} taken={job.status === "relay_in_progress"} onSaved={queue.refresh} />}
          {job.result && <><ResultText text={job.result} citations={job.evidence.citations} /><ResponsePlayer text={job.result.replace(/[^]*/g, "")} /></>}
          <details><summary>Historique et preuve</summary><p>Référence Morice : {job.id}</p>{job.evidence.responseId && <p>Référence du moteur : {job.evidence.responseId}</p>}{job.evidence.checkedAt && <p>Résultat reçu le {new Date(job.evidence.checkedAt).toLocaleString("fr-FR")}</p>}<ul>{queue.data.events.filter(e => e.job_id === job.id).map((event, n) => <li key={n}>{new Date(event.created_at).toLocaleString("fr-FR")} — {event.detail}</li>)}</ul></details>
        </article>)}
      </section>;
    })}</div>
  </section>;
}
