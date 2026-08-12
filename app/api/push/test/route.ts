import { env } from "cloudflare:workers";
import { sendEmptyPush } from "../crypto";
export async function POST(request: Request) { const uid=request.headers.get("oai-authenticated-user-id")||"alan"; const rows=await env.DB.prepare("SELECT endpoint FROM morice_push_subscriptions WHERE user_id=?").bind(uid).all(); const results=await Promise.all((rows.results as Array<{endpoint:string}>).map(row=>sendEmptyPush(row.endpoint))); return Response.json({ok:results.some(result=>result.ok), sent:results.length}); }
