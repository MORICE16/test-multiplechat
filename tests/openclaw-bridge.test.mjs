import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge, readHealth, readNodes, summarizeNodes, HEALTH_URL, STATUS_ARGS } from '../integrations/openclaw-readonly/bridge.mjs';

test('read-only bridge rejects unknown tools and every model-supplied argument before execution',async()=>{
  let calls=0;const call=createBridge({health:async()=>{calls++;return {healthy:true};},nodes:async()=>{calls++;return {nodes:[]};}});
  for(const [name,args] of [['exec',{}],['morice_openclaw_nodes',{command:'system.run'}],['morice_openclaw_health',{url:'https://example.org'}],['morice_openclaw_health',null],['morice_openclaw_nodes',[]]]){
    assert.equal((await call(name,args)).isError,true);
  }
  assert.equal(calls,0);
  assert.equal((await call('morice_openclaw_health',{})).structuredContent.healthy,true);assert.equal(calls,1);
});
test('node status contains only the approved fields and preserves unknown booleans',()=>{
  const output=summarizeNodes({token:'PRIVATE',nodes:[{nodeId:'a'.repeat(64),displayName:'Fold\u0000',platform:'android',version:'2026.7.1',paired:true,connected:false,remoteIp:'PRIVATE',commands:['system.run'],location:'PRIVATE',token:'PRIVATE'},{}]});
  assert.equal(JSON.stringify(output).includes('PRIVATE'),false);
  assert.equal(output.nodes[0].connected,false);assert.equal(output.nodes[1].connected,null);
  assert.deepEqual(Object.keys(output.nodes[0]).sort(),['connected','displayName','nodeId','paired','platform','version']);
  assert.throws(()=>summarizeNodes({nodes:'invalid'}));
});
test('health uses one fixed local GET, disallows redirects, bounds and validates its response',async()=>{
  let calls=0;
  const result=await readHealth(async(url,init)=>{calls++;assert.equal(url,HEALTH_URL);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.ok(init.signal);return Response.json({ok:true,token:'PRIVATE'});});
  assert.deepEqual(result,{healthy:true});assert.equal(calls,1);
  await assert.rejects(readHealth(async()=>new Response('x'.repeat(16385))),/large/);
  await assert.rejects(readHealth(async()=>Response.json({ok:'yes'})),/Invalid/);
});
test('node reader uses the exact CLI argument vector without a shell and redacts process failures',async()=>{
  const cli=process.platform==='win32'?'C:/OpenClaw/openclaw.mjs':'/OpenClaw/openclaw.mjs';
  let calls=0;
  const execute=(command,args,options,done)=>{
    calls++;assert.equal(command,process.execPath);assert.deepEqual(args,[cli,...STATUS_ARGS]);
    assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert.ok(options.maxBuffer<=262144);assert.ok(options.timeout<=45000);
    done(null,JSON.stringify({nodes:[]}));
  };
  assert.deepEqual(await readNodes(cli,execute),{nodes:[]});
  await assert.rejects(readNodes('relative.mjs',execute));assert.equal(calls,1);
  await assert.rejects(readNodes(cli,(_a,_b,_c,done)=>done(Error('PRIVATE token'))),{message:'Node status unavailable'});
});
test('overlapping requests do not spawn another command and failed reads never leak raw errors',async()=>{
  let resolve;let calls=0;const events=[];
  const call=createBridge({nodes:async()=>{calls++;await new Promise(r=>{resolve=r;});throw Error('PRIVATE credential and path');},audit:e=>events.push(e)});
  const first=call('morice_openclaw_nodes',{});
  assert.equal((await call('morice_openclaw_nodes',{})).isError,true);assert.equal(calls,1);
  resolve();const result=await first;assert.equal(result.isError,true);
  assert.ok(!JSON.stringify([result,events]).includes('PRIVATE'));
  const cancelled=new AbortController();cancelled.abort();assert.equal((await call('morice_openclaw_nodes',{},cancelled.signal)).isError,true);assert.equal(calls,1);
});
