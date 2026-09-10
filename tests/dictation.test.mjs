import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDictation } from '../app/lib/dictation.ts';

function harness(autoStart = true) {
  const instances=[], states=[], texts=[], errors=[], delays=[], timers=new Map(); let id=0;
  const controller=createDictation({
    create() { const r={ start(){this.starts=(this.starts||0)+1;if(autoStart)this.onstart?.();}, stop(){this.stopped=true;}, abort(){this.aborted=true;}}; instances.push(r); return r; },
    onState:s=>states.push(s), onText:t=>texts.push(t), onError:e=>errors.push(e),
    schedule(fn,delay){delays.push(delay);timers.set(++id,fn);return id;}, cancel(id){timers.delete(id);},
  });
  return { controller,instances,states,texts,errors,delays,timers, tick(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());} };
}
const result=(r, ...segments)=>r.onresult({results:segments.map(([transcript,isFinal])=>({0:{transcript},isFinal}))});

test('silence and browser termination keep listening until manual stop',()=>{
  const h=harness();h.controller.start('Note :');
  const r=h.instances[0];assert.equal(r.continuous,true);assert.equal(r.interimResults,true);
  r.onstart();result(r,['bonjour',true]);r.onerror({error:'no-speech'});r.onend();
  assert.equal(h.states.at(-1),'reconnecting');h.tick();assert.equal(h.instances.length,2);
  result(h.instances[1],['bonjour',true]);assert.equal(h.texts.at(-1),'Note : bonjour bonjour');
  h.controller.stop();assert.equal(h.instances[1].stopped,true);
  result(h.instances[1],['bonjour tout le monde',true]);h.instances[1].onend();
  assert.equal(h.texts.at(-1),'Note : bonjour bonjour tout le monde');assert.equal(h.states.at(-1),'ready');
  h.tick();assert.equal(h.instances.length,2);
});
test('stop during restart delay prevents another recognition session',()=>{
  const h=harness();h.controller.start();h.instances[0].onend();h.controller.stop();h.tick();assert.equal(h.instances.length,1);assert.equal(h.states.at(-1),'ready');
});
test('interim results are revised without duplicate words and survive restart',()=>{
  const h=harness();h.controller.start('Bonjour');const r=h.instances[0];
  result(r,['je',false]);result(r,['je veux',false]);result(r,['je veux',true],['une tâche',false]);
  assert.equal(h.texts.at(-1),'Bonjour je veux une tâche');r.onend();h.tick();
  result(h.instances[1],['demain',true]);assert.equal(h.texts.at(-1),'Bonjour je veux une tâche demain');
});
test('permission and audio errors terminate without restart loops',()=>{
  for(const error of ['not-allowed','service-not-allowed','audio-capture','language-not-supported']){
    const h=harness();h.controller.start();const r=h.instances[0];r.onerror({error});h.tick();
    assert.equal(r.aborted,true);assert.equal(h.states.at(-1),'error');assert.equal(h.errors.length,1);assert.equal(h.instances.length,1);
  }
});
test('repeated network errors stop with an explicit error after bounded retries',()=>{
  const h=harness();h.controller.start();for(let i=0;i<3;i++){const r=h.instances.at(-1);r.onerror({error:'network'});r.onend();h.tick();}
  assert.equal(h.instances.length,3);assert.equal(h.errors.length,1);assert.equal(h.states.at(-1),'error');
});
test('rapid clicks, stop timeout and disposal never leave an active session',()=>{
  const h=harness();h.controller.start();h.controller.start();assert.equal(h.instances.length,1);
  h.controller.stop();h.controller.start();assert.equal(h.instances.length,1);h.tick();assert.equal(h.instances[0].aborted,true);
  h.controller.start();h.instances[1].onend();h.controller.dispose();h.tick();assert.equal(h.instances.length,2);
});

test("a browser that never starts exits with an explicit error and releases the session",()=>{const h=harness(false);h.controller.start();assert.equal(h.states.at(-1),"starting");h.tick();assert.equal(h.states.at(-1),"error");assert.equal(h.instances[0].aborted,true);assert.equal(h.errors.length,1);h.controller.start();assert.equal(h.instances.length,2);h.controller.stop();h.tick();assert.equal(h.states.at(-1),"ready");});

test('repeated empty sessions back off and useful speech resets the delay',()=>{
  const h=harness();h.controller.start();const delays=[];
  for(let i=0;i<7;i++){const r=h.instances.at(-1);r.onerror({error:'no-speech'});r.onend();delays.push(h.delays.at(-1));h.tick();}
  assert.deepEqual(delays,[500,1000,2000,4000,8000,8000,8000]);
  result(h.instances.at(-1),['une phrase utile',true]);h.instances.at(-1).onend();assert.equal(h.delays.at(-1),300);
});
test('empty results and fatal errors preserve the last useful transcript',()=>{
  const h=harness();h.controller.start('Brouillon');const r=h.instances[0];
  result(r,['ma dernière phrase',false]);result(r);r.onerror({error:'audio-capture'});
  assert.equal(h.texts.at(-1),'Brouillon ma dernière phrase');
});
test('offline or hidden tab pauses without losing text and resumes one session',()=>{
  const h=harness();h.controller.start();const r=h.instances[0];result(r,['phrase conservée',false]);
  const staleResult=r.onresult;h.controller.setAvailable(false);assert.equal(r.aborted,true);assert.equal(h.states.at(-1),'paused');
  staleResult({results:[]});h.tick();assert.equal(h.instances.length,1);assert.equal(h.texts.at(-1),'phrase conservée');
  h.controller.setAvailable(true);h.controller.setAvailable(true);h.tick();assert.equal(h.instances.length,2);
  result(h.instances[1],['suite',true]);assert.equal(h.texts.at(-1),'phrase conservée suite');
});
test('manual stop while paused prevents automatic resumption',()=>{
  const h=harness();h.controller.setAvailable(false);h.controller.start('Conserver');assert.equal(h.states.at(-1),'paused');
  h.controller.stop();h.controller.setAvailable(true);h.tick();assert.equal(h.states.at(-1),'ready');assert.equal(h.instances.length,0);
});
