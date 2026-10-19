import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestMail, inspectMailbox, mailReviewText, isExplicitMailPreview } from '../app/lib/mail-triage.ts';

test('only explicit mail preview commands qualify for direct read-only routing',()=>{
  assert.equal(isExplicitMailPreview('Prépare un aperçu du classement des mails de mes cinq boîtes.'),true);
  for(const text of ['Ne prépare pas un aperçu du classement des mails','Explique la phrase « prépare un aperçu du classement des mails »','Prépare un mail pour le notaire','Classe tous mes mails','Mémorise : prépare un aperçu du classement des mails']) assert.equal(isExplicitMailPreview(text),false,text);
});

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

test('fixed Microsoft searches cover older subjects and sender addresses without arbitrary queries or mail bodies',async()=>{
 const calls=[];
 const review=await inspectMailbox('test@example.invalid',async path=>{
  calls.push(path);const url=new URL(path,'https://graph.microsoft.com');assert.equal(url.pathname,'/me/messages');assert.match(url.searchParams.get('$search'),/subject:notaire OR from:notaire/);assert.equal(url.searchParams.get('$filter'),null);assert.equal(url.searchParams.get('$orderby'),null);assert.doesNotMatch(url.searchParams.get('$select'),/body|attachment/);
  return{value:[{id:'one',subject:'Dossier',from:{emailAddress:{name:'Étude Test',address:'test@notaires.example.invalid'}},receivedDateTime:'2020-01-01'}]};
 },'notaire');
 assert.equal(calls.length,1);assert.equal(review.scope,'notaire');assert.deepEqual(review.messages[0].suggestions,['Juridique / Notaire']);assert.match(mailReviewText(review),/Recherche Microsoft/);assert.doesNotMatch(mailReviewText(review),/depuis le 1er janvier 2025/);
 for(const scope of ['__proto__','https://evil.example','notaire OR secret','constructor'])await assert.rejects(()=>inspectMailbox('test',async()=>{throw Error('must not read');},scope),/Périmètre/);
});
