import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioReader, speechParts } from '../app/lib/audio-reader.ts';

class FakeAudio extends EventTarget {
  src=''; currentTime=0; duration=30; playbackRate=1; paused=true; refuse=false; plays=0;
  async play(){ this.plays++; if(this.refuse) throw Error('NotAllowedError'); this.paused=false; this.dispatchEvent(new Event('play')); }
  pause(){ this.paused=true; this.dispatchEvent(new Event('pause')); }
  load(){}
  removeAttribute(){this.src='';}
  metadata(){this.dispatchEvent(new Event('loadedmetadata'));}
  ended(){this.paused=true;this.dispatchEvent(new Event('ended'));}
}
function fixture(text='Bonjour.',saved=null,overrides={}){
  const audio=new FakeAudio(), calls=[], released=[], positions=[];
  const reader=new AudioReader(text,audio,{
    generate:async(part)=>{calls.push(part);return 'blob:'+calls.length;},
    release:url=>released.push(url),changed:()=>{},save:p=>positions.push(p),activate:()=>{},...overrides,
  },saved);
  return {reader,audio,calls,released,positions};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('long speech splitting preserves all text and never splits a surrogate pair',()=>{
  for(const input of ['Un texte français.\n'.repeat(1200),'a'.repeat(3499)+'🐕'.repeat(2000),'mot '.repeat(2000)]) {
    const parts=speechParts(input);
    assert.equal(parts.join(''),input);
    assert.ok(parts.every(p=>p.length>0 && p.length<=3500 && p.isWellFormed()));
  }
  assert.throws(()=>speechParts('abc',1));
});
test('only explicit play starts generation; long responses advance and cached passages are reused',async()=>{
  const f=fixture('Bonjour. '.repeat(1000));
  assert.equal(f.calls.length,0);
  await f.reader.toggle(); f.audio.metadata(); assert.equal(f.reader.state.playing,true);
  f.audio.ended(); await settle(); f.audio.metadata();
  assert.equal(f.reader.state.part,1);assert.equal(f.calls.length,2);
  await f.reader.select(0); assert.equal(f.reader.state.playing,false);
  await f.reader.toggle();f.audio.metadata(); assert.equal(f.calls.length,2);
  f.reader.dispose();assert.equal(f.released.length,2);
});
test('cancel or microphone interruption discards late audio and never starts playback',async()=>{
  let resolve;
  const f=fixture('Bonjour.',null,{generate:()=>new Promise(r=>{resolve=r;})});
  const pending=f.reader.toggle();assert.equal(f.reader.state.busy,true);
  f.reader.setDisabled(true);resolve('blob:late');await pending;f.audio.metadata();
  assert.equal(f.audio.plays,0);assert.equal(f.audio.src,'');assert.deepEqual(f.released,['blob:late']);
  f.reader.dispose();
});
test('double click cancels preparation and errors permit an explicit retry without losing position',async()=>{
  let resolve;let attempts=0;
  const f=fixture('Bonjour.',{part:0,position:12,rate:1.5},{generate:()=>{attempts++;return attempts===1?new Promise(r=>{resolve=r;}):Promise.resolve('blob:retry');}});
  const pending=f.reader.toggle();await f.reader.toggle();resolve('blob:cancelled');await pending;
  assert.equal(f.audio.src,'');assert.equal(f.reader.state.position,12);
  await f.reader.toggle();f.audio.metadata();assert.equal(f.audio.currentTime,12);assert.equal(f.audio.playbackRate,1.5);
  f.reader.dispose();
});
test('saved position and speed restore without sound; autoplay denial keeps audio ready',async()=>{
  const f=fixture('Bonjour.',{part:0,position:8,rate:2});f.audio.refuse=true;
  assert.equal(f.audio.plays,0);await f.reader.toggle();f.audio.dispatchEvent(new Event('timeupdate'));f.audio.metadata();await settle();
  assert.equal(f.audio.currentTime,8);assert.equal(f.audio.playbackRate,2);assert.equal(f.reader.state.ready,true);
  assert.match(f.reader.state.error,/Lecture/);assert.equal(f.reader.state.playing,false);
  f.audio.refuse=false;await f.reader.toggle();assert.equal(f.reader.state.playing,true);assert.equal(f.calls.length,1);
  f.reader.seek(13);f.reader.pause();const saved=f.positions.at(-1);f.reader.dispose();
  const restored=fixture('Bonjour.',saved);assert.equal(restored.reader.state.position,13);assert.equal(restored.audio.plays,0);restored.reader.dispose();
});
test('failed generation or unreadable audio can be retried explicitly at the retained position',async()=>{
  let count=0;
  const f=fixture('Bonjour.',{part:0,position:9,rate:1},{generate:async()=>{if(++count===1)throw Error('Offline');return 'blob:'+count;}});
  await f.reader.toggle();assert.equal(f.reader.state.position,9);assert.match(f.reader.state.error,/Offline/);
  await f.reader.toggle();f.audio.metadata();assert.equal(f.audio.currentTime,9);
  f.audio.dispatchEvent(new Event('error'));assert.equal(f.reader.state.ready,false);
  await f.reader.toggle();f.audio.metadata();assert.equal(count,3);assert.equal(f.audio.currentTime,9);
  f.reader.dispose();
});
test('unmount discards late generation, storage failures and corrupt progress do not break reading',async()=>{
  let resolve;
  const f=fixture('Bonjour.',{part:999,position:NaN,rate:50},{save:()=>{throw Error('blocked');},generate:()=>new Promise(r=>{resolve=r;})});
  assert.equal(f.reader.state.part,0);assert.equal(f.reader.state.position,0);assert.equal(f.reader.state.rate,1);
  const pending=f.reader.toggle();f.reader.dispose();resolve('blob:disposed');await pending;
  assert.equal(f.audio.plays,0);assert.deepEqual(f.released,['blob:disposed']);
});
