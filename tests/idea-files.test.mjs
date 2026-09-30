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
