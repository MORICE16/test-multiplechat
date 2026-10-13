import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { speechParts } from '../app/lib/audio-reader.ts';

const source=(await readFile(new URL('../app/lib/browser-reader.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const code=ts.transpileModule(`const speechParts=${speechParts.toString()};\n${source}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {BrowserReader}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function fixture(text='Bonjour Alan, voici votre agenda.',saved=null){
  const f={utterances:[],cancels:0,states:[],saved:[],active:0};
  f.reader=new BrowserReader(text,{
    synth:{getVoices:()=>[{lang:'fr-FR',localService:true,name:'Appareil'}],speak:u=>f.utterances.push(u),cancel:()=>f.cancels++,resume:()=>{}},
    create:text=>({text}),changed:s=>f.states.push(s),save:p=>f.saved.push(p),activate:()=>f.active++,
  },saved);return f;
}
test('device reader is silent on restore and resumes from the last boundary after pause',()=>{
  const f=fixture();try{
    assert.equal(f.utterances.length,0);f.reader.play();const old=f.utterances[0];
    old.onstart();old.onboundary({charIndex:14});assert.equal(f.reader.state.offset,14);
    f.reader.pause();old.onend();assert.equal(f.reader.state.playing,false);assert.equal(f.utterances.length,1);
    f.reader.play();assert.equal(f.utterances[1].text,'voici votre agenda.');
    assert.equal(f.utterances[1].voice.name,'Appareil');
  }finally{f.reader.dispose();}
});
test('long reading preserves text, advances through all passages and ignores duplicate ends',()=>{
  const text=('Une phrase à lire avec Morice. ').repeat(80),f=fixture(text);try{
    assert.equal(f.reader.parts.join(''),text.trim());f.reader.play();
    for(let part=0;part<f.reader.parts.length;part++){
      const u=f.utterances[part];assert.ok(u);u.onstart();u.onend();const count=f.utterances.length;u.onend();assert.equal(f.utterances.length,count);
    }
    assert.equal(f.reader.state.playing,false);assert.equal(f.reader.state.part,0);
  }finally{f.reader.dispose();}
});
test('changing speed preserves position and disabling or disposing prevents late speech',()=>{
  const f=fixture();try{
    f.reader.play();f.utterances[0].onstart();f.utterances[0].onboundary({charIndex:14});
    f.reader.speed(1.5);assert.equal(f.utterances[1].rate,1.5);assert.equal(f.utterances[1].text,'voici votre agenda.');
    f.reader.setDisabled(true);const n=f.utterances.length;f.utterances[1].onend();f.reader.play();assert.equal(f.utterances.length,n);
    f.reader.dispose();f.reader.setDisabled(false);f.reader.play();assert.equal(f.utterances.length,n);
  }finally{f.reader.dispose();}
});
test('failed speech keeps saved position for an explicit retry and corrupt state is bounded',()=>{
  const f=fixture(undefined,{part:-3,offset:Infinity,rate:9});try{
    assert.equal(f.reader.state.part,0);assert.equal(f.reader.state.offset,0);assert.equal(f.reader.state.rate,1);
    f.reader.play();f.utterances[0].onstart();f.utterances[0].onboundary({charIndex:14});f.utterances[0].onerror();
    assert.equal(f.reader.state.offset,14);assert.match(f.reader.state.error,/indisponible/);assert.equal(f.utterances.length,1);
    f.reader.play();assert.equal(f.utterances[1].text,'voici votre agenda.');
  }finally{f.reader.dispose();}
});
