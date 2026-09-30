export const GOOGLE_SCOPES=['openid','email','https://www.googleapis.com/auth/gmail.readonly'];
export function googleAccountProvider(id:string){if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw Error('Compte Google invalide.');return `google:${id}`;}
export function googleCookies(request:Request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(v=>v.trim().split(/=(.*)/).slice(0,2)).filter(([k])=>k));}
export function googleFinish(request:Request,status:'authorized'|'error',reason=''){
 const url=new URL('/',request.url);url.searchParams.set('google',status);if(reason)url.searchParams.set('reason',reason);
 return new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'no-store','Set-Cookie':'morice_google_flow=; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});
}
export function verifyGoogleFlow(flow:{uid:string;state:string;expires:number;verifier:string},uid:string,state:string){return !!state&&flow.uid===uid&&flow.state===state&&flow.expires>Date.now()&&typeof flow.verifier==='string'&&flow.verifier.length>=43;}
