import assert from 'node:assert/strict';
import test from 'node:test';

import { view } from './__tests__/combat-book.test.ts';
import { lineWords } from './words.ts';

const SAY: Record<string, string> = {
  'npc.rat': 'the rat',
  'emote.bow.others': '{actor} bows.',
  'emote.bow.to.others': '{actor} bows to {target}.',
  'emote.bow.to.you': '{actor} bows to you.',
};
const say = (k: string) => SAY[k] ?? k;
const bow = {
  key: 'bow',
  others: 'emote.bow.others',
  to: { others: 'emote.bow.to.others', you: 'emote.bow.to.you' },
};

// Breaks: the reader test swapped (the reader's own body read as a named third person, or a named
// NPC read as "you"), or a targeted line read with the untargeted form (G9; book-ui.md, Line placement).
test('an NPC emote reads to.you for the reader, to.others for a named target, others with none', () => {
  const v = view({ emotes: [bow] } as never);
  const line = (target?: string) =>
    lineWords(
      {
        key: 'emote.performed',
        bindings: { emote: 'bow', ...(target && { target: 'npc.rat' }) },
        participants: { actor: 'rat', ...(target && { target }) },
      },
      say,
      v,
    );
  assert.equal(line('body'), 'The rat bows to you.');
  assert.equal(line('rat'), 'The rat bows to the rat.');
  assert.equal(line(), 'The rat bows.');
});
