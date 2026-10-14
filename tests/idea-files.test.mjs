import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {detectFile,safeFilename,sameOrigin,MAX_FILE_BYTES,MAX_ATTACHMENTS} from '../app/lib/attachment-validation.ts';
import {ideaResult} from '../app/lib/idea-result.ts';
const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
const pdf=new TextEncoder().encode('%PDF-1.4\nsynthetic test');
test('image and PDF are classified by bytes; executable and oversized uploads rejected',()=>{
  assert.equal(detectFile(png),'image/png');assert.equal(detectFile(pdf),'application/pdf');
  assert.throws(()=>detectFile(new TextEncoder().encode('<svg onload="attack"/>')));
  assert.throws(()=>detectFile(new Uint8Array(MAX_FILE_BYTES+1)));
  assert.equal(safeFilename('../secret\u0000.pdf'),'.._secret_.pdf');
  assert.equal(sameOrigin(new Request('https://morice.test/api/files',{headers:{Origin:'https://evil.test'}})),false);
});
test('analysis proof requires completed provider response and actual output text',()=>{
  assert.throws(()=>ideaResult({id:'resp_a',status:'in_progress'}));
  assert.throws(()=>ideaResult({id:'resp_a',status:'completed',output:[]}));
  assert.equal(ideaResult({id:'resp_a',status:'completed',output:[{content:[{type:'output_text',text:'Le document indique 42.'}]}]}).text,'Le document indique 42.');
});
async function fixture() {
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0000_morice','0003_jobs','0005_organic_triathlon']) sql.exec(await readFile(new URL(`../drizzle/${name}.sql`,import.meta.url),'utf8'));
  const objects=new Map();const f={uid:'alice',starts:0,detectFile,safeFilename,sameOrigin,MAX_FILE_BYTES,MAX_ATTACHMENTS};
  f.env={DB:{prepare(query){return{bind(...values){return{async run(){const r=sql.prepare(query).run(...values);return{meta:{changes:Number(r.changes)}};},async first(){return sql.prepare(query).get(...values)||null;},async all(){return{results:sql.prepare(query).all(...values)};}};}};},async batch(items){sql.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}},FILES:{async put(k,bytes){objects.set(k,bytes);},async get(k){const b=objects.get(k);return b?{body:b,arrayBuffer:async()=>b.buffer}:null;},async delete(k){objects.delete(k);}}};
  f.startIdea=async()=>{f.starts++;};f.userId=()=>f.uid;f.now=()=>new Date().toISOString();
  const key=crypto.randomUUID();globalThis[key]=f;
  async function route(path){let s=await readFile(new URL(`../${path}`,import.meta.url),'utf8');s=s.replace(/^import .*;\r?\n/gm,'');const prefix=`const {env,userId,now,detectFile,safeFilename,sameOrigin,MAX_FILE_BYTES,MAX_ATTACHMENTS,startIdea}=globalThis[${JSON.stringify(key)}];\n`;return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(prefix+s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
  return{f,sql,objects,upload:await route('app/api/files/route.ts'),file:await route('app/api/files/[id]/route.ts'),idea:await route('app/api/ideas/route.ts'),close(){sql.close();delete globalThis[key];}};
}
test('private upload, owner isolation, removal and idea idempotency use real route SQL',async()=>{
  const x=await fixture();try{
    const ids=[];
    for(const [name,bytes] of [['image.png',png],['document.pdf',pdf]]){const form=new FormData();form.set('file',new File([bytes],name));const r=await x.upload.POST(new Request('https://morice.test/api/files',{method:'POST',body:form}));assert.equal(r.status,201);ids.push((await r.json()).id);}
    const ctx=id=>({params:Promise.resolve({id})});const get=new Request('https://morice.test/api/files');
    x.f.uid='bob';assert.equal((await x.file.GET(get,ctx(ids[0]))).status,404);
    x.f.uid='alice';assert.equal((await x.file.GET(get,ctx(ids[1]))).headers.get('Content-Type'),'application/pdf');
    const id=crypto.randomUUID();const body=JSON.stringify({id,text:'Analyser les deux pièces de test.',files:ids});const req=()=>new Request('https://morice.test/api/ideas',{method:'POST',body});
    assert.equal((await x.idea.POST(req())).status,202);assert.equal((await x.idea.POST(req())).status,200);assert.equal(x.f.starts,1);
    assert.equal((await x.idea.POST(new Request('https://morice.test/api/ideas',{method:'POST',body:JSON.stringify({id,text:'Different request',files:ids})}))).status,409);assert.equal(x.f.starts,1);
    assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM morice_items WHERE kind=\'memory\'').get().n,1);
    assert.equal((await x.file.DELETE(new Request('https://morice.test/api/files',{method:'DELETE'}),ctx(ids[0]))).status,409);
    assert.throws(()=>x.sql.prepare('UPDATE morice_files SET job_id=? WHERE id=?').run(crypto.randomUUID(),ids[0]),/claimed/);
  }finally{x.close();}
});

