import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecording } from '../app/lib/recording.ts';
import { transcribeAudio } from '../app/lib/transcription.ts';

const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(transcribe = async () => 'bonjour Alan') {
  const states=[], texts=[], errors=[], sends=[], audios=[], uploads=[];
  const track={ stop(){this.stopped=true;}, onended:null };
  const recorder={ state:'inactive', mimeType:'audio/webm',
    start(){this.state='recording';}, pause(){this.state='paused';}, resume(){this.state='recording';},
    stop(){this.state='inactive'; this.ondataavailable({data:new Blob(['last words'],{type:'audio/webm'})}); this.onstop();},
  };
  const controller=createRecording({acquire:async()=>({getTracks:()=>[track]}),create:()=>recorder,
    transcribe:async(blob,signal)=>{uploads.push(blob);return transcribe(blob,signal);},
    onState:s=>states.push(s),onText:t=>texts.push(t),onError:e=>errors.push(e),onAudio:a=>audios.push(a),onSend:t=>sends.push(t)});
  return {controller,recorder,track,states,texts,errors,sends,audios,uploads};
}
test('recording remains open through silence; pause and resume never upload; final stop includes last audio', async()=>{
  const h=harness(); await h.controller.start('Note :'); await settle();
  assert.equal(h.recorder.state,'recording');assert.equal(h.uploads.length,0);
  h.controller.pause(); assert.equal(h.states.at(-1),'paused'); assert.equal(h.uploads.length,0);
  h.controller.pause(); assert.equal(h.states.at(-1),'listening');
  h.controller.stop();await settle();
  assert.equal(await h.uploads[0].text(),'last words');assert.equal(h.texts.at(-1),'Note : bonjour Alan');
  assert.equal(h.sends.length,0);assert.equal(h.track.stopped,true);
});
test('explicit Send stops paused recording and sends once, including on double click',async()=>{
  const h=harness();await h.controller.start('');h.controller.pause();h.controller.stop(true);h.controller.stop(true);await settle();
  assert.deepEqual(h.sends,['bonjour Alan']);assert.equal(h.uploads.length,1);
});
test('network failure retains audio and retry transcribes without automatic send',async()=>{
  let attempts=0;const h=harness(async()=>{if(!attempts++)throw Error('offline');return 'récupéré';});
  await h.controller.start('');h.controller.stop(true);await settle();
  assert.equal(h.states.at(-1),'error');assert.ok(h.audios.at(-1).size);assert.equal(h.sends.length,0);
  h.controller.retry();await settle();assert.equal(h.texts.at(-1),'récupéré');assert.equal(h.audios.at(-1),null);assert.equal(h.sends.length,0);
});
test('operating-system interruption retains audio and never uploads or sends unsolicited',async()=>{
  const h=harness();await h.controller.start('');h.track.onended();await settle();
  assert.equal(h.states.at(-1),'error');assert.ok(h.audios.at(-1).size);assert.equal(h.uploads.length,0);
});
test('dispose during transcription ignores late response',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>resolve=r));await h.controller.start('');h.controller.stop(true);
  h.controller.dispose();resolve('too late');await settle();assert.equal(h.sends.length,0);assert.equal(h.texts.length,0);
});
test('stop during permission prompt cancels later capture',async()=>{
  let resolve,stopped=false,created=false;
  const h=createRecording({acquire:()=>new Promise(r=>resolve=r),create:()=>{created=true;},onState(){},onError(){},onAudio(){},onText(){},onSend(){},transcribe(){throw Error('no');}});
  const pending=h.start('');h.stop(true);resolve({getTracks:()=>[{stop(){stopped=true;}}]});await pending;
  assert.equal(created,false);assert.equal(stopped,true);
});
const req=(body='sound',type='audio/webm')=>new Request('https://morice.test/api/transcription',{method:'POST',headers:{'content-type':type},body});
test('transcription validates size/type, forwards French audio securely and sanitizes provider errors',async()=>{
  assert.equal((await transcribeAudio(req(),'')).status,503);
  assert.equal((await transcribeAudio(req('x','text/html'),'secret')).status,415);
  assert.equal((await transcribeAudio(req(''),'secret')).status,400);
  assert.equal((await transcribeAudio(req(new Uint8Array(20*1024*1024+1)),'secret')).status,413);
  let calls=0;
  const r=await transcribeAudio(req(),'secret',async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(options.headers.Authorization,'Bearer secret');
    assert.equal(options.body.get('model'),'gpt-4o-mini-transcribe');assert.equal(options.body.get('language'),'fr');
    assert.equal(await options.body.get('file').text(),'sound');return Response.json({text:'bonjour'});
  });
  assert.equal(calls,1);assert.deepEqual(await r.json(),{text:'bonjour'});assert.equal(r.headers.get('cache-control'),'no-store');
  const fail=await transcribeAudio(req(),'secret',async()=>new Response('secret provider detail',{status:401}));
  assert.equal(fail.status,502);assert.doesNotMatch(await fail.text(),/secret provider/);
});
