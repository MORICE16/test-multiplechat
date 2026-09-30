import test from 'node:test';
import assert from 'node:assert/strict';
import {GOOGLE_SCOPES,verifyGoogleFlow,googleAccountProvider,googleFinish} from '../app/lib/google-oauth.ts';
test('Google requests read-only Gmail; flow rejects owner/state/expiry mismatch',()=>{
 assert.deepEqual(GOOGLE_SCOPES,['openid','email','https://www.googleapis.com/auth/gmail.readonly']);
 const f={uid:'alice',state:'random-state',expires:Date.now()+60000,verifier:'a'.repeat(64)};
 assert.equal(verifyGoogleFlow(f,'alice','random-state'),true);
 assert.equal(verifyGoogleFlow(f,'bob','random-state'),false);
 assert.equal(verifyGoogleFlow(f,'alice','wrong-state'),false);
 assert.equal(verifyGoogleFlow({...f,expires:0},'alice','random-state'),false);
 assert.equal(verifyGoogleFlow({...f,verifier:''},'alice','random-state'),false);
 assert.equal(googleAccountProvider('123'),'google:123');assert.throws(()=>googleAccountProvider('../microsoft'));assert.throws(()=>googleAccountProvider(''));
 const r=googleFinish(new Request('https://morice.test/api/google/callback?code=private-code'),'authorized');
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://morice.test/?google=authorized');assert.ok(!r.headers.get('location').includes('private-code'));assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax; Max-Age=0/);
});
