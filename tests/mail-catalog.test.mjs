import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureCategoryCatalog,MAIL_CATEGORIES,CategoryExecutionError} from '../app/lib/mail-categories.ts';
import {suggestMail} from '../app/lib/mail-triage.ts';
test('category library preserves existing labels and verifies all fixed names without touching messages',async()=>{
 const labels=new Set(['Private existing label']);const writes=[];
 const graph=async(path,init)=>{assert.ok(path.startsWith('/me/outlook/masterCategories'));if(init?.method==='POST'){const body=JSON.parse(init.body);assert.ok(MAIL_CATEGORIES.includes(body.displayName));labels.add(body.displayName);writes.push(body.displayName);return body;}return{value:[...labels].map(displayName=>({displayName}))};};
 assert.match(await ensureCategoryCatalog(graph,async()=>{}),/13 catégories Outlook disponibles et relues/);assert.equal(writes.length,13);assert.ok(labels.has('Private existing label'));await ensureCategoryCatalog(graph,async()=>{});assert.equal(writes.length,13);
 assert.ok(MAIL_CATEGORIES.includes('Juridique / Avocat'));assert.ok(MAIL_CATEGORIES.includes('Immobilier / Locataires'));assert.deepEqual(suggestMail({subject:'Convocation du cabinet avocat'}).suggestions,['Juridique / Avocat']);
});
test('ambiguous category creation stops without retry and never reports success',async()=>{
 let creates=0;await assert.rejects(()=>ensureCategoryCatalog(async(_path,init)=>{if(init?.method==='POST'){creates++;throw Error('SECRET provider detail');}return{value:[]};},async()=>{}),error=>error instanceof CategoryExecutionError&&!error.message.includes('SECRET')&&error.message.includes('peut avoir abouti'));assert.equal(creates,1);
 let reads=0;await assert.rejects(()=>ensureCategoryCatalog(async()=>{reads++;return{value:[],'@odata.nextLink':'untrusted'};},async()=>{}),CategoryExecutionError);assert.equal(reads,1);
});

test('category setup and assignment reuse case and Unicode equivalents instead of creating duplicates',async()=>{
 const {applyCategoryPlan}=await import('../app/lib/mail-categories.ts');let writes=0;
 const names=MAIL_CATEGORIES.map(n=>n.normalize('NFD').toLocaleLowerCase('fr'));
 const read=async()=>({value:names.map(displayName=>({displayName}))});
 await ensureCategoryCatalog(async(path,init)=>{assert.ok(!init?.method);return read();},async()=>{});
 const result=await applyCategoryPlan({account:'test@example.invalid',createdAt:new Date().toISOString(),entries:[{id:'one',subject:'Test',category:'Juridique / Notaire'}]},async(path,init)=>{
  if(init?.method){writes++;throw Error('Must not write');}if(path.includes('masterCategories'))return read();return{categories:['juridique / notaire']};
 },async()=>{});
 assert.equal(writes,0);assert.match(result,/1 message/);
});
