import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectModel } from '../app/lib/model-policy.ts';
test('simple requests use the available economical model', () => {
  assert.equal(selectModel(['gpt-5-mini','gpt-6-luna','gpt-6.1-sol'], 'conversation', 'Bonjour').model, 'gpt-6-luna');
});
test('complex requests and files use a capable available model', () => {
  for (const task of ['research','analysis']) assert.equal(selectModel(['gpt-6-luna','gpt-6.1-sol'], task, '').model, 'gpt-6.1-sol');
  assert.equal(selectModel(['gpt-6-luna','gpt-6.1-sol'], 'conversation', 'Compare plusieurs stratégies').model, 'gpt-6.1-sol');
});
test('unavailable models never guessed, costly and incompatible families excluded', () => {
  assert.equal(selectModel(['gpt-5-mini'], 'analysis', '').model, 'gpt-5-mini');
  assert.throws(() => selectModel(['gpt-6-astra','gpt-5-pro','whisper-1'], 'analysis', ''), /indisponible/);
  assert.throws(() => selectModel([], 'conversation', 'Bonjour'), /indisponible/);
});
