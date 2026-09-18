import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { webResult, safeWebUrl } from '../app/lib/web-result.ts';
import { synthesizeSpeech } from '../app/lib/speech.ts';

const completed = () => ({ id:'resp_test', status:'completed', output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Source officielle.',annotations:[{type:'url_citation',start_index:0,end_index:6,url:'https://example.org/source',title:'Source officielle'}]}]}] });
test('web results require a completed real tool call and safe citations',()=>{
  assert.throws(()=>webResult({status:'completed',output:[]}), /recherche Web/);
  const missing=completed();missing.output[1].content[0].annotations[0].url='javascript:alert(1)';
  assert.throws(()=>webResult(missing),/sourcé/);
  assert.equal(safeWebUrl('https://user:secret@example.org'),false);
  assert.equal(webResult(completed()).sources[0].url,'https://example.org/source');
  const multi=completed();multi.output[1].content.unshift({type:'output_text',text:'Introduction.'});
  assert.equal(webResult(multi).citations[0].start,14);
});
test('speech validates input, keeps provider errors private and returns playable media',async()=>{
  const request=text=>new Request('https://morice.test/api/speech',{method:'POST',body:JSON.stringify({text})});
  let calls=0;
  const send=async(_url,init)=>{calls++;assert.equal(JSON.parse(init.body).voice,'cedar');return new Response(new Uint8Array([73,68,51]),{headers:{'content-type':'audio/mpeg'}});};
  assert.equal((await synthesizeSpeech(request(''),'test',send)).status,400);
  assert.equal((await synthesizeSpeech(request('x'.repeat(4001)),'test',send)).status,400);
  assert.equal(calls,0);
  const audio=await synthesizeSpeech(request('Bonjour Alan'),'test',send);
  assert.equal(audio.headers.get('content-type'),'audio/mpeg');assert.equal((await audio.arrayBuffer()).byteLength,3);
  const failure=await synthesizeSpeech(request('Bonjour'),'test',async()=>new Response('PRIVATE PROVIDER DETAILS',{status:403}));
  assert.equal(failure.status,502);assert.ok(!(await failure.text()).includes('PRIVATE'));
});

async function fixture() {
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0002_conversation_history','0003_jobs']) sql.exec(await readFile(new URL(`../drizzle/${name}.sql`,import.meta.url),'utf8'));
  const f={sql,created:0,retrieved:0,failStart:false,failRead:false,response:completed(),webResult};
  f.env={DB:{prepare(query){return {bind(...args){return {run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};},async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)||null;}};}};},async batch(items){sql.exec('BEGIN');try{const out=items.map(item=>item.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
  f.createWebResponse=async()=>{f.created++;if(f.failStart)throw Error('Connection lost');return {id:'resp_test',status:'queued'};};
  f.retrieveWebResponse=async()=>{f.retrieved++;if(f.failRead)throw Error('Network offline');return f.response;};
  const key=crypto.randomUUID();globalThis[key]=f;
  let source=await readFile(new URL('../app/lib/jobs.ts',import.meta.url),'utf8');
  source=source.replace(/^import .*;\r?\n/gm,'');
  const prefix=`const {env,webResult,createWebResponse,retrieveWebResponse}=globalThis[${JSON.stringify(key)}]; const now=()=>new Date().toISOString();\n`;
  const code=ts.transpileModule(prefix+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  f.module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  f.job=id=>sql.prepare('SELECT * FROM morice_jobs WHERE id=?').get(id);
  f.close=()=>{sql.close();delete globalThis[key];};return f;
}
test('durable research claims once and saves result plus conversation after reconnect',async()=>{
  const f=await fixture();try {
    const {createJob,startResearch,refreshResearch}=f.module;
    const id=await createJob('alice','Recherche','Test','web_search');
    f.sql.prepare("INSERT INTO morice_messages(user_id,role,text,action,created_at) VALUES('alice','assistant','En cours',?,'now')").run(JSON.stringify({jobId:id}));
    await Promise.all([startResearch('alice',id,'Test'),startResearch('alice',id,'Test')]);assert.equal(f.created,1);
    assert.equal(f.job(id).status,'running');
    await refreshResearch('bob');assert.equal(f.retrieved,0);
    await Promise.all([refreshResearch('alice'),refreshResearch('alice')]);
    assert.equal(f.created,1);assert.equal(f.job(id).status,'done');
    assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM morice_job_events WHERE job_id=? AND status='done'").get(id).n,1);
    assert.equal(f.sql.prepare('SELECT text FROM morice_messages').get().text,'Source officielle.');
    assert.equal(JSON.parse(f.job(id).evidence).responseId,'resp_test');
  } finally {f.close();}
});
test('ambiguous submission is blocked without retry; another owner cannot claim it',async()=>{
  const f=await fixture();try {
    const id=await f.module.createJob('alice','Test','Query','web_search');
    await f.module.startResearch('bob',id,'Query');assert.equal(f.created,0);
    f.failStart=true;await f.module.startResearch('alice',id,'Query');assert.equal(f.job(id).status,'blocked');
    await f.module.refreshResearch('alice');await f.module.startResearch('alice',id,'Query');assert.equal(f.created,1);
  }finally{f.close();}
});
test('queued work resumes; a network failure only retries retrieval, never generation',async()=>{
  const f=await fixture();try {
    const id=await f.module.createJob('alice','Test','Query','web_search');
    await f.module.refreshResearch('alice');assert.equal(f.created,1);assert.equal(f.job(id).status,'running');
    f.failRead=true;await f.module.refreshResearch('alice');assert.equal(f.job(id).status,'running');assert.equal(f.job(id).response_id,'resp_test');
    f.failRead=false;await f.module.refreshResearch('alice');assert.equal(f.job(id).status,'done');assert.equal(f.created,1);
  }finally{f.close();}
});
test('completed but unsourced research is blocked rather than marked successful',async()=>{
  const f=await fixture();try {
    const id=await f.module.createJob('alice','Test','Query','web_search');await f.module.startResearch('alice',id,'Query');
    f.response={status:'completed',output:[]};await f.module.refreshResearch('alice');assert.equal(f.job(id).status,'blocked');assert.equal(f.job(id).result,'');
  }finally{f.close();}
});

test('failed conversation save rolls back completion and later recovers without another search',async()=>{
  const f=await fixture();try {
    const id=await f.module.createJob('alice','Test','Query','web_search');
    f.sql.prepare("INSERT INTO morice_messages(user_id,role,text,action,created_at) VALUES('alice','assistant','En cours',?,'now')").run(JSON.stringify({jobId:id}));
    await f.module.startResearch('alice',id,'Query');
    f.sql.exec("CREATE TRIGGER simulate_write_failure BEFORE UPDATE ON morice_messages BEGIN SELECT RAISE(ABORT,'temporary write failure'); END;");
    await f.module.refreshResearch('alice');
    assert.equal(f.job(id).status,'running');
    assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM morice_job_events WHERE status='done'").get().n,0);
    assert.equal(f.sql.prepare('SELECT text FROM morice_messages').get().text,'En cours');
    f.sql.exec('DROP TRIGGER simulate_write_failure');
    await f.module.refreshResearch('alice');
    assert.equal(f.job(id).status,'done');
    assert.equal(f.sql.prepare('SELECT text FROM morice_messages').get().text,'Source officielle.');
    assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM morice_job_events WHERE status='done'").get().n,1);
    assert.equal(f.created,1);
  } finally {f.close();}
});

test('late acknowledgements and stale timeouts cannot erase a completed result',async()=>{
  const f=await fixture();try {
    const id=await f.module.createJob('alice','Test','Query','web_search');
    await f.module.startResearch('alice',id,'Query');await f.module.refreshResearch('alice');
    const before=f.job(id);
    const events=f.sql.prepare('SELECT COUNT(*) n FROM morice_job_events WHERE job_id=?').get(id).n;
    await f.module.transitionJob('alice',id,'running','Delayed provider acknowledgement');
    await f.module.transitionJob('alice',id,'blocked','Stale timeout');
    assert.deepEqual(f.job(id),before);
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM morice_job_events WHERE job_id=?').get(id).n,events);
  } finally {f.close();}
});
test('unknown owners and duplicate transitions create no misleading job history',async()=>{
  const f=await fixture();try {
    const id=await f.module.createJob('alice','Test','Query','web_search');
    await f.module.transitionJob('bob',id,'done','Wrong owner');
    await f.module.transitionJob('alice','missing','done','Missing job');
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM morice_job_events').get().n,1);
    await f.module.transitionJob('alice',id,'running','Started');
    await f.module.transitionJob('alice',id,'running','Duplicate');
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM morice_job_events').get().n,2);
    await f.module.transitionJob('alice',id,'blocked','Unknown external outcome');
    await f.module.transitionJob('alice',id,'running','Late retry');
    assert.equal(f.job(id).status,'blocked');
  } finally {f.close();}
});
