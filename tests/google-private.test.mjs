import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {googleCookies,googleFinish,verifyGoogleFlow,googleAccountProvider,GOOGLE_SCOPES} from '../app/lib/google-oauth.ts';
test('Google callback stores encrypted owner-scoped tokens, preserves Microsoft and requires a real Gmail read',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(await readFile(new URL('../drizzle/0001_connections_actions.sql',import.meta.url),'utf8'));
 const f={uid:'alice',googleCookies,googleFinish,verifyGoogleFlow,googleAccountProvider,GOOGLE_SCOPES};const key=crypto.randomUUID();globalThis[key]=f;
 const aes=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));f.runtimeValue=n=>n==='MORICE_ENCRYPTION_KEY'?aes:'synthetic-client';f.userId=()=>f.uid;f.now=()=>new Date().toISOString();
 f.env={DB:{prepare(q){return{bind(...v){return{async first(){return sql.prepare(q).get(...v)||null;},async run(){return sql.prepare(q).run(...v);},async all(){return{results:sql.prepare(q).all(...v)};}};}};}}};
 async function load(path){const source=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule((path.includes("secret-crypto")?`const {runtimeValue}=globalThis[${JSON.stringify(key)}];\n`:`const {env,runtimeValue,userId,now,encryptSecret,decryptSecret,googleMailbox,googleCookies,googleFinish,verifyGoogleFlow,googleAccountProvider,GOOGLE_SCOPES,fetch}=globalThis[${JSON.stringify(key)}];\n`).replace(path.endsWith('google-mail.ts')?'googleMailbox,':'__unused_fixture__','')+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
 const calls=[];f.fetch=async(url)=>{calls.push(url);if(url.includes('/token'))return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,scope:GOOGLE_SCOPES.join(' ')});if(url.includes('/userinfo'))return Response.json({sub:'123',email:'synthetic@example.test',email_verified:true});if(url.includes('/profile'))return Response.json({emailAddress:'synthetic@example.test',messagesTotal:42,threadsTotal:20});throw Error('Unexpected external URL');};
 try{
  Object.assign(f,await load('app/lib/secret-crypto.ts'));
  Object.assign(f,await load('app/lib/google-mail.ts'));
  sql.prepare("INSERT INTO morice_connections VALUES('alice','microsoft','unchanged','unchanged','2099-01-01','existing@example.test','','connected','now')").run();
  const callback=await load('app/api/google/callback/route.ts');const cookie=await f.encryptSecret(JSON.stringify({uid:'alice',state:'nonce',verifier:'a'.repeat(64),expires:Date.now()+60000}));const req=()=>new Request('https://morice.test/api/google/callback?state=nonce&code=synthetic',{headers:{Cookie:`morice_google_flow=${cookie}`}});
  f.uid='bob';assert.match((await callback.GET(req())).headers.get('location'),/google=error/);assert.equal(calls.length,0);
  f.uid='alice';assert.match((await callback.GET(req())).headers.get('location'),/google=authorized/);
  const row=sql.prepare("SELECT * FROM morice_connections WHERE user_id='alice' AND provider='google:123'").get();assert.equal(row.status,'authorized');assert.notEqual(row.access_token,'synthetic-access');assert.equal(await f.decryptSecret(row.access_token),'synthetic-access');assert.equal(await f.decryptSecret(row.refresh_token),'synthetic-refresh');assert.equal(sql.prepare("SELECT access_token FROM morice_connections WHERE provider='microsoft'").get().access_token,'unchanged');
  const accounts=await load('app/api/google/accounts/route.ts');const view=await(await accounts.GET(new Request('https://morice.test/api/google/accounts'))).json();assert.equal(view.accounts.length,1);assert.ok(!JSON.stringify(view).includes('access_token'));assert.ok(!JSON.stringify(view).includes('refresh_token'));
  const read=await load('app/api/google/read/route.ts');f.uid='bob';assert.equal((await read.GET(new Request('https://morice.test/api/google/read?accountId=123'))).status,404);
  f.uid='alice';const result=await(await read.GET(new Request('https://morice.test/api/google/read?accountId=123'))).json();assert.equal(result.status,'verified');assert.equal(result.messagesTotal,42);assert.equal(result.mode,'readonly');assert.equal(sql.prepare("SELECT status FROM morice_connections WHERE provider='google:123'").get().status,'verified');assert.ok(calls.every(u=>!u.includes('/send')&&!u.includes('/modify')));
  const mailbox=await f.googleMailbox('alice','123');const before=calls.length;await assert.rejects(()=>mailbox.read('/messages/a?format=full'),/Unsupported/);await assert.rejects(()=>mailbox.read('/messages/a/attachments/b'),/Unsupported/);await assert.rejects(()=>mailbox.read('/messages/send'),/Unsupported/);assert.equal(calls.length,before);
 }finally{sql.close();delete globalThis[key];}
});
