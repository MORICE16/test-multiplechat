import {env} from 'cloudflare:workers';
import {decryptSecret} from './secret-crypto';
import {coreExcerpts} from './core-excerpts';
export async function coreContext(uid:string,query:string) {
  const row=await env.DB.prepare("SELECT value FROM morice_settings WHERE user_id=? AND key='core_context'").bind(uid).first<{value:string}>();
  if(!row)return null;
  const stored=JSON.parse(await decryptSecret(row.value)) as {text:string;sha256:string;updatedAt:string;name:string};
  return {text:coreExcerpts(stored.text,query),sha256:stored.sha256,updatedAt:stored.updatedAt};
}
