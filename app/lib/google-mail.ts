import {env} from 'cloudflare:workers';
import {runtimeValue,now} from './runtime';
import {encryptSecret,decryptSecret} from './secret-crypto';
import {googleAccountProvider} from './google-oauth';

export async function googleMailbox(uid:string,id:string){
 const provider=googleAccountProvider(id);
 const c=await env.DB.prepare("SELECT access_token,refresh_token,expires_at,account_email FROM morice_connections WHERE user_id=? AND provider=? AND status IN ('authorized','verified')").bind(uid,provider).first<{access_token:string;refresh_token:string;expires_at:string;account_email:string}>();
 if(!c)throw Error('Google account unavailable');
 let token=await decryptSecret(c.access_token);
 if(new Date(c.expires_at).getTime()<Date.now()+60000){
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:runtimeValue('GOOGLE_CLIENT_ID'),client_secret:runtimeValue('GOOGLE_CLIENT_SECRET'),grant_type:'refresh_token',refresh_token:await decryptSecret(c.refresh_token)})});const t=await r.json() as {access_token?:string;expires_in?:number};if(!r.ok||!t.access_token)throw Error('Google refresh unavailable');token=t.access_token;
  await env.DB.prepare('UPDATE morice_connections SET access_token=?,expires_at=? WHERE user_id=? AND provider=?').bind(await encryptSecret(token),new Date(Date.now()+(t.expires_in||3600)*1000).toISOString(),uid,provider).run();
 }
 const read=async(path:string):Promise<unknown>=>{
  // Fixed Gmail read endpoints only; no caller-provided URL or write operation.
  if(path!=='/profile'&&path!=='/messages?labelIds=INBOX&maxResults=20&fields=messages(id),nextPageToken'&&!/^\/messages\/[a-f0-9]+\?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&fields=id,internalDate,labelIds,payload\(headers\)$/.test(path))throw Error('Unsupported Gmail read');
  const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+path,{signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error('Gmail read unavailable');return r.json();
 };
 const profile=await read('/profile') as {emailAddress?:string;messagesTotal?:number;threadsTotal?:number};
 if(profile.emailAddress?.toLowerCase()!==c.account_email.toLowerCase())throw Error('Google identity mismatch');
 const checkedAt=now();await env.DB.prepare("UPDATE morice_connections SET status='verified',updated_at=? WHERE user_id=? AND provider=?").bind(checkedAt,uid,provider).run();
 return {profile,checkedAt,read};
}
