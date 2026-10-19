import {env} from 'cloudflare:workers';
import {userId,now} from '../../../lib/runtime';
import {pcActions,pcUuid,validPcReceipt,pcResult} from '../../../lib/pc-contract';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const uid=userId(request);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Origine refusée.'},{status:403,headers});
 if(request.headers.get('Content-Type')!=='application/json')return Response.json({error:'JSON requis.'},{status:415,headers});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Demande vide.'},{status:400,headers});
 let text='',bytes=0;const decoder=new TextDecoder();
 try{for(;;){const p=await reader.read();if(p.done)break;bytes+=p.value.length;if(bytes>1024){await reader.cancel();return Response.json({error:'Demande trop grande.'},{status:413,headers});}text+=decoder.decode(p.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 let body:Record<string,unknown>;try{body=JSON.parse(text);}catch{return Response.json({error:'Demande invalide.'},{status:400,headers});}
 if(!body||typeof body!=='object'||Array.isArray(body)||!pcUuid(body.id))return Response.json({error:'Identifiant invalide.'},{status:400,headers});
 const current=await env.DB.prepare('SELECT id,operation,status,evidence FROM morice_jobs WHERE id=? AND user_id=?').bind(body.id,uid).first<{id:string;operation:string;status:string;evidence:string}>();
 if(body.phase==='begin'&&Object.keys(body).sort().join(',')==='action,id,phase'&&pcActions.includes(body.action as 'health'|'calculator')){
  const operation='pc_local_'+body.action;
  if(current)return Response.json({ok:current.operation===operation,id:body.id,status:current.status},{status:current.operation===operation?200:409,headers});
  const count=await env.DB.prepare("SELECT count(*) AS n FROM morice_jobs WHERE user_id=? AND operation LIKE 'pc_local_%' AND created_at>?").bind(uid,new Date(Date.now()-60000).toISOString()).first<{n:number}>();
  if((count?.n||0)>=20)return Response.json({error:'Attendez une minute avant un autre test.'},{status:429,headers});
  const date=now(),title=body.action==='health'?'PC — vérifier la liaison locale':'PC — demander la calculatrice';
  await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO morice_jobs(id,user_id,title,request,operation,status,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?)").bind(body.id,uid,title,title,operation,date,date),
   env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) SELECT id,user_id,'queued','Demande locale préparée ; aucun résultat confirmé',? FROM morice_jobs WHERE id=? AND user_id=? AND status='queued' AND NOT EXISTS(SELECT 1 FROM morice_job_events WHERE job_id=?)").bind(date,body.id,uid,body.id),
  ]);
  const check=await env.DB.prepare('SELECT id FROM morice_jobs WHERE id=? AND user_id=? AND operation=?').bind(body.id,uid,operation).first();
  return Response.json({ok:Boolean(check),id:body.id,status:'queued'},{status:check?200:409,headers});
 }
 if(body.phase==='unconfirmed'&&Object.keys(body).sort().join(',')==='id,phase'&&current&&['pc_local_health','pc_local_calculator'].includes(current.operation)){
  const detail='Communication locale interrompue ou bloquée. Aucun résultat PC confirmé ; vérifier avant toute nouvelle demande. Aucun renvoi automatique.';
  const evidence={tool:'Morice PC local',verification:'Aucun reçu local reçu par le navigateur',trace:'Morice → navigateur PC → liaison locale non confirmée'};
  await env.DB.batch([
   env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) SELECT id,user_id,'blocked',?,? FROM morice_jobs WHERE id=? AND user_id=? AND status='queued'").bind(detail,now(),body.id,uid),
   env.DB.prepare("UPDATE morice_jobs SET status='blocked',error=?,evidence=?,updated_at=? WHERE id=? AND user_id=? AND status='queued'").bind(detail,JSON.stringify(evidence),now(),body.id,uid),
  ]);
  return Response.json({ok:true,id:body.id,status:'blocked'},{headers});
 }
 if(body.phase!=='finish'||Object.keys(body).sort().join(',')!=='id,phase,receipt'||!validPcReceipt(body.receipt)||body.receipt.requestId!==body.id||!current||current.operation!=='pc_local_'+body.receipt.action)return Response.json({error:'Résultat non valide pour ce travail.'},{status:400,headers});
 if(current.status!=='queued')return Response.json({ok:true,id:body.id,status:current.status,retained:true},{headers});
 const p=body.receipt,date=now(),status=p.status==='done'?'done':'blocked';
 const result=pcResult(p),evidence={tool:'Morice PC local',operation:p.action,checkedAt:p.checkedAt,verification:'Rapport du navigateur — non attesté par le serveur',trace:'Morice → navigateur PC → exécutant local → '+p.action+' → '+p.status,receipt:p};
 await env.DB.batch([
  env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) SELECT id,user_id,?,?,? FROM morice_jobs WHERE id=? AND user_id=? AND status='queued'").bind(status,result,date,body.id,uid),
  env.DB.prepare("UPDATE morice_jobs SET status=?,result=?,evidence=?,error=?,updated_at=? WHERE id=? AND user_id=? AND status='queued'").bind(status,result,JSON.stringify(evidence),status==='blocked'?result:'',date,body.id,uid),
 ]);
 return Response.json({ok:true,id:body.id,status,result},{headers});
}
