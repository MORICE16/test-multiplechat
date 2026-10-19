import test from 'node:test';
import assert from 'node:assert/strict';
import {remainingMailSuggestions,selectUniqueMailProposals} from '../app/lib/mail-triage.ts';
const mail=(id,categories=[],suggestions=['Énergie / Travaux'])=>({id,categories,suggestions,subject:'synthetic',sender:'test',receivedAt:'',reasons:[],priority:'',unread:false});
test('remaining mail proposals exclude equivalent case and Unicode labels without modifying messages',()=>{
 const m=mail('one',['e\u0301nergie / travaux']);const before=JSON.stringify(m);assert.deepEqual(remainingMailSuggestions(m),[]);assert.equal(JSON.stringify(m),before);
 const mixed=mail('two',['Juridique / Notaire'],['Juridique / Notaire','Immobilier / Location']);assert.deepEqual(remainingMailSuggestions(mixed),['Immobilier / Location']);
});
test('selection is bounded to ten remaining unambiguous messages, ignores empty and ambiguous rows',()=>{
 const messages=[mail('already',['Énergie / Travaux']),mail('',[]),mail('manual',[],[]),mail('ambiguous',[],['Assurances','Personnel']),...Array.from({length:15},(_,i)=>mail('new-'+i))];const selected=selectUniqueMailProposals(messages);assert.equal(Object.keys(selected).length,10);assert.ok(!selected.already);assert.ok(!selected.ambiguous);assert.ok(!selected.manual);assert.equal(selected['new-9'],'Énergie / Travaux');assert.ok(!selected['new-10']);
});
