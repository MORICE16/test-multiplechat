import { env } from "cloudflare:workers";
import { runMakeAction, runMicrosoftAction, type ActionPayload } from "@/app/lib/microsoft";
import { now, userId } from "@/app/lib/runtime";

type PendingAction = { item_id: string; provider: string; operation: string; payload: string };

export async function POST(request: Request) {
  const uid = userId(request);
  const body = await request.json() as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Action introuvable." }, { status: 400 });

  const action = await env.DB.prepare("SELECT p.item_id,p.provider,p.operation,p.payload FROM morice_action_payloads p JOIN morice_items i ON i.id=p.item_id AND i.user_id=p.user_id WHERE p.item_id=? AND p.user_id=?").bind(id, uid).first<PendingAction>();
  if (!action) return Response.json({ error: "Action introuvable." }, { status: 404 });

  const claim = await env.DB.prepare("UPDATE morice_items SET status='executing', updated_at=? WHERE id=? AND user_id=? AND status='pending'").bind(now(), id, uid).run();
  if ((claim.meta.changes || 0) !== 1) return Response.json({ error: "Cette action n’est plus en attente de validation." }, { status: 409 });

  let result: string;
  try {
    const payload = JSON.parse(action.payload) as ActionPayload;
    result = action.provider === "microsoft"
      ? await runMicrosoftAction(uid, action.operation, payload)
      : action.provider === "make"
        ? await runMakeAction(payload, action.item_id)
        : (() => { throw new Error("Fournisseur d’action inconnu."); })();
  } catch (error) {
    await env.DB.prepare("UPDATE morice_items SET status='pending', updated_at=? WHERE id=? AND user_id=? AND status='executing'").bind(now(), id, uid).run();
    return Response.json({ error: error instanceof Error ? error.message : "Morice n’a pas pu exécuter cette action." }, { status: 502 });
  }

  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE morice_items SET status='executed', updated_at=? WHERE id=? AND user_id=? AND status='executing'").bind(now(), id, uid),
      env.DB.prepare("UPDATE morice_action_payloads SET result=?, executed_at=? WHERE item_id=? AND user_id=?").bind(result, now(), id, uid),
    ]);
    return Response.json({ ok: true, result });
  } catch {
    return Response.json({ error: "L’action externe a répondu, mais Morice n’a pas pu enregistrer sa confirmation. Vérifie le service avant de réessayer." }, { status: 500 });
  }
}
