import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestMail, inspectMailbox, mailReviewText } from '../app/lib/mail-triage.ts';

test('proposals explain evidence, preserve categories and leave unknown mail undecided', () => {
  const input={subject:'Facture du notaire',from:{emailAddress:{name:'Étude notariale'}},categories:['Personnel'],importance:'normal',isRead:false};
  const before=structuredClone(input), result=suggestMail(input);
  assert.deepEqual(input,before);
  assert.ok(result.suggestions.includes('Juridique / Notaire'));
  assert.ok(result.suggestions.includes('Comptabilité / Factures'));
  assert.deepEqual(result.categories,['Personnel']);assert.equal(result.unread,true);
  assert.match(result.reasons.join(' '),/notaire/);
  assert.equal(suggestMail({subject:'URGENT réponse à mon message'}).suggestions.length,0);
  assert.equal(suggestMail({subject:'URGENT réponse à mon message'}).priority,'Priorité à examiner');
  assert.equal(suggestMail({subject:'Réunion chez Paul'}).suggestions.length,0);
});
test('mailbox review reads only bounded inbox metadata, never follows foreign nextLink or writes',async()=>{
  const calls=[];
  const review=await inspectMailbox('test@example.invalid',async path=>{
    calls.push(path);const q=new URL(path,'https://graph.microsoft.com/v1.0');
    assert.equal(q.pathname,'/me/mailFolders/inbox/messages');
    assert.equal(q.searchParams.get('$top'),'100');
    assert.match(q.searchParams.get('$filter'),/2025-01-01/);
    assert.doesNotMatch(q.searchParams.get('$select'),/body|attachment/);
    return {value:[{subject:'Quittance de loyer'}],'@odata.nextLink':'https://evil.invalid/steal'};
  });
  assert.equal(calls.length,1);assert.equal(review.hasMore,true);assert.equal(review.messages.length,1);
  assert.match(mailReviewText(review),/n’est pas exhaustif/);
  assert.match(mailReviewText(review),/Une seule boîte/);
  assert.match(mailReviewText(review),/Aucun message déplacé/);
  await assert.rejects(()=>inspectMailbox('test',async()=>({error:'bad'})),/incomplète/);
});
