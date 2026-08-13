import { env } from "cloudflare:workers";
import { runMakeAction, runMicrosoftAction, type ActionPayload } from "@/app/lib/microsoft";
import { now, userId } from "@/app/lib/runtime";

type PendingAction = { item_id: string; provider: string; operation: string; payload: string };

export async function POST(request: Request) {
  const uid = userId(request);
  const body = await request.json() as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Action introuvable." }, { status: 400 });

  const action = await env.DB.prepare("SELECT p.item_id,p.provider,p.operation,p.payload FROM morice_action_payloads p JOIN morice_items i ON i.id=p.item_id AND i.user_id=p.user_id WHERE p.item_id=? AND p.user_id=? AND i.status='pending'").bind(id, uid).first<PendingAction>();
  if (!action) return Response.json({ error: "Cette action n’est plus en attente de validation." }, { status: 409 });

  try {
    const payload = JSON.parse(action.payload) as ActionPayload;
    const result = action.provider === "microsoft"
      ? await runMicrosoftAction(uid, action.operation, payload)
      : action.provider === "make"
        ? await runMakeAction(payload)
        : (() => { throw new Error("Fournisseur d’action inconnu."); })();
    await env.DB.batch([
      env.DB.prepare("UPDATE morice_items SET status='executed', updated_at=? WHERE id=? AND user_id=?").bind(now(), id, uid),
      env.DB.prepare("UPDATE morice_action_payloads SET result=?, executed_at=? WHERE item_id=? AND user_id=?").bind(result, now(), id, uid),
    ]);
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Morice n’a pas pu exécuter cette action." }, { status: 502 });
  }
}
