import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { ActionError, actionFailure } from '../app/lib/action-error.ts';
import { boundedHistory, planningError } from '../app/lib/assistant-context.ts';
import { inspectMailbox, mailReviewText, isExplicitMailPreview } from '../app/lib/mail-triage.ts';
import { CategoryExecutionError, categoryPermissions, validateCategoryPlan, applyCategoryPlan } from '../app/lib/mail-categories.ts';

// Run the real route SQL against SQLite; only the Cloudflare transport and
// external providers are substituted. No real email/webhook is sent.
async function fixture() {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['0000_morice', '0001_connections_actions', '0002_conversation_history', '0004_ancient_micromax']) sql.exec(await readFile(new URL(`../drizzle/${file}.sql`, import.meta.url), 'utf8'));
  const key = crypto.randomUUID();
  const f = { sql, sent: 0, failConfirmation: false, vars: { OPENAI_API_KEY: 'test-only' }, ActionError, actionFailure, boundedHistory, planningError, inspectMailbox, mailReviewText, isExplicitMailPreview, CategoryExecutionError, categoryPermissions, validateCategoryPlan, applyCategoryPlan };
  f.env = { DB: {
    prepare(query) {
      return { query, bind(...values) {
        return { query, async first() { return sql.prepare(query).get(...values) ?? null; }, async all() { return { results: sql.prepare(query).all(...values) }; }, async run() { const r = sql.prepare(query).run(...values); return { meta: { changes: Number(r.changes) } }; } };
      } };
    },
    async batch(statements) {
      if (f.failConfirmation && statements.some(s => s.query.includes("status='executed'"))) throw new Error('Simulated persistence outage');
      sql.exec('BEGIN');
      try { const result = []; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  } };
  f.runMicrosoftAction = f.runMakeAction = async () => { f.sent++; return 'Provider accepted'; };
  f.fetch = async (_url, init) => {
    f.lastInput = JSON.parse(init.body);
    return Response.json({ status: 'completed', output_text: JSON.stringify({ intent: 'answer', title: 'Réponse', reply: '42', payload: {} }) });
  };
  globalThis[key] = f;
  f.route = async path => {
    let source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    source = source.replace(/^import .*;\r?\n/gm, '');
    source = `const f = globalThis[${JSON.stringify(key)}]; const {env,ActionError,actionFailure,boundedHistory,planningError,inspectMailbox,mailReviewText,isExplicitMailPreview,CategoryExecutionError,categoryPermissions,validateCategoryPlan,applyCategoryPlan} = f;
      const now=()=>new Date().toISOString(), userId=r=>r.headers.get('test-user') || 'alice', runtimeValue=n=>f.vars[n] || '';
      ${path.endsWith('/microsoft.ts') ? '' : 'const runMicrosoftAction=(...a)=>f.runMicrosoftAction(...a), runMakeAction=(...a)=>f.runMakeAction(...a);'}
      const connection=(...a)=>f.microsoftConnection(...a);
      const fetch=(...a)=>f.fetch(...a);
      const decryptSecret=async v=>v, encryptSecret=async v=>v;
      ` + source;
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  };
  f.microsoftConnection = (await f.route('app/lib/microsoft-accounts.ts')).microsoftConnection;
  f.pending = (uid='alice') => {
    sql.prepare("INSERT INTO morice_items VALUES('action',?,'approval','Test','Details','pending','normal',0,'now','now')").run(uid);
    sql.prepare("INSERT INTO morice_action_payloads VALUES('action',?,'microsoft','mail_send','{}','','now',NULL)").run(uid);
  };
  f.status = () => sql.prepare("SELECT status FROM morice_items WHERE id='action'").get().status;
  f.close = () => { sql.close(); delete globalThis[key]; };
  return f;
}

test('additional mailbox is isolated by owner and never falls back to the primary account', async () => {
  const f = await fixture();
  try {
    const expiry = new Date(Date.now()+3600000).toISOString();
    f.sql.prepare("INSERT INTO morice_connections VALUES('alice','microsoft','primary','refresh',?,'primary@example.invalid','Mail.ReadWrite','connected','now')").run(expiry);
    f.sql.prepare("INSERT INTO morice_microsoft_accounts VALUES('alice','second','secondary','refresh',?,'second@example.invalid','Mail.ReadWrite','connected','now')").run(expiry);
    assert.equal((await f.microsoftConnection('alice')).access_token, 'primary');
    assert.equal((await f.microsoftConnection('alice','second')).access_token, 'secondary');
    assert.equal(await f.microsoftConnection('bob','second'), null);
    const ms = await f.route('app/lib/microsoft.ts');
    f.fetch = async (_url, init) => { assert.equal(init.headers.Authorization, 'Bearer secondary'); return Response.json({value:[]}); };
    assert.match(await ms.runMicrosoftAction('alice','mail_read',{accountId:'second'}), /Aucun mail/);
    await assert.rejects(ms.runMicrosoftAction('bob','mail_read',{accountId:'second'}), /reconnecté/);
    await assert.rejects(ms.runMicrosoftAction('alice','todo_create',{accountId:'second'}), /compte principal/);
  } finally { f.close(); }
});

test('OAuth for another mailbox preserves the primary connection and reconnects idempotently', async () => {
  const f = await fixture();
  try {
    f.vars.MICROSOFT_CLIENT_ID='test'; f.vars.MICROSOFT_CLIENT_SECRET='test';
    f.sql.prepare("INSERT INTO morice_connections VALUES('alice','microsoft','primary','refresh','2099','primary@example.invalid','Mail.ReadWrite','connected','now')").run();
    f.fetch = async (url, init) => url.includes('/token') ? Response.json({access_token:'secondary',refresh_token:'r',expires_in:3600,scope:'Mail.ReadWrite'}) : Response.json(init.headers.Authorization === 'Bearer primary' ? {id:'primary-id'} : {id:'secondary-id',mail:'second@example.invalid'});
    const callback=await f.route('app/api/microsoft/callback/route.ts');
    const request=()=>new Request('https://morice.example/api/microsoft/callback?state=state&code=code',{headers:{cookie:'morice_ms_state=state; morice_ms_verifier=verifier'}});
    for(let i=0;i<2;i++) assert.match((await callback.GET(request())).headers.get('location'),/microsoft=connected/);
    assert.equal((await f.microsoftConnection('alice')).access_token,'primary');
    assert.equal((await f.microsoftConnection('alice','secondary-id')).access_token,'secondary');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM morice_microsoft_accounts').get().n,1);
    f.fetch=async url=>url.includes('/token') ? Response.json({access_token:'bad',refresh_token:'bad'}) : Response.json({error:'failed'},{status:403});
    assert.match((await callback.GET(request())).headers.get('location'),/microsoft=error/);
    assert.equal((await f.microsoftConnection('alice','secondary-id')).access_token,'secondary');
  } finally { f.close(); }
});

test('refreshing an additional account cannot overwrite primary or another owner tokens', async () => {
  const f = await fixture();
  try {
    f.vars.MICROSOFT_CLIENT_ID='test'; f.vars.MICROSOFT_CLIENT_SECRET='test';
    f.sql.prepare("INSERT INTO morice_connections VALUES('alice','microsoft','primary','refresh','2099','primary@example.invalid','','connected','now')").run();
    for(const owner of ['alice','bob']) f.sql.prepare("INSERT INTO morice_microsoft_accounts VALUES(?,'second','expired','refresh','2000','second@example.invalid','','connected','now')").run(owner);
    f.fetch=async (url,init)=>{ if(url.includes('/token')) return Response.json({access_token:'renewed',refresh_token:'new-refresh',expires_in:3600}); assert.equal(init.headers.Authorization,'Bearer renewed'); return Response.json({value:[]}); };
    const ms=await f.route('app/lib/microsoft.ts');
    await ms.runMicrosoftAction('alice','mail_read',{accountId:'second'});
    assert.equal((await f.microsoftConnection('alice','second')).access_token,'renewed');
    assert.equal((await f.microsoftConnection('bob','second')).access_token,'expired');
    assert.equal((await f.microsoftConnection('alice')).access_token,'primary');
  } finally { f.close(); }
});
const request = (body, uid='alice') => new Request('https://morice.test/api', { method: 'POST', headers: { 'Content-Type': 'application/json', 'test-user': uid }, body: JSON.stringify(body) });

test('concurrent confirmations dispatch the external action exactly once', async () => {
  const f=await fixture(); try {
    f.pending(); const route=await f.route('app/api/actions/execute/route.ts');
    const responses=await Promise.all([route.POST(request({id:'action'})), route.POST(request({id:'action'}))]);
    assert.deepEqual(responses.map(r=>r.status).sort(), [200,409]); assert.equal(f.sent,1); assert.equal(f.status(),'executed');
  } finally { f.close(); }
});
test('lost provider response is visible and cannot be retried or reset through state API', async () => {
  const f=await fixture(); try {
    f.pending(); f.runMicrosoftAction=async()=>{f.sent++; throw new TypeError('connection lost after sending');};
    const route=await f.route('app/api/actions/execute/route.ts');
    assert.equal((await route.POST(request({id:'action'}))).status,502); assert.equal(f.status(),'needs_review');
    assert.equal((await route.POST(request({id:'action'}))).status,409); assert.equal(f.sent,1);
    const state=await f.route('app/api/state/route.ts');
    assert.equal((await state.POST(request({action:'status',id:'action',status:'open'}))).status,409);
    const data=await (await state.GET(new Request('https://morice.test/api'))).json();
    assert.match(data.items.find(i=>i.id==='action').execution.result,/vérifier/);
  } finally { f.close(); }
});
test('proven pre-dispatch failure stays pending and another user cannot claim it', async () => {
  const f=await fixture(); try {
    f.pending(); f.runMicrosoftAction=async()=>{throw new ActionError('Reconnect Microsoft',true);};
    const route=await f.route('app/api/actions/execute/route.ts');
    assert.equal((await route.POST(request({id:'action'},'bob'))).status,404);
    assert.equal((await route.POST(request({id:'action'}))).status,502); assert.equal(f.status(),'pending'); assert.equal(f.sent,0);
  } finally { f.close(); }
});
test('database failure after external success never enables another dispatch', async () => {
  const f=await fixture(); try {
    f.pending(); f.failConfirmation=true; const route=await f.route('app/api/actions/execute/route.ts');
    assert.equal((await route.POST(request({id:'action'}))).status,500); assert.equal(f.status(),'executing');
    assert.equal((await route.POST(request({id:'action'}))).status,409); assert.equal(f.sent,1);
  } finally { f.close(); }
});
test('conversation persists across route instances and only owner memory reaches model', async () => {
  const f=await fixture(); try {
    const route=await f.route('app/api/assistant/route.ts');
    await route.POST(request({message:'Mon code de test est LILAS',mode:'memory'}));
    await route.POST(request({message:'Secret Bob',mode:'memory'},'bob'));
    await route.POST(request({message:'Vérifier le suivi projet',mode:'task'}));
    const result=await route.POST(request({message:'Quel est mon code de test ?',mode:'auto'}));
    assert.equal(result.status,200); const sent=JSON.stringify(f.lastInput);
    assert.match(sent,/LILAS/); assert.match(sent,/task, open/); assert.doesNotMatch(sent,/Secret Bob/); assert.equal(f.lastInput.store,false);
    const data=await (await route.GET(new Request('https://morice.test/api'))).json(); assert.equal(data.messages.length,6);
    assert.equal(data.messages[0].role,'user'); assert.equal(data.messages[1].role,'assistant');
    assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM morice_items WHERE user_id='alice' AND kind='task'").get().n,1);
  } finally { f.close(); }
});
test('incomplete and quota responses create no task, action or successful history', async () => {
  const f=await fixture(); try {
    const route=await f.route('app/api/assistant/route.ts');
    for(const response of [Response.json({status:'incomplete'}),Response.json({error:{code:'insufficient_quota'}},{status:429})]) {
      f.fetch=async()=>response;
      assert.equal((await route.POST(request({message:'Une question',mode:'auto'}))).status,502);
    }
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM morice_items').get().n,0);
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM morice_messages').get().n,0);
  } finally { f.close(); }
});
test('Microsoft distinguishes preflight, explicit rejection and ambiguous transport failure', async () => {
  const f=await fixture(); try {
    const ms=await f.route('app/lib/microsoft.ts');
    await assert.rejects(()=>ms.runMicrosoftAction('alice','mail_send',{}),e=>e.retrySafe===true);
    f.sql.prepare("INSERT INTO morice_connections VALUES('alice','microsoft','test-access','test-refresh','2099-01-01','test@example.invalid','','connected','now')").run();
    f.fetch=async()=>Response.json({},{status:403});
    await assert.rejects(()=>ms.runMicrosoftAction('alice','mail_send',{to:'test@example.invalid'}),e=>e.retrySafe===true);
    f.fetch=async()=>{throw new TypeError('lost response');};
    await assert.rejects(()=>ms.runMicrosoftAction('alice','mail_send',{to:'test@example.invalid'}),e=>actionFailure(e).status==='needs_review');
    f.fetch=async()=>new Response(null,{status:202});
    assert.match(await ms.runMicrosoftAction('alice','mail_send',{to:'test@example.invalid'}),/accepté.*reste à vérifier/);
  } finally { f.close(); }
});

test('direct Microsoft reading forbids write operations and passes only authenticated owner', async () => {
  const f=await fixture(); try {
    const route=await f.route('app/api/microsoft/read/route.ts');
    assert.equal((await route.GET(new Request('https://morice.test/api?operation=mail_send'))).status,400);
    assert.equal(f.sent,0);
    f.runMicrosoftAction=async (uid,operation)=>{assert.equal(uid,'bob');assert.equal(operation,'calendar_read');return 'Calendar verified';};
    const response=await route.GET(new Request('https://morice.test/api',{headers:{'test-user':'bob'}}));
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).result,'Calendar verified');
  } finally { f.close(); }
});

test('mail triage uses the authenticated mailbox and performs only a Graph GET', async () => {
  const f=await fixture();try {
    f.sql.prepare("INSERT INTO morice_connections VALUES('alice','microsoft','test-access','test-refresh','2099-01-01','alice@example.invalid','','connected','now')").run();
    const ms=await f.route('app/lib/microsoft.ts');let reads=0;
    f.fetch=async(url,init)=>{reads++;assert.equal(init.method,undefined);assert.match(url,/graph.microsoft.com\/v1.0\/me\/mailFolders\/inbox\/messages/);return Response.json({value:[{subject:'Facture notaire'}]});};
    await assert.rejects(()=>ms.reviewMicrosoftMailbox('bob'),/Connecte/);assert.equal(reads,0);
    const result=await ms.reviewMicrosoftMailbox('alice');assert.equal(result.account,'alice@example.invalid');assert.equal(reads,1);
    assert.equal(result.messages[0].suggestions.length,2);
  }finally{f.close();}
});
