import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readWidgetDraft } from '../app/lib/widget-draft.ts';

test('widget preserves accents, punctuation and long dictation without executing it', () => {
  const text = 'Prépare un brouillon à Zoé : A+B & 50% #demain\n' + 'texte '.repeat(250);
  assert.equal(readWidgetDraft('#morice-draft=' + encodeURIComponent(text)), text);
  assert.equal(readWidgetDraft('#morice-draft='), '');
  assert.equal(readWidgetDraft('#other=value'), null);
  assert.equal(readWidgetDraft(''), null);
});
