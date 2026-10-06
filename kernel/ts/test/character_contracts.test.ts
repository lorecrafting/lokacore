import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, loadCartridge, newWorld, INSTALLED } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

const actor = '11111111-2222-4333-8444-555555555555';
const attribute = 'ashmere_missing_child@0.0.38:attribute/per';
const ref = {
  cartridge_id: 'ashmere_missing_child',
  cartridge_version: '0.0.38',
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
        { type: 'choose_ancestry', actor_id: actor },
        { type: 'choose_ancestry', actor_id: actor, ancestry: '' },
      ],
    ],
    [
      'CharacterChoice',
      choice,
      [
        { attributes: choice.attributes },
        { ancestry: 'fen_born' },
        { ancestry: 'fen_born', attributes: { [attribute]: -1 } },
        { ancestry: 'fen_born', attributes: { 'not-an-attribute': 6 } },
      ],
    ],
    [
      'DeltaOp',
      op,
      [
        { op: 'character.select', character_id: actor, value: choice },
        { op: 'character.select', writer_group: 0, value: choice },
        { op: 'character.select', writer_group: 0, character_id: actor },
        { ...op, op: 'character.reroll' },
      ],
    ],
    [
      'AncestrySpec',
      ancestry,
      [
        { description: ancestry.description, attribute: ref, modifier: 1 },
        { label: ancestry.label, attribute: ref, modifier: 1 },
        { ...ancestry, modifier: 0 },
        { label: ancestry.label, description: ancestry.description, attribute: ref },
        { label: ancestry.label, description: ancestry.description, modifier: 1 },
        { ...ancestry, dark_sight: false },
        { ...ancestry, faction: { value: -2 } },
        { ...ancestry, faction: { fact: ref } },
      ],
    ],
    [
      'MutationTarget',
      { kind: 'character', character_id: actor },
      [{ kind: 'character' }, { kind: 'reincarnation', character_id: actor }],
    ],
  ] as const) {
    assert.deepEqual(validate(contract, valid), [], contract);
    for (const value of bad) assert.notDeepEqual(validate(contract, value), [], contract);
  }
});

// Breaks: the Book receives a choice with missing display or effect data despite a valid chapter.
test('fresh ancestry choices keep their required projected shape', () => {
  const pin = read('protocol/fixtures/missing_child_v038_hash.json');
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: pin.value, content_hash: pin.sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  if (!loaded.ok) return;
  assert.equal(loaded.cartridge.format, 'loka-cartridge-v2');
  if (loaded.cartridge.format !== 'loka-cartridge-v2') return;
  const view = gameView(
    newWorld(loaded.cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]),
  );
  assert.equal(view.ancestry_choices?.[0]?.key, 'fen_born');
  assert.deepEqual(validate('GameView', view), []);
  const damaged = () =>
    structuredClone(view) as unknown as { ancestry_choices: Record<string, unknown>[] };
  for (const field of ['key', 'label', 'description', 'attribute', 'modifier']) {
    const bad = damaged();
    delete bad.ancestry_choices[0]![field];
    assert.notDeepEqual(validate('GameView', bad), [], field);
  }
  for (const field of ['fact', 'value']) {
    const bad = damaged();
    delete (bad.ancestry_choices[0]!.faction as Record<string, unknown>)[field];
    assert.notDeepEqual(validate('GameView', bad), [], field);
  }
  const below = damaged();
  below.ancestry_choices[0]!.modifier = 0;
  assert.notDeepEqual(validate('GameView', below), []);
  const falseSight = damaged();
  falseSight.ancestry_choices[2]!.dark_sight = false;
  assert.notDeepEqual(validate('GameView', falseSight), []);
});

// Breaks: a compiled release admits an ancestry key that player commands cannot address.
test('compiled ancestry keys use the command Key shape', () => {
  const pin = read('protocol/fixtures/missing_child_v038_hash.json');
  assert.deepEqual(validate('CompiledCartridge', pin.value), []);
  const bad = structuredClone(pin.value) as { ancestries: Record<string, unknown> };
  bad.ancestries['Bad Key'] = bad.ancestries.fen_born;
  delete bad.ancestries.fen_born;
  assert.notDeepEqual(validate('CompiledCartridge', bad), []);
});
