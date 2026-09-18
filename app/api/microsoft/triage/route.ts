import { reviewMicrosoftMailbox } from "@/app/lib/microsoft";
import { userId } from "@/app/lib/runtime";
import { env } from "cloudflare:workers";
import { categoryPermissions, validateCategoryPlan, type CategoryEntry } from "@/app/lib/mail-categories";

export async function GET(request: Request) {
  const uid = userId(request);
  try {
    const connection = await env.DB.prepare("SELECT scopes FROM morice_connections WHERE user_id=? AND provider='microsoft' AND status='connected'").bind(uid).first<{ scopes: string }>();
    return Response.json({ ...await reviewMicrosoftMailbox(uid), permissions: categoryPermissions(connection?.scopes || "") }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "La lecture des mails n’a pas abouti. Vérifiez Microsoft dans Connexions puis réessayez." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const uid = userId(request);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  try {
    const body = await request.json() as { entries?: CategoryEntry[]; account?: string };
    const createdAt = new Date().toISOString();
    const review = await reviewMicrosoftMailbox(uid);
    const plan = { account: body.account || "", createdAt, entries: body.entries || [] };
    validateCategoryPlan(plan, review.account);
    // Only current Inbox messages from the reviewed perimeter may be selected.
    plan.entries = plan.entries.map(entry => {
      const message = review.messages.find(message => message.id === entry.id);
      if (!message) throw new Error("La sélection a changé. Actualisez les propositions.");
      return { id: message.id, subject: message.subject, category: entry.category };
    });
    const id = crypto.randomUUID();
    const title = `Classer ${plan.entries.length} mail(s) dans Outlook`;
    const summary = `${review.account}\n${plan.entries.map(entry => `${entry.subject} → ${entry.category}`).join("\n")}\nAjout de catégories seulement. Validité : 30 minutes.`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO morice_items(id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES(?,?,'approval',?,?,'pending','normal',0,?,?)").bind(id, uid, title, summary, createdAt, createdAt),
      env.DB.prepare("INSERT INTO morice_action_payloads(item_id,user_id,provider,operation,payload,result,created_at) VALUES(?,?,'microsoft','mail_categorize',?,'',?)").bind(id, uid, JSON.stringify({ categoryPlan: plan }), createdAt),
    ]);
    return Response.json({ id, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Préparation indisponible." }, { status: 400 });
  }
}
