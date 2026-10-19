import {validatedMailPage,initialMailPage,type MailReview} from './mail-triage';
export type MailPageRecord={accountId:string;account:string;scope:string;url:string;expiresAt:string;batch:number;parent:string};
export type MailPageStore={get:(id:string)=>Promise<unknown>;put:(id:string,page:MailPageRecord)=>Promise<boolean>};
const cursorId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export async function readMailPage(store:MailPageStore,read:(url:string)=>Promise<MailReview &{nextLink?:string}>,accountId:string,account:string,scope:string,cursor='',withNext=true):Promise<MailReview>{
 initialMailPage(scope);
 let url='',batch=1,parent:string|null=null;
 if(cursor){
  if(!cursorId(cursor))throw Error('Lot expiré ou indisponible. Recommencez au premier lot.');
  const value=await store.get(cursor) as MailPageRecord|null;
  if(!value||value.accountId!==accountId||value.account!==account||value.scope!==scope||typeof value.expiresAt!=='string'||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=Date.now()||!Number.isInteger(value.batch)||value.batch<2||value.batch>1000||typeof value.parent!=='string'||(value.parent!==''&&!cursorId(value.parent)))throw Error('Lot expiré ou indisponible. Recommencez au premier lot.');
  validatedMailPage(value.url,scope);url=value.url;batch=value.batch;parent=value.parent;
 }
 let result:MailReview &{nextLink?:string};
 try{result=await read(url);}catch{throw Error('Lecture Microsoft interrompue. Aucun message modifié. Réessayez le lot ou recommencez au premier.');}
 if(result.account!==account||result.scope!==scope||!Array.isArray(result.messages)||result.messages.length>100)throw Error('Lot Microsoft incomplet. Aucun message modifié.');
 // Explicit projection: provider continuation URLs can never escape through a response/error/evidence.
 const safe:MailReview={account:result.account,checkedAt:result.checkedAt,scope,messages:result.messages,hasMore:result.hasMore,cursor,batch,previousCursor:parent};
 if(withNext&&result.nextLink&&result.nextLink!==url){
  try{validatedMailPage(result.nextLink,scope);}catch{return safe;}
  const id=crypto.randomUUID();
  if(await store.put(id,{accountId,account,scope,url:result.nextLink,expiresAt:new Date(Date.now()+1800000).toISOString(),batch:batch+1,parent:cursor}))safe.nextCursor=id;
 }
 return safe;
}
/** Owner bound closures; atomic cap, expiry checked again by readMailPage. No schema migration. */
export function mailPageStore(db:D1Database,uid:string):MailPageStore{
 const prefix='private_mail_page:';
 return{
  async get(id){const row=await db.prepare('SELECT value FROM morice_settings WHERE user_id=? AND key=?').bind(uid,prefix+id).first<{value:string}>();if(!row)return null;try{return JSON.parse(row.value);}catch{return null;}},
  async put(id,page){
   await db.prepare("DELETE FROM morice_settings WHERE user_id=? AND key GLOB 'private_mail_page:*' AND (CASE WHEN json_valid(value) THEN json_extract(value,'$.expiresAt') ELSE '' END) <= ?").bind(uid,new Date().toISOString()).run();
   const result=await db.prepare("INSERT OR IGNORE INTO morice_settings(user_id,key,value) SELECT ?,?,? WHERE (SELECT count(*) FROM morice_settings WHERE user_id=? AND key GLOB 'private_mail_page:*')<100").bind(uid,prefix+id,JSON.stringify(page),uid).run();
   return result.meta.changes===1;
  },
 };
}
