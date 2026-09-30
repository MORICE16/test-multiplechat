import {env} from 'cloudflare:workers';
import {userId,now} from '../../lib/runtime';
import {encryptSecret,decryptSecret} from '../../lib/secret-crypto';
import {sameOrigin,safeFilename} from '../../lib/attachment-validation';
export async function GET(request:Request) {
  const uid=userId(request);const row=await env.DB.prepare("SELECT value FROM morice_settings WHERE user_id=? AND key='core_context'").bind(uid).first<{value:string}>();
  if(!row)return Response.json({configured:false},{headers:{'Cache-Control':'no-store'}});
  const data=JSON.parse(await decryptSecret(row.value)) as {text:string;name:string;sha256:string;updatedAt:string};
  if(new URL(request.url).searchParams.get('format')==='text')return new Response(data.text,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  return Response.json({configured:true,name:data.name,sha256:data.sha256,updatedAt:data.updatedAt,characters:data.text.length},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  const uid=userId(request);if(!sameOrigin(request))return new Response(null,{status:403});
  if(!request.body)return Response.json({error:'Référence requise.'},{status:400});
  const reader=request.body.getReader();let total=0;const chunks:Uint8Array[]=[];
  try{for(;;){const p=await reader.read();if(p.done)break;total+=p.value.length;if(total>256000){await reader.cancel();return Response.json({error:'Référence trop volumineuse.'},{status:413});}chunks.push(p.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();const file=form.get('file');
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.txt'))return Response.json({error:'Référence TXT requise.'},{status:400});
  const text=await file.text();
  if(text.length<50 || text.length>100000 || /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text))return Response.json({error:'Référence invalide ou contenant un secret détectable.'},{status:400});
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const value=await encryptSecret(JSON.stringify({text,name:safeFilename(file.name),sha256,updatedAt:now()}));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_settings(user_id,key,value) SELECT user_id,'core_context_previous',value FROM morice_settings WHERE user_id=? AND key='core_context' ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value").bind(uid),
    env.DB.prepare("INSERT INTO morice_settings(user_id,key,value) VALUES(?,'core_context',?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value").bind(uid,value),
  ]);
  return Response.json({ok:true,sha256,characters:text.length},{headers:{'Cache-Control':'no-store'}});
}
