import { env } from "cloudflare:workers";
import { pushEndpoint } from "../../lib/push-endpoint";

const encode = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
};

export async function vapidKeys() {
  const stored = await env.DB.prepare("SELECT value FROM morice_system WHERE key='vapid'").first<{value:string}>();
  if (stored) return JSON.parse(stored.value) as { publicKey:string; privateJwk:JsonWebKey };
  const pair = await crypto.subtle.generateKey({ name:"ECDSA", namedCurve:"P-256" }, true, ["sign","verify"]);
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const keys = { publicKey: encode(raw), privateJwk };
  await env.DB.prepare("INSERT OR IGNORE INTO morice_system(key,value) VALUES('vapid',?)").bind(JSON.stringify(keys)).run();
  const saved=await env.DB.prepare("SELECT value FROM morice_system WHERE key='vapid'").first<{value:string}>();
  if(!saved) throw new Error('Configuration des notifications non enregistrée.');
  return JSON.parse(saved.value) as { publicKey:string; privateJwk:JsonWebKey };
}

export async function sendEmptyPush(endpoint: string) {
  endpoint=pushEndpoint(endpoint);
  const { publicKey, privateJwk } = await vapidKeys();
  const audience = new URL(endpoint).origin;
  const header = encode(JSON.stringify({ typ:"JWT", alg:"ES256" }));
  const payload = encode(JSON.stringify({ aud:audience, exp:Math.floor(Date.now()/1000)+3600, sub:"mailto:morice@example.com" }));
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name:"ECDSA", namedCurve:"P-256" }, false, ["sign"]);
  const signature = encode(await crypto.subtle.sign({ name:"ECDSA", hash:"SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`)));
  return fetch(endpoint, { method:"POST", redirect:"error", signal:AbortSignal.timeout(10000), headers:{ Authorization:`vapid t=${header}.${payload}.${signature}, k=${publicKey}`, TTL:"60", Urgency:"high" } });
}
