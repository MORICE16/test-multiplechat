import {probeMicrosoft} from './microsoft';
import {now} from './runtime';
export async function microsoftHealth(uid:string) {
  const checks=[];
  for(const [service,path] of [
    ['Outlook','/me/messages?$top=1&$select=id'],
    ['Calendar','/me/calendars?$top=1&$select=id'],
    ['To Do','/me/todo/lists'],
    ['OneDrive','/me/drive/root?$select=id'],
  ]) {
    try { await probeMicrosoft(uid,path);checks.push({service,status:'verified',checkedAt:now()}); }
    catch {checks.push({service,status:'unconfirmed',checkedAt:now(),next:'Reconnecter Microsoft et vérifier la permission de ce service.'});}
  }
  return checks;
}
