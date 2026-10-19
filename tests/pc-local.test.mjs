import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {createPcServer,PC_ORIGIN,windowsCalculator} from '../scripts/pc-local.mjs';
import {validPcReceipt} from '../app/lib/pc-contract.ts';
async function fixture(execute=async()=>({status:'done',verification:'process_observed'})){
 const server=createPcServer({port:0,execute});server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}/action`;
 return{server,url,send:(body,headers={},method='POST')=>fetch(url,{method,headers:{Origin:PC_ORIGIN,'Content-Type':'application/json',...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}),async close(){server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
test('PC loopback rejects hostile origins, Hosts, verbs and payloads before execution',async()=>{let effects=0;const f=await fixture(async()=>{effects++;return{status:'done',verification:'process_observed'};});try{
 assert.equal(f.server.address().address,'127.0.0.1');const health={action:'health',requestId:randomUUID()};
 for(const origin of ['', 'null','https://evil.example','http://morice-alan-assistant.alan-nhl-99.chatgpt.site',PC_ORIGIN+'.evil.example']){const r=await f.send(health,{Origin:origin});assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);}
 const hostileHost=await new Promise((resolve,reject)=>{const req=httpRequest(f.url,{method:'POST',headers:{Origin:PC_ORIGIN,Host:'evil.example','Content-Type':'application/json'}},r=>{r.resume();resolve(r.statusCode);});req.on('error',reject);req.end(JSON.stringify(health));});assert.equal(hostileHost,403);
 assert.equal((await f.send(health,{'Content-Type':'text/plain'})).status,415);
 for(const body of ['{','x'.repeat(600),{...health,command:'whoami'},{action:'shell',requestId:randomUUID()},[],null])assert.ok((await f.send(body)).status>=400);
 assert.equal((await f.send(health,{},'GET')).status,405);assert.equal(effects,0);
 const pre=await f.send(null,{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type','Access-Control-Request-Private-Network':'true'},'OPTIONS');assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),PC_ORIGIN);assert.equal(pre.headers.get('Access-Control-Allow-Private-Network'),'true');
 }finally{await f.close();}});
test('PC actions deduplicate, reject concurrent prompts and reject another session',async()=>{let effects=0,release;const pending=new Promise(r=>release=r);const f=await fixture(async()=>{effects++;await pending;return{status:'done',verification:'process_observed'};});try{
 const h=await(await f.send({action:'health',requestId:randomUUID()})).json();assert.ok(validPcReceipt(h));
 assert.equal((await f.send({action:'calculator',requestId:randomUUID(),session:randomUUID()})).status,409);
 const action={action:'calculator',requestId:randomUUID(),session:h.session};const first=f.send(action);await new Promise(r=>setTimeout(r,25));
 const duplicate=f.send(action);assert.equal((await f.send({...action,requestId:randomUUID()})).status,409);
 release();const a=await(await first).json(),b=await(await duplicate).json();assert.deepEqual(a,b);assert.equal(effects,1);
 assert.deepEqual(await(await f.send(action)).json(),a);assert.equal(effects,1);
 assert.equal((await f.send({...action,requestId:randomUUID()})).status,429);
 }finally{release();await f.close();}});
test('Windows fixed executor denies missing confirmation, checks prior process and never accepts command input',async()=>{
 for(const response of ['7','-1','',null]){let launches=0;const p=await windowsCalculator({platform:'win32',call:async()=>launches++,psCall:async()=>{if(response===null)throw Error();return{stdout:response};}});assert.equal(p.status,'declined');assert.equal(launches,0);}
 let index=0,launches=0;const p=await windowsCalculator({platform:'win32',psCall:async()=>({stdout:['6','missing','observed'][index++]}),call:async(path,args,options)=>{launches++;assert.equal(path,'C:\\Windows\\System32\\calc.exe');assert.deepEqual(args,[]);assert.equal(options.shell,false);}});assert.equal(p.status,'done');assert.equal(launches,1);
 index=0;const prior=await windowsCalculator({platform:'win32',psCall:async()=>({stdout:['6','observed'][index++]}),call:async()=>{throw Error('must not launch');}});assert.equal(prior.status,'uncertain');
});
test('PC receipts reject future, stale, extra fields and dishonest status combinations',()=>{
 const p={version:1,requestId:randomUUID(),session:randomUUID(),action:'health',status:'done',checkedAt:new Date().toISOString(),verification:'loopback_response'};assert.ok(validPcReceipt(p));for(const bad of [{...p,secret:'x'},{...p,status:'connected'},{...p,action:'shell'},{...p,checkedAt:'bad'},{...p,checkedAt:'2020-01-01T00:00:00Z'},{...p,verification:'process_observed'}])assert.equal(validPcReceipt(bad),false);
});
