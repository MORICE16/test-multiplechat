import { env } from "cloudflare:workers";
import { userId } from "@/app/lib/runtime";
import { sendEmptyPush } from "../crypto";

export async function POST(request: Request) {
  const rows = await env.DB.prepare("SELECT endpoint FROM morice_push_subscriptions WHERE user_id=?").bind(userId(request)).all();
  const subscriptions = rows.results as Array<{ endpoint: string }>;
  if (!subscriptions.length) return Response.json({ error: "Aucun appareil n’est encore abonné aux notifications Morice." }, { status: 409 });
  const attempts = await Promise.allSettled(subscriptions.map(row => sendEmptyPush(row.endpoint)));
  const sent = attempts.filter(attempt => attempt.status === "fulfilled" && attempt.value.ok).length;
  if (!sent) return Response.json({ error: "Le service de notification n’a accepté aucun envoi." }, { status: 502 });
  return Response.json({ ok: true, sent, failed: subscriptions.length - sent });
}
