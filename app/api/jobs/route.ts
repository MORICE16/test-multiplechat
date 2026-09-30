import { env } from "cloudflare:workers";
import { userId } from "../../lib/runtime";
import { refreshResearch, type Job } from "../../lib/jobs";
import { sameOrigin } from "../../lib/attachment-validation";

export async function GET(request: Request) {
  const uid = userId(request);
  const jobs = await env.DB.prepare("SELECT * FROM morice_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(uid).all<Job>();
  const events = await env.DB.prepare("SELECT job_id,status,detail,created_at FROM morice_job_events WHERE user_id=? ORDER BY id DESC LIMIT 300").bind(uid).all();
  const files = await env.DB.prepare("SELECT id,job_id,name,mime,size,sha256 FROM morice_files WHERE user_id=? AND job_id<>'' ORDER BY created_at DESC LIMIT 300").bind(uid).all<{id:string;job_id:string;name:string;mime:string;size:number;sha256:string}>();
  return Response.json({ jobs: jobs.results.map(job => ({ id: job.id, title: job.title, request: job.request, operation: job.operation, status: job.status, result: job.result, error: job.error, created_at: job.created_at, updated_at: job.updated_at, evidence: {...JSON.parse(job.evidence),files:files.results.filter(file=>file.job_id===job.id).map(file=>({id:file.id,name:file.name,mime:file.mime,size:file.size,sha256:file.sha256}))} })), events: events.results }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, {status:403});
  await refreshResearch(userId(request));
  return GET(request);
}
