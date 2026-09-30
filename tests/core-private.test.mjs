import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {sameOrigin,safeFilename} from '../app/lib/attachment-validation.ts';
test('CORE is encrypted, owner-scoped, backed up and absent from normal settings',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(await readFile(new URL('../drizzle/0000_morice.sql',import.meta.url),'utf8'));
 const f={uid:'alice',sameOrigin,safeFilename};const k=crypto.randomUUID();globalThis[k]=f;
 f.runtimeValue=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));f.runtimeValue=()=>key;
 f.env={DB:{prepare(query){return{bind(...v){return{async first(){return sql.prepare(query).get(...v)||null;},async run(){const r=sql.prepare(query).run(...v);return{meta:{changes:Number(r.changes)}};},async all(){return{results:sql.prepare(query).all(...v)};}};}};},async batch(items){sql.exec('BEGIN');try{for(const i of items)await i.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}}};
 f.userId=()=>f.uid;f.now=()=>new Date().toISOString();
 async function load(path,prefix){const s=(await readFile(new URL(`../${path}`,import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(prefix+s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
 try {
  const cipher=await load('app/lib/secret-crypto.ts',`const {runtimeValue}=globalThis[${JSON.stringify(k)}];\n`);Object.assign(f,cipher);
  const route=await load('app/api/core/route.ts',`const {env,userId,now,encryptSecret,decryptSecret,sameOrigin,safeFilename}=globalThis[${JSON.stringify(k)}];\n`);
  const original='Private synthetic CORE. Human approval is required before any sensitive action.';
  async function put(text){const body=new FormData();body.set('file',new File([text],'REFERENCE.txt'));return route.POST(new Request('https://morice.test/api/core',{method:'POST',body}));}
  assert.equal((await put(original)).status,200);
  const stored=sql.prepare("SELECT value FROM morice_settings WHERE key='core_context'").get().value;assert.ok(!stored.includes('Private synthetic'));assert.equal(JSON.parse(await cipher.decryptSecret(stored)).text,original);
  f.uid='bob';assert.equal((await (await route.GET(new Request('https://morice.test/api/core'))).json()).configured,false);
  f.uid='alice';assert.equal((await put(original+' Updated.')).status,200);
  const backup=sql.prepare("SELECT value FROM morice_settings WHERE key='core_context_previous'").get().value;assert.equal(JSON.parse(await cipher.decryptSecret(backup)).text,original);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM morice_settings WHERE user_id='alice' AND key NOT LIKE 'core_%'").get().n,0);
 }finally{sql.close();delete globalThis[k];}
});
