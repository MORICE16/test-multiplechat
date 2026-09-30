import {userId} from '../../../lib/runtime';
import {googleMailbox} from '../../../lib/google-mail';
import {inspectGmailInbox} from '../../../lib/mail-triage';
export async function GET(request:Request){
 try{
  const id=new URL(request.url).searchParams.get('accountId')||'';
  const mailbox=await googleMailbox(userId(request),id);
  return Response.json(await inspectGmailInbox(mailbox.profile.emailAddress||'',mailbox.read),{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Aperçu Gmail non confirmé. Vérifiez cette boîte dans Connexions.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
