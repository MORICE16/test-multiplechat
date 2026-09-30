import test from 'node:test';
import assert from 'node:assert/strict';
import {coreExcerpts} from '../app/lib/core-excerpts.ts';
test('CORE retrieval selects relevant paragraphs within a hard context budget',()=>{
 const text='GENERAL PROJECT HEADER\n\n'+('Unrelated context. '.repeat(1000))+'\n\nOutlook categories require human validation and never create a task for every email.\n\nOpenClaw diagnostic only.';
 const selected=coreExcerpts(text,'Outlook categories email',500);
 assert.ok(selected.length<=500);assert.match(selected,/Outlook categories/);assert.match(selected,/human validation/);
});
