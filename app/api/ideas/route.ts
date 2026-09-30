import { env } from 'cloudflare:workers';
import { userId, now } from '../../lib/runtime';
import { sameOrigin, MAX_ATTACHMENTS } from '../../lib/attachment-validation';
import { startIdea } from '../../lib/idea-analysis';

export async function POST(request:Request) {
  const uid=userId(request);
  if(!sameOrigin(request)) return new Response(null,{status:403});
  const body=await request.json() as {id?:string;text?:string;files?:string[]};
  if(!body.id || !/^[a-f0-9-]{36}$/.test(body.id) || typeof body.text !== 'string' || !body.text.trim() || body.text.length>4000 || !Array.isArray(body.files) || body.files.length>MAX_ATTACHMENTS || new Set(body.files).size!==body.files.length || body.files.some(id=>typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id))) return Response.json({error:'Demande invalide.'},{status:400});
  const existing=await env.DB.prepare('SELECT id,request FROM morice_jobs WHERE id=? AND user_id=?').bind(body.id,uid).first<{id:string;request:string}>();
  if(existing) {
    const attachments=await env.DB.prepare('SELECT id FROM morice_files WHERE job_id=? AND user_id=?').bind(body.id,uid).all<{id:string}>();
    if(existing.request!==body.text.trim() || attachments.results.map(f=>f.id).sort().join(',')!==[...body.files].sort().join(',')) return Response.json({error:'Cette référence correspond à une autre demande déjà enregistrée. Consultez Travaux avant de lancer une nouvelle idée.'},{status:409});
    return Response.json({jobId:body.id},{headers:{'Cache-Control':'no-store'}});
  }
  const fileRows=await Promise.all(body.files.map(id=>env.DB.prepare("SELECT id FROM morice_files WHERE id=? AND user_id=? AND job_id=''").bind(id,uid).first()));
  if(fileRows.some(f=>!f)) return Response.json({error:'Une pièce jointe est inaccessible ou déjà utilisée.'},{status:400});
  const date=now(); const text=body.text.trim();
  // Claim attachments inside the same transaction. The migration trigger
  // aborts conflicting claims; no model is called before this batch commits.
  try { await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_jobs(id,user_id,title,request,operation,status,created_at,updated_at) VALUES(?,?,?,?,'idea_analysis','queued',?,?)").bind(body.id,uid,'Nouvelle idée · analyse',text,date,date),
    ...body.files.map(id=>env.DB.prepare("UPDATE morice_files SET job_id=? WHERE id=? AND user_id=?").bind(body.id,id,uid)),
    env.DB.prepare("INSERT INTO morice_items(id,user_id,kind,title,content,created_at,updated_at) VALUES(?,?,'memory',?,?,?,?)").bind(body.id,uid,text.slice(0,100),text,date,date),
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) VALUES(?,?,'queued','Idée et fichiers conservés avant analyse',?)").bind(body.id,uid,date),
  ]); } catch { return Response.json({error:'Enregistrement concurrent ou interrompu. Vérifiez vos travaux avant de réessayer.'},{status:409}); }
  await startIdea(uid,body.id,text);
  return Response.json({jobId:body.id},{status:202,headers:{'Cache-Control':'no-store'}});
}
