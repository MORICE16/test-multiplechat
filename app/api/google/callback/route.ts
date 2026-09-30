import {env} from 'cloudflare:workers';
import {runtimeValue,userId,now} from '../../../lib/runtime';
import {encryptSecret,decryptSecret} from '../../../lib/secret-crypto';
import {googleCookies,googleFinish,verifyGoogleFlow,googleAccountProvider,GOOGLE_SCOPES} from '../../../lib/google-oauth';
export async function GET(request:Request){try{
 const uid=userId(request);const u=new URL(request.url);const saved=googleCookies(request).morice_google_flow;
 if(!saved||!u.searchParams.get('code'))return googleFinish(request,'error','Connexion Google non terminée.');
 const flow=JSON.parse(await decryptSecret(saved));if(!verifyGoogleFlow(flow,uid,u.searchParams.get('state')||''))return googleFinish(request,'error','Demande Google expirée. Recommencez depuis Connexions.');
 const client=runtimeValue('GOOGLE_CLIENT_ID'),secret=runtimeValue('GOOGLE_CLIENT_SECRET');if(!client||!secret)return googleFinish(request,'error','Client Google non configuré.');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client,client_secret:secret,code:u.searchParams.get('code')!,grant_type:'authorization_code',redirect_uri:new URL('/api/google/callback',request.url).toString(),code_verifier:flow.verifier})});
 const t=await r.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string};if(!r.ok||!t.access_token||!t.scope?.split(' ').includes(GOOGLE_SCOPES[2]))return googleFinish(request,'error','Google n’a pas accordé la lecture Gmail.');
 const p=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${t.access_token}`}});const profile=await p.json() as {sub?:string;email?:string;email_verified?:boolean};
 if(!p.ok||!profile.sub||!profile.email||!profile.email_verified)return googleFinish(request,'error','Identité Google non vérifiée.');
 const provider=googleAccountProvider(profile.sub);const old=await env.DB.prepare('SELECT refresh_token FROM morice_connections WHERE user_id=? AND provider=?').bind(uid,provider).first<{refresh_token:string}>();
 const refresh=t.refresh_token?await encryptSecret(t.refresh_token):old?.refresh_token;if(!refresh)return googleFinish(request,'error','Accès renouvelable non accordé. Recommencez le consentement.');
 await env.DB.prepare("INSERT INTO morice_connections(user_id,provider,access_token,refresh_token,expires_at,account_email,scopes,status,updated_at) VALUES(?,?,?,?,?,?,?,'authorized',?) ON CONFLICT(user_id,provider) DO UPDATE SET access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at,account_email=excluded.account_email,scopes=excluded.scopes,status='authorized',updated_at=excluded.updated_at").bind(uid,provider,await encryptSecret(t.access_token),refresh,new Date(Date.now()+Math.max(60,t.expires_in||3600)*1000).toISOString(),profile.email,t.scope,now()).run();
 return googleFinish(request,'authorized');
 }catch{return googleFinish(request,'error','Connexion Google non confirmée. Les autres comptes sont conservés.');}}
