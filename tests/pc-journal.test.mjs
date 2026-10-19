import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {pcActions,pcUuid,validPcReceipt,pcResult} from '../app/lib/pc-contract.ts';
async function fixture(){
 const sql=new DatabaseSync(':memory:');for(const file of ['0000_morice','0002_conversation_history','0003_jobs'])sql.exec(await readFile(new URL(`../drizzle/${file}.sql`,import.meta.url),'utf8'));
 const key=crypto.randomUUID();const env={DB:{prepare(q){return{bind(...v){return{async first(){return sql.prepare(q).get(...v)||null;},async run(){return sql.prepare(q).run(...v);}};}};},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
 globalThis[key]={env,pcActions,pcUuid,validPcReceipt,pcResult,userId:r=>r.headers.get('test-user')||'alice',now:()=>new Date().toISOString()};
 let source=await readFile(new URL('../app/api/pc/journal/route.ts',import.meta.url),'utf8');source=source.replace(/^import .*;\r?\n/gm,'');source=`const {env,pcActions,pcUuid,validPcReceipt,pcResult,userId,now}=globalThis[${JSON.stringify(key)}];\n`+source;
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return{sql,route:await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),close(){delete globalThis[key];sql.close();}};
}
const request=(body,user='alice',origin='https://morice.example')=>new Request('https://morice.example/api/pc/journal',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','test-user':user},body:JSON.stringify(body)});
const receipt=id=>({version:1,requestId:id,session:crypto.randomUUID(),action:'health',status:'done',checkedAt:new Date().toISOString(),verification:'loopback_response'});
test('PC journal persists a scoped browser report, replay cannot overwrite terminal result',async()=>{const f=await fixture();try{
 const id=crypto.randomUUID(),begin={phase:'begin',id,action:'health'};for(let i=0;i<2;i++)assert.equal((await f.route.POST(request(begin))).status,200);
 const finish={phase:'finish',id,receipt:receipt(id)};assert.equal((await f.route.POST(request(finish))).status,200);assert.equal((await f.route.POST(request(finish))).status,200);
 const row=f.sql.prepare('SELECT * FROM morice_jobs').get();assert.equal(row.status,'done');assert.match(JSON.parse(row.evidence).verification,/non attesté/);assert.equal(f.sql.prepare('SELECT count(*) n FROM morice_jobs').get().n,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM morice_job_events').get().n,2);
 const before=row.result;const altered={...finish,receipt:{...finish.receipt,action:'calculator',status:'declined',verification:'not_executed'}};assert.equal((await f.route.POST(request(altered))).status,400);assert.equal(f.sql.prepare('SELECT result FROM morice_jobs').get().result,before);
 }finally{f.close();}});
test('PC journal rejects another owner, CSRF, arbitrary commands, oversized and forged receipts',async()=>{const f=await fixture();try{
 const id=crypto.randomUUID();await f.route.POST(request({phase:'begin',id,action:'health'}));
 assert.equal((await f.route.POST(request({phase:'finish',id,receipt:receipt(id)},'bob'))).status,400);
 assert.equal((await f.route.POST(request({phase:'begin',id:crypto.randomUUID(),action:'shell'}))).status,400);
 for(const origin of ['','https://evil.example'])assert.equal((await f.route.POST(request({phase:'begin',id:crypto.randomUUID(),action:'health'},'alice',origin))).status,403);
 assert.equal((await f.route.POST(request({phase:'finish',id,receipt:{...receipt(id),status:'connected'}}))).status,400);
 assert.equal((await f.route.POST(request({phase:'begin',id:crypto.randomUUID(),action:'x'.repeat(1200)}))).status,413);
 assert.equal(f.sql.prepare('SELECT status FROM morice_jobs').get().status,'queued');
 }finally{f.close();}});