test('chunked multipart body is capped before decoding',async()=>{
 const x=await fixture();try{
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_FILE_BYTES+65537));controller.close();}});
 const response=await x.upload.POST(new Request('https://morice.test/api/files',{method:'POST',body:stream,duplex:'half',headers:{'Content-Type':'multipart/form-data; boundary=test'}}));
 assert.equal(response.status,413);assert.equal(x.objects.size,0);
 }finally{x.close();}
});

test('private archive persists files without starting AI, retries safely and cannot switch mode',async()=>{
 const x=await fixture();try{
  const ids=[];
  for(const [name,bytes] of [['image.png',png],['document.pdf',pdf]]){
   const form=new FormData();form.set('file',new File([bytes],name));
   const r=await x.upload.POST(new Request('https://morice.test/api/files',{method:'POST',body:form}));ids.push((await r.json()).id);
  }
  const id=crypto.randomUUID();const body={id,text:'Conserver ces pièces sans analyse.',files:ids,analyze:false};
  const req=value=>new Request('https://morice.test/api/ideas',{method:'POST',body:JSON.stringify(value)});
  assert.equal((await x.idea.POST(req(body))).status,202);
  assert.equal(x.f.starts,0);
  const job=x.sql.prepare('SELECT * FROM morice_jobs WHERE id=?').get(id);
  assert.equal(job.operation,'idea_archive');assert.equal(job.status,'done');assert.equal(job.response_id,'');
  assert.match(job.result,/Aucune analyse IA/);assert.equal(JSON.parse(job.evidence).tool,'Morice · stockage privé');
  assert.equal((await x.idea.POST(req(body))).status,200);
  assert.equal((await x.idea.POST(req({...body,analyze:true}))).status,409);
  assert.equal((await x.idea.POST(req({...body,id:crypto.randomUUID(),analyze:'false'}))).status,400);
  assert.equal(x.f.starts,0);assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM morice_job_events WHERE job_id=?').get(id).n,1);
  for(const fileId of ids){
   const response=await x.file.GET(new Request('https://morice.test/api/files'),{params:Promise.resolve({id:fileId})});
   assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>0);
  }
  x.f.uid='bob';assert.equal((await x.file.GET(new Request('https://morice.test/api/files'),{params:Promise.resolve({id:ids[0]})})).status,404);
  assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM morice_items WHERE kind='memory'").get().n,1);
 }finally{x.close();}
});

test('private file listing isolates owners, omits unclaimed files and bounds literal name search',async()=>{
 const x=await fixture();try{
  const put=x.sql.prepare('INSERT INTO morice_files(id,user_id,name,mime,size,sha256,object_key,created_at,job_id) VALUES(?,?,?,?,?,?,?,?,?)');
  for(let i=0;i<55;i++)put.run(crypto.randomUUID(),'alice',`archive-${String(i).padStart(2,'0')}.pdf`,'application/pdf',12,'hash','private/synthetic','2026-10-14T00:00:00Z','claimed');
  put.run(crypto.randomUUID(),'alice','100%_ready.pdf','application/pdf',12,'hash','private/synthetic','2026-10-14T00:00:00Z','claimed');
  put.run(crypto.randomUUID(),'alice','unclaimed.pdf','application/pdf',12,'hash','private/synthetic','2026-10-14T00:00:00Z','');
  put.run(crypto.randomUUID(),'bob','other-owner.pdf','application/pdf',12,'hash','private/synthetic','2026-10-14T00:00:00Z','claimed');
  const req=query=>new Request('https://morice.test/api/files?query='+encodeURIComponent(query));
  const response=await x.upload.GET(req(''));assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const data=await response.json();assert.equal(data.files.length,50);assert.equal(data.hasMore,true);
  assert.doesNotMatch(JSON.stringify(data),/object_key|sha256|other-owner|unclaimed/);
  const exact=await(await x.upload.GET(req('%_'))).json();assert.deepEqual(exact.files.map(f=>f.name),['100%_ready.pdf']);assert.equal(exact.hasMore,false);
  assert.equal((await x.upload.GET(req('x'.repeat(121)))).status,400);
  assert.equal((await x.upload.GET(req('bad\u0000name'))).status,400);
  assert.equal((await(await x.upload.GET(req('missing'))).json()).files.length,0);
  x.f.uid='bob';const other=await(await x.upload.GET(req(''))).json();assert.deepEqual(other.files.map(f=>f.name),['other-owner.pdf']);
 }finally{x.close();}
});
