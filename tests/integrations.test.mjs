import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {integrationCatalog,integrationIds} from '../app/lib/integration-catalog.ts';
import {sameOrigin} from '../app/lib/attachment-validation.ts';
async function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE morice_settings(user_id TEXT,key TEXT,value TEXT,PRIMARY KEY(user_id,key))');
 const key=crypto.randomUUID();globalThis[key]={env:{DB:{prepare(query){return{bind(...values){return{async all(){return{results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}};}};}}},integrationIds,sameOrigin,userId:r=>r.headers.get('test-user')||'alice',now:()=>new Date().toISOString()};
 let source=await readFile(new URL('../app/api/integrations/route.ts',import.meta.url),'utf8');source=source.replace(/^import .*;\r?\n/gm,'');source=`const {env,integrationIds,sameOrigin,userId,now}=globalThis[${JSON.stringify(key)}];\n`+source;
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return{sql,route:await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')),close(){sql.close();delete globalThis[key];}};
}
const post=(body,user='alice',origin='https://morice.example')=>new Request('https://morice.example/api/integrations',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','test-user':user},body:JSON.stringify(body)});
test('integration plan is idempotent and owner isolated, never a connected state',async()=>{const f=await fixture();try{
 for(let i=0;i<2;i++){const r=await f.route.POST(post({service:'vacuum'}));assert.equal(r.status,200);assert.equal((await r.json()).status,'requested');}
 assert.equal(f.sql.prepare('SELECT count(*) n FROM morice_settings').get().n,1);
 const a=await f.route.GET(new Request('https://morice.example/api/integrations'));const data=await a.json();assert.equal(data.requests.length,1);assert.equal(data.requests[0].service,'vacuum');assert.equal(data.requests[0].status,'requested');assert.equal(Object.keys(data.requests[0]).length,3);assert.match(a.headers.get('Cache-Control'),/no-store/);
 assert.deepEqual(await(await f.route.GET(new Request('https://morice.example/api/integrations',{headers:{'test-user':'bob'}}))).json(),{requests:[]});
 f.sql.prepare("INSERT INTO morice_settings VALUES('alice','core_context','PRIVATE CORE')").run();f.sql.prepare("INSERT INTO morice_settings VALUES('alice','integration_request:unknown','{}')").run();f.sql.prepare("INSERT INTO morice_settings VALUES('alice','integration_request:gmail','broken')").run();assert.equal((await(await f.route.GET(new Request('https://morice.example/api/integrations'))).json()).requests.length,1);
 }finally{f.close();}});
test('integration plan rejects cross origin, unknown IDs, secrets, oversized and malformed bodies',async()=>{const f=await fixture();try{
 assert.equal((await f.route.POST(post({service:'vacuum'},'alice','https://evil.example'))).status,403);
 for(const body of [{service:'https://localhost:8000'}, {service:'vacuum',token:'must-not-store'}, ['vacuum'],null,{service:12}])assert.equal((await f.route.POST(post(body))).status,400);
 assert.equal((await f.route.POST(post({service:'x'.repeat(500)}))).status,413);
 assert.equal((await f.route.POST(new Request('https://morice.example/api/integrations',{method:'POST',headers:{Origin:'https://morice.example','Content-Type':'application/json'},body:'{'}))).status,400);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM morice_settings').get().n,0);
 }finally{f.close();}});
test('catalogue identifiers are unique, guides are HTTPS, access is never implied',()=>{
 assert.equal(integrationCatalog.length,integrationIds.size);assert.ok(integrationIds.has('vacuum'));assert.ok(integrationIds.has('tasker-tools'));assert.ok(integrationIds.has('finary'));
 for(const item of integrationCatalog){assert.equal(new URL(item.docs).protocol,'https:');assert.ok(item.boundary.length>20);assert.ok(item.steps.length>=3);}
});
