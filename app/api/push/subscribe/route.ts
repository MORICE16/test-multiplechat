import { env } from "cloudflare:workers";
import { now, userId } from "@/app/lib/runtime";
import { sameOrigin } from "../../../lib/attachment-validation";
import { pushEndpoint } from "../../../lib/push-endpoint";

export async function POST(request: Request) {
  if(!sameOrigin(request)) return Response.json({error:'Origine refusée.'},{status:403});
  const uid=userId(request);
  const body = await request.json() as { endpoint?: unknown; keys?: { p256dh?: string; auth?: string } };
  let endpoint:string;
  try {
    endpoint=pushEndpoint(body.endpoint);
    for(const key of [body.keys?.p256dh,body.keys?.auth]) if(key!==undefined && (typeof key!=='string' || !/^[A-Za-z0-9_-]{1,256}$/.test(key))) throw new Error();
  } catch {
    return Response.json({ error: "Adresse de notification invalide." }, { status: 400 });
  }
  const saved=await env.DB.prepare("INSERT INTO morice_push_subscriptions(endpoint,user_id,p256dh,auth,created_at) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,created_at=excluded.created_at WHERE morice_push_subscriptions.user_id=excluded.user_id")
    .bind(endpoint, uid, body.keys?.p256dh || "", body.keys?.auth || "", now()).run();
  if(!saved.meta.changes) return Response.json({error:'Cet abonnement ne peut pas être modifié.'},{status:409});
  return Response.json({ ok: true });
}
