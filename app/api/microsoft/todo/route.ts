import { userId } from '@/app/lib/runtime';
import { readMicrosoftTodo } from '@/app/lib/microsoft';
import { ActionError } from '@/app/lib/action-error';
import { env } from 'cloudflare:workers';
import { now } from '@/app/lib/runtime';
export async function GET(request:Request) {
  const uid=userId(request);
  try { return Response.json(await readMicrosoftTodo(uid,new URL(request.url).searchParams.get('list')||''),{headers:{'Cache-Control':'no-store'}}); }
  catch (error) { return Response.json({error:error instanceof ActionError ? error.message : 'Microsoft To Do ne répond pas. Vérifiez votre connexion Microsoft.'},{status:502}); }
}

// Prepare an explicit user task; external execution uses the existing approval claim.
export async function POST(request: Request) {
  const uid = userId(request);
  let body: { title?: unknown; list?: unknown };
  try { body = await request.json(); } catch { return Response.json({error:'Demande invalide.'},{status:400}); }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const list = typeof body.list === 'string' ? body.list : '';
  if (!title || title.length > 300 || !list || list.length > 2048) return Response.json({error:'Choisissez une liste et un titre de 1 à 300 caractères.'},{status:400});
  try {
    const available = await readMicrosoftTodo(uid, '') as {lists:Array<{id:string}>};
    if (!available.lists.some(item=>item.id===list)) return Response.json({error:'Cette liste Microsoft To Do est indisponible.'},{status:400});
  } catch { return Response.json({error:'La lecture des listes Microsoft doit réussir avant de préparer la tâche.'},{status:409}); }
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_items(id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES(?,?,'approval',?,?,'pending','normal',0,?,?)").bind(id,uid,title,'Création directe Microsoft To Do, sans Make ni IA.',now(),now()),
    env.DB.prepare("INSERT INTO morice_action_payloads(item_id,user_id,provider,operation,payload,result,created_at) VALUES(?,?,'microsoft','todo_create',?,'',?)").bind(id,uid,JSON.stringify({subject:title,list}),now()),
  ]);
  return Response.json({id,prepared:true});
}
