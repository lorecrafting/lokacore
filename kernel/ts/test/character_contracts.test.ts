import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, loadCartridge, newWorld, INSTALLED } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';
import { createHash } from 'node:crypto';
import { artifact } from './derived_fixture.ts';
import { ctx } from './harness.ts';

const actor = '11111111-2222-4333-8444-555555555555';
const attribute = 'derived_sampler@0.0.1:attribute/str';
const ref = {
  cartridge_id: 'derived_sampler',
  cartridge_version: '0.0.1',
  kind: 'attribute',
  key: 'str',
};
const choice = { ancestry: 'strong', attributes: { [attribute]: 6 } };
const compiled = (): any => JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const op = { op: 'character.select', writer_group: 0, character_id: actor, value: choice };

// Breaks: a creation command without its actor/key, or a malformed immutable row/value,
// crosses the wire boundary and then changes an unrelated character or invents a stat.
test('character creation wire contracts reject absent and malformed identities and values', () => {
  const command = { type: 'choose_ancestry', actor_id: actor, ancestry: 'strong' };
  const ancestry = {
    attribute: ref,
    description: 'ancestry.strong.description',
    name: 'ancestry.strong.label',
    modifier: 1,
  };
  for (const [contract, valid, bad] of [
    [
      'CommandPayload',
      command,
      [
        { type: 'choose_ancestry', ancestry: 'strong' },
        { type: 'choose_ancestry', actor_id: actor },
        { type: 'choose_ancestry', actor_id: actor, ancestry: '' },
      ],
    ],
    [
      'CharacterChoice',
      choice,
      [
        { attributes: choice.attributes },
        { ancestry: 'strong' },
        { ancestry: 'strong', attributes: { [attribute]: -1 } },
        { ancestry: 'strong', attributes: { 'not-an-attribute': 6 } },
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
        { name: ancestry.name, attribute: ref, modifier: 1 },
        { ...ancestry, modifier: 0 },
        { name: ancestry.name, description: ancestry.description, attribute: ref },
        { name: ancestry.name, description: ancestry.description, modifier: 1 },
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
  // The derived sampler with strong's faction and hardy's dark sight added, so every optional field projects.
  const c = compiled();
  c.facts['derived_sampler@0.0.1:fact/standing'] = {
    key: 'standing',
    version: 1,
    value_type: { type: 'int', default: 0 },
    scopes: ['player'],
    meaning: 'Controlled faction standing.',
  };
  c.ancestries.strong.faction = { fact: { ...ref, kind: 'fact', key: 'standing' }, value: -2 };
  c.ancestries.hardy.dark_sight = true;
  c.manifest.requires.capabilities.light = c.lock.capabilities.light = 1; // gates dark_sight
  const canonical = encode(c);
  const hash = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${hash}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  if (!loaded.ok) return;
  assert.equal(loaded.cartridge.format, 'loka-cartridge-v2');
  if (loaded.cartridge.format !== 'loka-cartridge-v2') return;
  const view = gameView(
    newWorld(loaded.cartridge, ctx('0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), [1, 2, 3, 4]),
  );
  assert.deepEqual(validate('GameView', view), []);
  const at = (k: string) => view.ancestry_choices!.findIndex((choice) => choice.key === k);
  const [strong, hardy] = [at('strong'), at('hardy')];
  assert.ok(view.ancestry_choices![strong]!.faction && view.ancestry_choices![hardy]!.dark_sight);
  const damaged = () =>
    structuredClone(view) as unknown as { ancestry_choices: Record<string, unknown>[] };
  for (const field of ['key', 'label', 'description', 'attribute', 'modifier']) {
    const bad = damaged();
    delete bad.ancestry_choices[strong]![field];
    assert.notDeepEqual(validate('GameView', bad), [], field);
  }
  for (const field of ['fact', 'value']) {
    const bad = damaged();
    delete (bad.ancestry_choices[strong]!.faction as Record<string, unknown>)[field];
    assert.notDeepEqual(validate('GameView', bad), [], field);
  }
  const below = damaged();
  below.ancestry_choices[strong]!.modifier = 0;
  assert.notDeepEqual(validate('GameView', below), []);
  const falseSight = damaged();
  falseSight.ancestry_choices[hardy]!.dark_sight = false;
  assert.notDeepEqual(validate('GameView', falseSight), []);
});

// Breaks: a compiled release admits an ancestry key that player commands cannot address.
test('compiled ancestry keys use the command Key shape', () => {
  assert.deepEqual(validate('CompiledCartridge', compiled()), []);
  const bad = compiled();
  bad.ancestries['Bad Key'] = bad.ancestries.strong;
  delete bad.ancestries.strong;
  assert.notDeepEqual(validate('CompiledCartridge', bad), []);
});
