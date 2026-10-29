// Homestead hs-14 save check (`openable`, used by dialogue-save.ts and dialogue-receipt.ts): a saved
// open row may lack only choices that teach a skill an opening can conceal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openable } from '../src/mechanics/dialogue/shared.ts';

const ref = (key: string) => ({
  cartridge_id: 'x',
  cartridge_version: '0.0.1',
  kind: 'skill',
  key,
});
const teach = (key: string) => ({ sequence: [{ op: 'skill.acquire', skill: ref(key) }] });
const world = (carving: object) =>
  ({
    cartridge: {
      skills: {
        'x@0.0.1:skill/carving': carving,
        'x@0.0.1:skill/whittling': { prerequisite: {} },
      },
    },
  }) as never;
const hidden = world({ hidden: true, prerequisite: {} });
const d = { choices: { learn: teach('carving'), leave: {}, whittle: teach('whittling') } } as never;

// Breaks: a row may drop a choice that teaches no skill or a shown one, even gated (whittle),
// reorder, be empty, name an id the dialogue lacks or not be a list (a TypeError, not
// save_corrupt); or the full row or the one less the hidden lesson is refused.
test('a saved row may lack only a lesson of a hidden skill', () => {
  const rows = [
    ['learn', 'leave', 'whittle'],
    ['leave', 'whittle'],
    ['learn', 'leave'],
    ['learn', 'whittle'],
    ['whittle', 'leave'],
    ['bogus'],
    [],
    null,
  ];
  assert.deepEqual(
    rows.map((ids) => openable(hidden, d, ids)),
    [true, true, false, false, false, false, false, false],
  );
});

// Breaks: a hidden skill with no prerequisite (never `concealed`, skills.ts) may be left out, or an
// empty row passes when every choice is concealed (it matches the filter, so only the length
// check refuses).
test('only a lesson concealed can hide is left out, and never all of them', () => {
  assert.equal(openable(world({ hidden: true }), d, ['leave', 'whittle']), false);
  assert.equal(openable(hidden, { choices: { learn: teach('carving') } } as never, []), false);
});
