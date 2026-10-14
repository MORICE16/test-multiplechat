// Restrict server requests to the browser push services supported by Morice.
export function pushEndpoint(value:unknown):string {
  if(typeof value !== 'string' || value.length>4096) throw new Error('Adresse de notification invalide.');
  const url=new URL(value);
  const host=url.hostname;
  const allowed=host==='fcm.googleapis.com' || host==='updates.push.services.mozilla.com' || /^[a-z0-9-]+\.push\.apple\.com$/.test(host) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  if(!allowed || url.protocol!=='https:' || url.username || url.password || url.port || url.hash) throw new Error('Service de notification non pris en charge.');
  return url.href;
}
