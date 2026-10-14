import {env} from 'cloudflare:workers';
import {userId,now} from '../../../lib/runtime';
import {sameOrigin} from '../../../lib/attachment-validation';

const pendingReply = 'Votre question est conservée dans Travaux → Relais MultipleChat. Le transfert et le retour de réponse nécessitent une session opérateur/Codex active. Aucun envoi automatique ni appel API payant.';
type RelayRow = {id:string;request:string;status:string;result:string;evidence:string};
function response(row:RelayRow) {
  return Response.json({ok:true,reply:row.status==='done'?row.result:pendingReply,action:{id:row.id,jobId:row.id,kind:'result',title:'Question pour MultipleChat',content:row.status==='done'?row.result:row.request,status:row.status,label:row.status==='done'?'Réponse MultipleChat importée':'Relais MultipleChat à effectuer',view:'jobs'}},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if (!sameOrigin(request)) return new Response(null,{status:403});
  const uid=userId(request);
  const body=await request.json().catch(()=>null) as {operation?:unknown;id?:unknown;question?:unknown;answer?:unknown;model?:unknown;chatUrl?:unknown}|null;
  if (!body || typeof body.id!=='string' || !/^[a-f0-9-]{36}$/.test(body.id)) return Response.json({error:'Référence de relais invalide.'},{status:400});
  const id=body.id;
  const lookup=()=>env.DB.prepare("SELECT id,request,status,result,evidence FROM morice_jobs WHERE id=? AND user_id=? AND operation='multiplechat_relay'").bind(id,uid).first<RelayRow>();
  const existing=await lookup();
  if(body.operation==='prepare') {
    const question=typeof body.question==='string'?body.question.trim():'';
    if(!question || question.length>1200) return Response.json({error:'La question doit contenir entre 1 et 1 200 caractères.'},{status:400});
    if(existing) return existing.request===question?response(existing):Response.json({error:'Cette référence appartient à une autre question.'},{status:409});
    const date=now();
    const action={id,jobId:id,kind:'result',title:'Question pour MultipleChat',content:question,status:'awaiting_relay',label:'Relais MultipleChat à effectuer',view:'jobs'};
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO morice_jobs(id,user_id,title,request,operation,status,evidence,created_at,updated_at) VALUES(?,?,?,?,'multiplechat_relay','awaiting_relay',?,?,?)").bind(id,uid,'Question pour MultipleChat',question,JSON.stringify({tool:'MultipleChat · relais assisté',trace:'Morice → opérateur/Codex → interface web MultipleChat',verification:'Question conservée; aucun envoi effectué'}),date,date),
        env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) VALUES(?,?,'awaiting_relay','Question conservée; transfert opérateur attendu',?)").bind(id,uid,date),
        env.DB.prepare("INSERT INTO morice_messages(user_id,role,text,action,created_at) VALUES(?,'user',?,'',?)").bind(uid,question,date),
        env.DB.prepare("INSERT INTO morice_messages(user_id,role,text,action,created_at) VALUES(?,'assistant',?,?,?)").bind(uid,pendingReply,JSON.stringify(action),date),
      ]);
    } catch {
      const concurrent=await lookup();
      if(concurrent?.request===question) return response(concurrent);
      return Response.json({error:'Enregistrement non confirmé. Conservez la même référence pour réessayer.'},{status:409});
    }
    return response((await lookup())!);
  }
  if(body.operation!=='complete') return Response.json({error:'Opération de relais invalide.'},{status:400});
  if(!existing) return Response.json({error:'Relais inaccessible.'},{status:404});
  const answer=typeof body.answer==='string'?body.answer.trim():'';
  const model=typeof body.model==='string'?body.model.trim():'';
  let chatUrl:URL;
  try {chatUrl=new URL(typeof body.chatUrl==='string'?body.chatUrl:'');} catch {return Response.json({error:'Indiquez le lien du chat MultipleChat source.'},{status:400});}
  const keys=[...chatUrl.searchParams.keys()];
  if(!answer || answer.length>24000 || !model || model.length>80 || Array.from(model).some(character=>character.charCodeAt(0)<32) || chatUrl.toString().length>500 || chatUrl.origin!=='https://multiplechat.ai' || chatUrl.pathname!=='/' || chatUrl.username || chatUrl.password || !/^[a-f0-9]{24}$/.test(chatUrl.searchParams.get('chat_id')||'') || keys.some(key=>!['chat_id','project','model'].includes(key)) || new Set(keys).size!==keys.length || (chatUrl.searchParams.has('project')&&!/^[a-f0-9]{24}$/.test(chatUrl.searchParams.get('project')!)) || (chatUrl.searchParams.has('model')&&!/^[a-z0-9_-]{1,40}$/i.test(chatUrl.searchParams.get('model')!)) || chatUrl.hash) return Response.json({error:'Réponse, modèle ou lien source invalide.'},{status:400});
  if(existing.status==='done') {
    const evidence=JSON.parse(existing.evidence) as {modelDeclared?:string;chatUrl?:string};
    return existing.result===answer && evidence.modelDeclared===model && evidence.chatUrl===chatUrl.toString()?response(existing):Response.json({error:'Ce relais est déjà terminé. Son résultat ne sera pas écrasé.'},{status:409});
  }
  if(existing.status!=='awaiting_relay') return Response.json({error:'Ce relais ne peut pas recevoir de résultat dans son état actuel.'},{status:409});
  const date=now();
  const evidence={tool:'MultipleChat · interface web',modelDeclared:model,chatUrl:chatUrl.toString(),checkedAt:date,trace:`Morice → opérateur/Codex → ${model} dans MultipleChat → réponse importée`,verification:'Texte et provenance importés par un opérateur authentifié; aucune connexion API prouvée'};
  const action={id,jobId:id,kind:'result',title:'Réponse MultipleChat importée',content:answer,status:'done',label:'Réponse MultipleChat importée',view:'jobs',...evidence};
  await env.DB.batch([
    env.DB.prepare("INSERT INTO morice_job_events(job_id,user_id,status,detail,created_at) SELECT id,user_id,'done','Réponse et provenance importées; aucune action externe exécutée',? FROM morice_jobs WHERE id=? AND user_id=? AND operation='multiplechat_relay' AND status='awaiting_relay'").bind(date,id,uid),
    env.DB.prepare("UPDATE morice_messages SET text=?,action=? WHERE user_id=? AND role='assistant' AND json_valid(action) AND json_extract(action,'$.jobId')=? AND EXISTS(SELECT 1 FROM morice_jobs WHERE id=? AND user_id=? AND operation='multiplechat_relay' AND status='awaiting_relay')").bind(answer,JSON.stringify(action),uid,id,id,uid),
    env.DB.prepare("UPDATE morice_jobs SET status='done',result=?,evidence=?,updated_at=? WHERE id=? AND user_id=? AND operation='multiplechat_relay' AND status='awaiting_relay'").bind(answer,JSON.stringify(evidence),date,id,uid),
  ]);
  const completed=await lookup();
  if(completed?.result!==answer) return Response.json({error:'Une autre réponse est déjà enregistrée. Vérifiez Travaux.'},{status:409});
  return response(completed);
}
