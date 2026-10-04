import test from 'node:test';
import assert from 'node:assert/strict';
import { permittedApiKey } from '../app/lib/paid-api-policy.ts';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
test('an existing API key cannot fund requests without exact explicit server consent',()=>{
  for(const consent of [undefined,null,false,true,'false','TRUE',' true ','']) assert.equal(permittedApiKey('test-only',consent),'');
  assert.equal(permittedApiKey(' test-only ','true'),'test-only');
  assert.equal(permittedApiKey(undefined,'true'),'');
});
test('production runtime masks only the OpenAI key and preserves Microsoft connections',async()=>{
  const source=(await readFile(new URL('../app/lib/runtime.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  const key=crypto.randomUUID();globalThis[key]={OPENAI_API_KEY:'test-only',MICROSOFT_CLIENT_ID:'microsoft-test'};
  try {
    const code=ts.transpileModule(`const env=globalThis[${JSON.stringify(key)}]; const permittedApiKey=${permittedApiKey.toString()};\n${source}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const runtime=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    assert.equal(runtime.runtimeValue('OPENAI_API_KEY'),'');assert.equal(runtime.runtimeValue('MICROSOFT_CLIENT_ID'),'microsoft-test');
    globalThis[key].MORICE_ALLOW_PAID_API='true';assert.equal(runtime.runtimeValue('OPENAI_API_KEY'),'test-only');
  }finally{delete globalThis[key];}
});
