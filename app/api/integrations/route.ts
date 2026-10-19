import {env} from 'cloudflare:workers';
import {userId,now} from '../../lib/runtime';
import {sameOrigin} from '../../lib/attachment-validation';
import {integrationIds} from '../../lib/integration-catalog';

const prefix='integration_request:';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request) {
 const rows=await env.DB.prepare("SELECT key,value FROM morice_settings WHERE user_id=? AND key LIKE 'integration_request:%'").bind(userId(request)).all<{key:string;value:string}>();
 const requests=rows.results.flatMap(row=>{
  const service=row.key.slice(prefix.length);
  if(!integrationIds.has(service))return [];
  try {const value=JSON.parse(row.value);return typeof value.requestedAt==='string'&&Number.isFinite(Date.parse(value.requestedAt))?[{service,status:'requested',requestedAt:value.requestedAt}]:[];}catch{return [];}
 });
 return Response.json({requests},{headers});
}
export async function POST(request:Request) {
 const uid=userId(request);
 if(!sameOrigin(request))return Response.json({error:'Origine non autorisée.'},{status:403,headers});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return Response.json({error:'Format non autorisé.'},{status:415,headers});
 // Small bounded body. The request contains a public service ID only, never a secret or a destination URL.
 if(!request.body)return Response.json({error:'Service requis.'},{status:400,headers});
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try {for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>256){await reader.cancel();return Response.json({error:'Demande trop volumineuse.'},{status:413,headers});}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return Response.json({error:'Demande invalide.'},{status:400,headers});}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!('service' in body)||typeof body.service!=='string'||!integrationIds.has(body.service))return Response.json({error:'Service inconnu ou demande invalide.'},{status:400,headers});
 const key=prefix+body.service;
 await env.DB.prepare('INSERT OR IGNORE INTO morice_settings(user_id,key,value) VALUES(?,?,?)').bind(uid,key,JSON.stringify({requestedAt:now()})).run();
 return Response.json({ok:true,service:body.service,status:'requested',message:'Ajouté à votre plan de connexion. Aucun accès accordé, aucun appareil commandé.'},{headers});
}
