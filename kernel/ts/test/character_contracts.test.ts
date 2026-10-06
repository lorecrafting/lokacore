import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';

const actor = '11111111-2222-4333-8444-555555555555';
const attribute = 'ashmere_missing_child@0.0.36:attribute/per';
const ref = {
  cartridge_id: 'ashmere_missing_child',
  cartridge_version: '0.0.36',
  kind: 'attribute',
  key: 'per',
};
const choice = { ancestry: 'fen_born', attributes: { [attribute]: 6 } };
const op = { op: 'character.select', writer_group: 0, character_id: actor, value: choice };

// Breaks: a creation command without its actor/key, or a malformed immutable row/value,
// crosses the wire boundary and then changes an unrelated character or invents a stat.
test('character creation wire contracts reject absent and malformed identities and values', () => {
  const command = { type: 'choose_ancestry', actor_id: actor, ancestry: 'fen_born' };
  const ancestry = {
    attribute: ref,
    description: 'ancestry.fen_born.description',
    label: 'ancestry.fen_born.label',
    modifier: 1,
  };
  for (const [contract, valid, bad] of [
    [
      'CommandPayload',
      command,
      [
        { type: 'choose_ancestry', ancestry: 'fen_born' },
        { type: 'choose_ancestry', actor_id: actor, ancestry: '' },
      ],
    ],
    [
      'CharacterChoice',
      choice,
      [
        { attributes: choice.attributes },
        { ancestry: 'fen_born', attributes: { [attribute]: -1 } },
        { ancestry: 'fen_born', attributes: { 'not-an-attribute': 6 } },
      ],
    ],
    [
      'DeltaOp',
      op,
      [
        { ...op, character_id: undefined },
        { ...op, value: undefined },
        { ...op, op: 'character.reroll' },
      ],
    ],
    [
      'AncestrySpec',
      ancestry,
      [
        { ...ancestry, modifier: 0 },
        { ...ancestry, attribute: undefined },
        { ...ancestry, dark_sight: false },
      ],
    ],
  ] as const) {
    assert.deepEqual(validate(contract, valid), [], contract);
    for (const value of bad) assert.notDeepEqual(validate(contract, value), [], contract);
  }
});
