import assert from 'node:assert/strict';
import test from 'node:test';

import { view } from './__tests__/combat-book.test.ts';
import { lineWords } from './words.ts';

const SAY: Record<string, string> = {
  'npc.r': 'Reeve Hal',
  'npc.rat': 'the rat',
  quoted: '"Well, stranger?"',
  nods: 'Nell nods.',
  tagged: '"Fine," Nell says.',
  curly: '“Well?”',
};
const say = (k: string) => SAY[k] ?? k;
const v = view({
  entities: [
    { id: 'r', kind: 'npc', name: 'npc.r', actions: [] },
    { id: 'rat', kind: 'npc', name: 'npc.rat', actions: [] },
  ],
} as never);
const words = (key: string, speaker?: string) =>
  lineWords({ key, participants: { actor: 'b', ...(speaker && { speaker }) } }, say, v);

// Breaks (book-ui.md Line placement, loka-548k): an NPC's spoken line left as a bare quotation,
// the speaker's name dropped or lowercase, a bystander told "to you", or narration and an attributed quotation re-attributed.
test('a line wholly one quotation reads as its named speaker saying it to you', () => {
  assert.equal(words('quoted', 'r'), 'Reeve Hal says to you, "Well, stranger?"');
  assert.equal(words('quoted', 'rat'), 'The rat says to you, "Well, stranger?"');
  assert.equal(words('quoted'), '"Well, stranger?"');
  assert.equal(words('nods', 'r'), 'Nell nods.');
  assert.equal(words('tagged', 'r'), '"Fine," Nell says.');
  assert.equal(words('curly', 'r'), 'Reeve Hal says to you, “Well?”');
  // A bystander reading someone else's (a named actor's) conversation is not addressed.
  const seen = lineWords({ key: 'quoted', participants: { actor: 'rat', speaker: 'r' } }, say, v);
  assert.equal(seen, 'Reeve Hal says, "Well, stranger?"');
});
