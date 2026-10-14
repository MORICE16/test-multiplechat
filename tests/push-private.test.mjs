import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {pushEndpoint} from '../app/lib/push-endpoint.ts';
import {sameOrigin} from '../app/lib/attachment-validation.ts';

test('push destinations reject arbitrary hosts, credentials, ports and misleading suffixes',()=>{
 for(const url of ['https://fcm.googleapis.com/fcm/send/test','https://updates.push.services.mozilla.com/wpush/v2/test','https://web.push.apple.com/test','https://wns2-by3p.notify.windows.com/?token=test']) assert.equal(pushEndpoint(url),url);
 for(const url of ['https://localhost/test','https://127.0.0.1/test','https://example.test/test','https://fcm.googleapis.com.evil.test/test','https://evil-fcm.googleapis.com/test','http://fcm.googleapis.com/test','https://user:password@fcm.googleapis.com/test','https://fcm.googleapis.com:8443/test','https://fcm.googleapis.com/test#fragment',42,'x'.repeat(4097)]) assert.throws(()=>pushEndpoint(url));
});

async function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(await readFile(new URL('../drizzle/0000_morice.sql',import.meta.url),'utf8'));
 const f={uid:'alice',calls:[],pushEndpoint,sameOrigin,userId:()=>f.uid,now:()=>new Date().toISOString()};
 f.env={DB:{prepare(query){return{bind(...values){return{async run(){const r=sql.prepare(query).run(...values);return{meta:{changes:Number(r.changes)}};},async first(){return sql.prepare(query).get(...values)||null;},async all(){return{results:sql.prepare(query).all(...values)}}};},async first(){return sql.prepare(query).get()||null;}};}}};
 f.sendEmptyPush=async endpoint=>{f.calls.push(endpoint);return{ok:true}};
 const key=crypto.randomUUID();globalThis[key]=f;
 async function load(path){let source=await readFile(new URL('../'+path,import.meta.url),'utf8');source=source.replace(/^import .*;\r?\n/gm,'');const prefix=`const {env,userId,now,pushEndpoint,sameOrigin,sendEmptyPush}=globalThis[${JSON.stringify(key)}];\n`;
 // crypto defines its own sender; route modules receive the test sender.
 const head=path.endsWith('crypto.ts')?prefix.replace(',sendEmptyPush',''):prefix;
 return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(head+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
 return{f,sql,subscribe:await load('app/api/push/subscribe/route.ts'),send:await load('app/api/push/test/route.ts'),crypto:await load('app/api/push/crypto.ts'),close(){sql.close();delete globalThis[key]}};
}

test('subscription and test routes enforce origin and ownership without cross-account replacement',async()=>{
 const x=await fixture();try{
  const endpoint='https://fcm.googleapis.com/fcm/send/synthetic';const body={endpoint,keys:{auth:'test',p256dh:'test'}};
  const request=(value=body,origin='https://morice.test')=>new Request('https://morice.test/api/push/subscribe',{method:'POST',headers:{Origin:origin},body:JSON.stringify(value)});
  assert.equal((await x.subscribe.POST(request(body,'https://evil.test'))).status,403);
  assert.equal((await x.subscribe.POST(request({...body,endpoint:'https://localhost/'}))).status,400);
  assert.equal((await x.subscribe.POST(request(body))).status,200);
  assert.equal((await x.subscribe.POST(request({...body,keys:{auth:'renewed'}}))).status,200);
  x.f.uid='bob';assert.equal((await x.subscribe.POST(request(body))).status,409);
  assert.equal(x.sql.prepare('SELECT user_id,auth FROM morice_push_subscriptions').get().auth,'renewed');
  assert.equal((await x.send.POST(request())).status,409);assert.equal(x.f.calls.length,0);
  x.f.uid='alice';assert.equal((await x.send.POST(request(body,'https://evil.test'))).status,403);assert.equal(x.f.calls.length,0);
  assert.equal((await x.send.POST(request())).status,200);assert.deepEqual(x.f.calls,[endpoint]);
 }finally{x.close();}
});

test('concurrent VAPID initialization preserves one key pair and sender validates before network access',async()=>{
 const x=await fixture();const originalFetch=globalThis.fetch;try{
  const keys=await Promise.all([x.crypto.vapidKeys(),x.crypto.vapidKeys(),x.crypto.vapidKeys()]);
  assert.equal(new Set(keys.map(k=>k.publicKey)).size,1);assert.deepEqual(keys[0],keys[1]);
  assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM morice_system').get().n,1);
  const calls=[];globalThis.fetch=async (url,init)=>{calls.push({url,init});return new Response(null,{status:201})};
  await assert.rejects(()=>x.crypto.sendEmptyPush('https://localhost/private'));assert.equal(calls.length,0);
  assert.equal((await x.crypto.sendEmptyPush('https://fcm.googleapis.com/fcm/send/synthetic')).status,201);
  assert.equal(calls[0].init.redirect,'error');assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.match(calls[0].init.headers.Authorization,/^vapid t=/);
  assert.equal((await x.crypto.vapidKeys()).publicKey,keys[0].publicKey);
 }finally{globalThis.fetch=originalFetch;x.close();}
});
