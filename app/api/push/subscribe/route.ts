import { env } from "cloudflare:workers";
import { now, userId } from "@/app/lib/runtime";

export async function POST(request: Request) {
  const body = await request.json() as { endpoint?: unknown; keys?: { p256dh?: string; auth?: string } };
  if (typeof body.endpoint !== "string") return Response.json({ error: "Abonnement de notification invalide." }, { status: 400 });
  try {
    if (new URL(body.endpoint).protocol !== "https:") throw new Error();
  } catch {
    return Response.json({ error: "Adresse de notification invalide." }, { status: 400 });
  }
  await env.DB.prepare("INSERT OR REPLACE INTO morice_push_subscriptions(endpoint,user_id,p256dh,auth,created_at) VALUES(?,?,?,?,?)")
    .bind(body.endpoint, userId(request), body.keys?.p256dh || "", body.keys?.auth || "", now()).run();
  return Response.json({ ok: true });
}
