import { env } from "cloudflare:workers";
import { userId } from "../../lib/runtime";
import { refreshResearch, type Job } from "../../lib/jobs";

export async function GET(request: Request) {
  const uid = userId(request);
  const jobs = await env.DB.prepare("SELECT * FROM morice_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(uid).all<Job>();
  const events = await env.DB.prepare("SELECT job_id,status,detail,created_at FROM morice_job_events WHERE user_id=? ORDER BY id DESC LIMIT 300").bind(uid).all();
  return Response.json({ jobs: jobs.results.map(job => ({ id: job.id, title: job.title, request: job.request, operation: job.operation, status: job.status, result: job.result, error: job.error, created_at: job.created_at, updated_at: job.updated_at, evidence: JSON.parse(job.evidence) })), events: events.results }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  await refreshResearch(userId(request));
  return GET(request);
}
