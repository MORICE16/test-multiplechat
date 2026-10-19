import {env} from 'cloudflare:workers';
import {userId,now} from '../../../lib/runtime';
import {microsoftConnection as connection} from '../../../lib/microsoft-accounts';
import {categoryPermissions,MAIL_CATEGORIES} from '../../../lib/mail-categories';
import {sameOrigin} from '../../../lib/attachment-validation';
export async function POST(request:Request){
 const uid=userId(request);if(!sameOrigin(request))return Response.json({error:'Origine non autorisée.'},{status:403});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return Response.json({error:'Format non autorisé.'},{status:415});
 try{
  const body=await request.json() as {accountId?:unknown};if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='accountId')||(body.accountId!==undefined&&typeof body.accountId!=='string'))return Response.json({error:'Demande invalide.'},{status:400});
  const accountId=typeof body.accountId==='string'?body.accountId:'';if(accountId.length>2048)return Response.json({error:'Compte invalide.'},{status:400});
  const stored=await connection(uid,accountId);if(!stored||!categoryPermissions(stored.scopes||'').manageCategories)return Response.json({error:'Autorisez la gestion des catégories Outlook pour cette boîte.'},{status:403});
  const id=crypto.randomUUID(),createdAt=now();
  const summary=`${stored.account_email}\nPréparer les catégories Outlook :\n${MAIL_CATEGORIES.join('\n')}\nCatégories existantes conservées. Aucun message modifié. Validité : 30 minutes.`;
  await env.DB.batch([
   env.DB.prepare("INSERT INTO morice_items(id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES(?,?,'approval',?,?,'pending','normal',0,?,?)").bind(id,uid,'Préparer mes catégories Outlook',summary,createdAt,createdAt),
   env.DB.prepare("INSERT INTO morice_action_payloads(item_id,user_id,provider,operation,payload,result,created_at) VALUES(?,?,'microsoft','mail_category_setup',?,'',?)").bind(id,uid,JSON.stringify({accountId,categorySetup:{account:stored.account_email,createdAt}}),createdAt),
  ]);
  return Response.json({id,summary},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Préparation des catégories non confirmée. Aucun message modifié.'},{status:400});}
}
