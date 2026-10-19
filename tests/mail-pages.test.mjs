import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {initialMailPage,validatedMailPage,inspectMailbox} from '../app/lib/mail-triage.ts';
import {categoryPermissions,validateCategoryPlan} from '../app/lib/mail-categories.ts';
const next=(scope='all',skip='100')=>'https://graph.microsoft.com/v1.0'+initialMailPage(scope)+'&$skip='+skip;
async function moduleFrom(path,values){const key=crypto.randomUUID();globalThis[key]=values;let source=await readFile(new URL('../'+path,import.meta.url),'utf8');source=source.replace(/^import .*;\r?\n/gm,'');source=`const {${Object.keys(values).join(',')}}=globalThis[${JSON.stringify(key)}];\n`+source;const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;try{return await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}finally{delete globalThis[key];}}
async function fixture(){const sql=new DatabaseSync(':memory:');for(const file of ['0000_morice','0001_connections_actions','0002_conversation_history'])sql.exec(await readFile(new URL('../drizzle/'+file+'.sql',import.meta.url),'utf8'));
const DB={prepare(q){return{bind(...v){return{async first(){return sql.prepare(q).get(...v)||null;},async all(){return{results:sql.prepare(q).all(...v)};},async run(){const r=sql.prepare(q).run(...v);return{meta:{changes:Number(r.changes)}};}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const lib=await moduleFrom('app/lib/mail-pages.ts',{initialMailPage,validatedMailPage});return{sql,DB,...lib,close(){sql.close();}};}
test('Graph continuations retain full metadata query and reject foreign destination/projection/scope',()=>{
 const good=next();assert.equal(validatedMailPage(good,'all'),good.slice('https://graph.microsoft.com/v1.0'.length));
 const token=good.replace('$skip=100','$skiptoken=opaque%2Bvalue%3D');assert.match(validatedMailPage(token,'all'),/opaque%2Bvalue%3D$/);
 const bad=[good.replace('https:','http:'),good.replace('graph.microsoft.com','graph.microsoft.com.evil.invalid'),good.replace('graph.microsoft.com','graph.microsoft.com:443'),good.replace('graph.microsoft.com','user@graph.microsoft.com'),good+'#x',good.replace('/me/messages','/me/../me/messages'),good.replace('/me/messages','/me/%6dessages'),good+'&$top=100',good+'&$expand=attachments',good.replace('id%2Csubject','body%2Csubject'),good.replace('%24top=100','%24top=500'),good+'&$skiptoken=extra'];
 for(const value of bad)assert.throws(()=>validatedMailPage(value,'all'),undefined,value);
 assert.throws(()=>validatedMailPage(next('notaire'),'assurances'));assert.throws(()=>validatedMailPage(good,'recent'));
 assert.equal(new URL(initialMailPage('all'),'https://graph.microsoft.com').searchParams.has('$filter'),false);
});
test('server pages isolate owner/account/scope/identity/expiry and never expose provider cursors',async()=>{const f=await fixture();try{
 const a=f.mailPageStore(f.DB,'alice');let reads=0;
 const read=async url=>{reads++;return inspectMailbox('one@example.invalid',async path=>({value:[{id:path.includes('$skip')?'second':'first',subject:'Test'}],...(path.includes('$skip')?{}:{'@odata.nextLink':next()})}),'all',url);};
 const first=await f.readMailPage(a,read,'one','one@example.invalid','all');assert.equal(first.batch,1);assert.equal(first.previousCursor,null);assert.ok(first.nextCursor);assert.doesNotMatch(JSON.stringify(first),/skip|graph.microsoft|nextLink/);
 const second=await f.readMailPage(a,read,'one','one@example.invalid','all',first.nextCursor);assert.equal(second.batch,2);assert.equal(second.previousCursor,'');assert.equal(second.messages[0].id,'second');assert.equal(reads,2);
 const before=reads;
 for(const [store,account,email,scope,cursor] of [[f.mailPageStore(f.DB,'bob'),'one','one@example.invalid','all',first.nextCursor],[a,'two','one@example.invalid','all',first.nextCursor],[a,'one','other@example.invalid','all',first.nextCursor],[a,'one','one@example.invalid','notaire',first.nextCursor],[a,'one','one@example.invalid','all','https://evil.invalid']])await assert.rejects(()=>f.readMailPage(store,read,account,email,scope,cursor));
 assert.equal(reads,before);const row=f.sql.prepare('SELECT key,value FROM morice_settings').get();const value=JSON.parse(row.value);value.expiresAt='2020-01-01T00:00:00Z';f.sql.prepare('UPDATE morice_settings SET value=? WHERE key=?').run(JSON.stringify(value),row.key);await assert.rejects(()=>f.readMailPage(a,read,'one','one@example.invalid','all',first.nextCursor));assert.equal(reads,before);
 }finally{f.close();}});
test('cursor capacity is atomic, expired entries reclaimed, foreign links and provider failures never leak',async()=>{const f=await fixture();try{
 const store=f.mailPageStore(f.DB,'alice');const record={accountId:'',account:'test',scope:'all',url:next(),expiresAt:new Date(Date.now()+60000).toISOString(),batch:2,parent:''};
 const outcomes=await Promise.all(Array.from({length:105},()=>store.put(crypto.randomUUID(),record)));assert.equal(outcomes.filter(Boolean).length,100);assert.equal(f.sql.prepare('SELECT count(*) n FROM morice_settings').get().n,100);
 f.sql.prepare("UPDATE morice_settings SET value=json_set(value,'$.expiresAt','2000-01-01T00:00:00Z')").run();assert.equal(await store.put(crypto.randomUUID(),record),true);assert.equal(f.sql.prepare('SELECT count(*) n FROM morice_settings').get().n,1);
 const unsafe=await f.readMailPage(store,async()=>({account:'test',scope:'all',messages:[],checkedAt:new Date().toISOString(),hasMore:true,nextLink:'https://evil.invalid/?secret=provider-token'}),'','test','all');assert.equal(unsafe.nextCursor,undefined);assert.doesNotMatch(JSON.stringify(unsafe),/provider-token|evil/);
 await assert.rejects(()=>f.readMailPage(store,async()=>{throw Error('https://graph.microsoft.com/token-secret');},'','test','all'),e=>!e.message.includes('token-secret'));
 await assert.rejects(()=>inspectMailbox('test',async()=>({value:Array.from({length:101},()=>({id:'one'}))}),'all'));
 }finally{f.close();}});
test('triage preparation revalidates the selected server page and private cursors cannot be read or set through state',async()=>{const f=await fixture();try{
 const values={env:{DB:f.DB},readMailPage:f.readMailPage,mailPageStore:f.mailPageStore,categoryPermissions,validateCategoryPlan,userId:r=>r.headers.get('test-user')||'alice',now:()=>new Date().toISOString(),microsoftConnection:async()=>({account_email:'test@example.invalid',scopes:'Mail.ReadWrite MailboxSettings.ReadWrite'}),reviewMicrosoftMailbox:async(_uid,_account,scope,url='')=>inspectMailbox('test@example.invalid',async path=>({value:[{id:path.includes('$skip')?'second':'first',subject:'Test'}],...(path.includes('$skip')?{}:{'@odata.nextLink':next(scope)})}),scope,url)};
 const route=await moduleFrom('app/api/microsoft/triage/route.ts',values);const first=await(await route.GET(new Request('https://morice.test/api/microsoft/triage?scope=all'))).json();assert.ok(first.nextCursor);const cursor=first.nextCursor;
 const post=id=>new Request('https://morice.test/api/microsoft/triage',{method:'POST',headers:{Origin:'https://morice.test','Content-Type':'application/json'},body:JSON.stringify({account:'test@example.invalid',scope:'all',cursor,entries:[{id,subject:'untrusted client subject',category:'Personnel'}]})});
 assert.equal((await route.POST(post('first'))).status,400);assert.equal((await route.POST(post('second'))).status,200);const action=JSON.parse(f.sql.prepare('SELECT payload FROM morice_action_payloads').get().payload);assert.equal(action.categoryPlan.entries[0].id,'second');assert.equal(action.categoryPlan.entries[0].subject,'Test');assert.doesNotMatch(JSON.stringify(action),/skiptoken|graph.microsoft/);
 const state=await moduleFrom('app/api/state/route.ts',values);f.sql.prepare("INSERT INTO morice_items(id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES('module','alice','module','test','test','active','normal',0,'now','now')").run();const data=await(await state.GET(new Request('https://morice.test/api/state'))).json();assert.ok(!Object.keys(data.settings).some(k=>k.startsWith('private_')));
 const modify=new Request('https://morice.test/api/state',{method:'POST',body:JSON.stringify({action:'setting',key:'private_mail_page:evil',value:'arbitrary'})});assert.equal((await state.POST(modify)).status,403);
 }finally{f.close();}});
