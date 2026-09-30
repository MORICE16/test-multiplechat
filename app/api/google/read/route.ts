import {userId} from '../../../lib/runtime';
import {googleMailbox} from '../../../lib/google-mail';
export async function GET(request:Request){
 try{
  const id=new URL(request.url).searchParams.get('accountId')||'';
  const mailbox=await googleMailbox(userId(request),id);
  return Response.json({status:'verified',account:mailbox.profile.emailAddress,messagesTotal:mailbox.profile.messagesTotal,threadsTotal:mailbox.profile.threadsTotal,checkedAt:mailbox.checkedAt,mode:'readonly'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:'Lecture Gmail non confirmée. Vérifiez la connexion, la permission et l’activation Gmail API.'},{status:error instanceof Error&&error.message==='Google account unavailable'?404:502,headers:{'Cache-Control':'no-store'}});}
}
