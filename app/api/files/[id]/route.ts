import { env } from 'cloudflare:workers';
import { userId } from '../../../lib/runtime';
import { sameOrigin } from '../../../lib/attachment-validation';
type Stored = {object_key:string; mime:string; name:string; job_id:string};
async function owned(request:Request, context:{params:Promise<{id:string}>}) {
  const {id} = await context.params;
  return {id,uid:userId(request)};
}
export async function GET(request:Request, context:{params:Promise<{id:string}>}) {
  const {id,uid} = await owned(request,context);
  const file = await env.DB.prepare('SELECT object_key,mime,name,job_id FROM morice_files WHERE id=? AND user_id=?').bind(id,uid).first<Stored>();
  if (!file) return new Response('Introuvable',{status:404});
  const object = await env.FILES.get(file.object_key);
  if (!object) return new Response('Introuvable',{status:404});
  return new Response(object.body,{headers:{'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${file.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`}});
}
export async function DELETE(request:Request, context:{params:Promise<{id:string}>}) {
  if (!sameOrigin(request)) return new Response(null,{status:403});
  const {id,uid} = await owned(request,context);
  const file = await env.DB.prepare("DELETE FROM morice_files WHERE id=? AND user_id=? AND job_id='' RETURNING object_key").bind(id,uid).first<{object_key:string}>();
  if (!file) return new Response(null,{status:409});
  await env.FILES.delete(file.object_key);
  return new Response(null,{status:204});
}
