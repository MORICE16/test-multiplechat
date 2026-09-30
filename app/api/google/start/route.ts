import {runtimeValue,userId} from '../../../lib/runtime';
import {encryptSecret} from '../../../lib/secret-crypto';
import {GOOGLE_SCOPES} from '../../../lib/google-oauth';
export async function GET(request:Request){
 const uid=userId(request);const client=runtimeValue('GOOGLE_CLIENT_ID');
 if(!client||!runtimeValue('GOOGLE_CLIENT_SECRET')||!runtimeValue('MORICE_ENCRYPTION_KEY'))return Response.json({error:'Le client OAuth Google de Morice reste à configurer côté serveur. Aucun compte Gmail n’est connecté par ce bouton.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const state=crypto.randomUUID();const verifier=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));const challenge=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:client,redirect_uri:new URL('/api/google/callback',request.url).toString(),response_type:'code',scope:GOOGLE_SCOPES.join(' '),state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account'}).toString();
 const cookie=await encryptSecret(JSON.stringify({uid,state,verifier,expires:Date.now()+20*60*1000}));
 return new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'no-store','Set-Cookie':`morice_google_flow=${cookie}; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=1200`}});
}
