import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCategoryPlan, validateCategoryPlan, categoryPermissions, CategoryExecutionError } from '../app/lib/mail-categories.ts';
const plan = () => ({account:'test@example.invalid',createdAt:new Date().toISOString(),entries:[{id:'a/b',subject:'Facture',category:'Comptabilité / Factures'}]});
test('category plans reject changed account, expiry, duplicate ids, invalid category and oversized batch',()=>{
  validateCategoryPlan(plan(),'test@example.invalid');
  for(const p of [{...plan(),account:'other'}, {...plan(),createdAt:'2020-01-01'}, {...plan(),entries:[...plan().entries,...plan().entries]}, {...plan(),entries:[{...plan().entries[0],category:'unexpected'}]}, {...plan(),entries:Array.from({length:11},(_,i)=>({...plan().entries[0],id:String(i)}))}]) assert.throws(()=>validateCategoryPlan(p,'test@example.invalid'));
  assert.deepEqual(categoryPermissions('Mail.Read https://graph.microsoft.com/Mail.ReadWrite MailboxSettings.ReadWrite'),{writeMail:true,manageCategories:true});
  assert.equal(categoryPermissions('Mail.ReadWrite.All').writeMail,false);
});
test('real category path preserves existing labels, uses version guard and verifies readback',async()=>{
  let categories=['Personnel']; const writes=[]; const progress=[];
  const result=await applyCategoryPlan(plan(),async(path,init)=>{
    if(path.includes('masterCategories')) { if(init) {writes.push(JSON.parse(init.body));return{};} return {value:[]}; }
    assert.ok(path.startsWith('/me/messages/a%2Fb'));
    if(init) { assert.equal(init.headers['If-Match'],'W/"version"'); writes.push(JSON.parse(init.body)); categories=JSON.parse(init.body).categories;return{}; }
    return {categories:[...categories],'@odata.etag':'W/"version"'};
  },async text=>progress.push(text));
  assert.deepEqual(categories,['Personnel','Comptabilité / Factures']);
  assert.equal(writes.length,2);assert.match(result,/1 message/);assert.ok(progress.length>=3);
});
test('existing category is not written twice',async()=>{
  await applyCategoryPlan(plan(),async(path,init)=>{
    assert.equal(init,undefined);
    return path.includes('masterCategories') ? {value:[{displayName:'Comptabilité / Factures'}]} : {categories:['Comptabilité / Factures']};
  },async()=>{});
});
test('missing version, write rejection, lost response and failed readback block retries',async()=>{
  for(const mode of ['missing-version','conflict','lost-response','readback']) {
    let patches=0;
    await assert.rejects(()=>applyCategoryPlan(plan(),async(path,init)=>{
      if(path.includes('masterCategories')) return {value:[{displayName:'Comptabilité / Factures'}]};
      if(init) {patches++;if(mode!=='readback') throw new Error('failure');return{};}
      return {categories:['Personnel'],...(mode==='missing-version'?{}:{'@odata.etag':'v1'})};
    },async()=>{}),error=>error instanceof CategoryExecutionError && /0\/1/.test(error.message));
    assert.equal(patches,mode==='missing-version'?0:1);
  }
});
test('partial batch failure reports confirmed count and never touches following messages',async()=>{
  const p=plan();p.entries.push({id:'second',subject:'Second',category:'Personnel'},{id:'third',subject:'Third',category:'Personnel'});
  await assert.rejects(()=>applyCategoryPlan(p,async(path)=>{
    assert.doesNotMatch(path,/third/);
    if(path.includes('masterCategories')) return {value:[{displayName:'Comptabilité / Factures'},{displayName:'Personnel'}]};
    if(path.includes('second')) throw new Error('offline');
    return {categories:['Comptabilité / Factures']};
  },async()=>{}),/1\/3/);
});
