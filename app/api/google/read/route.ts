import {env} from 'cloudflare:workers';
import {userId,runtimeValue,now} from '../../../lib/runtime';
import {encryptSecret,decryptSecret} from '../../../lib/secret-crypto';
import {googleAccountProvider} from '../../../lib/google-oauth';
type Connection={access_token:string;refresh_token:string;expires_at:string;account_email:string};
export async function GET(request:Request){try{
 const uid=userId(request);const id=new URL(request.url).searchParams.get('accountId')||'';const provider=googleAccountProvider(id);
 const c=await env.DB.prepare("SELECT access_token,refresh_token,expires_at,account_email FROM morice_connections WHERE user_id=? AND provider=? AND status IN ('authorized','verified')").bind(uid,provider).first<Connection>();if(!c)return Response.json({error:'Cette boîte Google n’est pas autorisée pour votre session.'},{status:404});
 let token=await decryptSecret(c.access_token);
 if(new Date(c.expires_at).getTime()<Date.now()+60000){
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:runtimeValue('GOOGLE_CLIENT_ID'),client_secret:runtimeValue('GOOGLE_CLIENT_SECRET'),grant_type:'refresh_token',refresh_token:await decryptSecret(c.refresh_token)})});const t=await r.json() as {access_token?:string;expires_in?:number};if(!r.ok||!t.access_token)throw Error();token=t.access_token;
  await env.DB.prepare('UPDATE morice_connections SET access_token=?,expires_at=? WHERE user_id=? AND provider=?').bind(await encryptSecret(token),new Date(Date.now()+(t.expires_in||3600)*1000).toISOString(),uid,provider).run();
 }
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`}});const p=await r.json() as {emailAddress?:string;messagesTotal?:number;threadsTotal?:number};if(!r.ok||p.emailAddress?.toLowerCase()!==c.account_email.toLowerCase())throw Error();
 const checkedAt=now();await env.DB.prepare("UPDATE morice_connections SET status='verified',updated_at=? WHERE user_id=? AND provider=?").bind(checkedAt,uid,provider).run();return Response.json({status:'verified',account:p.emailAddress,messagesTotal:p.messagesTotal,threadsTotal:p.threadsTotal,checkedAt,mode:'readonly'},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Lecture Gmail non confirmée. Vérifiez la connexion, la permission et l’activation Gmail API.'},{status:502,headers:{'Cache-Control':'no-store'}});}}
