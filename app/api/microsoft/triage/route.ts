import { microsoftConnection } from "@/app/lib/microsoft-accounts";
import { reviewMicrosoftMailbox } from "@/app/lib/microsoft";
import { userId } from "@/app/lib/runtime";
import { env } from "cloudflare:workers";
import { categoryPermissions, validateCategoryPlan, type CategoryEntry } from "@/app/lib/mail-categories";
import {readMailPage,mailPageStore} from '@/app/lib/mail-pages';

export async function GET(request: Request) {
  const uid = userId(request);
  try {
    const accountId = new URL(request.url).searchParams.get("accountId") || "";
    const connection = await microsoftConnection(uid, accountId);
    if(!connection)throw Error();
    const scope=new URL(request.url).searchParams.get('scope')||'recent';
    const cursor=new URL(request.url).searchParams.get('cursor')||'';
    const review=await readMailPage(mailPageStore(env.DB,uid),url=>reviewMicrosoftMailbox(uid,accountId,scope,url),accountId,connection.account_email,scope,cursor);
    return Response.json({ ...review, accountId, permissions: categoryPermissions(connection.scopes || "") }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Ce lot n’est plus accessible ou la lecture Microsoft a été interrompue. Réessayez ou recommencez au premier lot. Aucun mail modifié." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const uid = userId(request);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  try {
    const body = await request.json() as { entries?: CategoryEntry[]; account?: string; accountId?: string;scope?:string;cursor?:string };
    const createdAt = new Date().toISOString();
    const accountId = typeof body.accountId === "string" ? body.accountId : "";
    const scope=typeof body.scope==='string'?body.scope:'recent';
    const connection=await microsoftConnection(uid,accountId);if(!connection)throw Error('Microsoft doit être reconnecté.');
    const review = await readMailPage(mailPageStore(env.DB,uid),url=>reviewMicrosoftMailbox(uid,accountId,scope,url),accountId,connection.account_email,scope,typeof body.cursor==='string'?body.cursor:'',false);
    const plan = { account: body.account || "", createdAt, entries: body.entries || [] };
    validateCategoryPlan(plan, review.account);
    // Revalidate membership in the exact owner/account/scope/page before preparing any write.
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
      env.DB.prepare("INSERT INTO morice_action_payloads(item_id,user_id,provider,operation,payload,result,created_at) VALUES(?,?,'microsoft','mail_categorize',?,'',?)").bind(id, uid, JSON.stringify({ categoryPlan: plan, accountId }), createdAt),
    ]);
    return Response.json({ id, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Préparation indisponible." }, { status: 400 });
  }
}
