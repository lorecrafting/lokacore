// The add menu's gates (allowed.ts) and seeds (card.ts SEEDS) for fields the compiler takes only beside another.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { added, allowed } from '../play/card.ts';

const defs = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../schemas/source/defs.schema.json'), 'utf8'),
).$defs;

// Break: a field offered before the one the compiler needs beside it (dependentRequired, skills.ex:107,
// derived.ex:70, population.ex:117 and :153, trails.ex:139-140; a capacity beside container, not on a
// template: entities.ex:227-232, death.ex:137; a block_chance off-hand, its block narrated: skills.ex:230-231,
// :245-256), or seeded short of what it counts.
test('a field waits for the field it needs; a seeded one carries every key the compiler counts', () => {
  const pass = (kind: string, f: string, doc: object, caps = {}, world = {}) =>
    allowed(kind, [f], caps, doc as Record<string, unknown>, world).length === 1;
  assert.deepEqual(
    [pass('liquids', 'amount', {}), pass('liquids', 'amount', { resource: 'hp' })],
    [false, true],
  );
  assert.deepEqual(
    [pass('skills', 'hidden', {}), pass('skills', 'hidden', { prerequisite: {} })],
    [false, true],
  );
  assert.deepEqual(
    [pass('skills', 'ranks', {}), pass('skills', 'ranks', { growth: [2] })],
    [false, true],
  );
  assert.deepEqual(
    [pass('items', 'intended_level', {}), pass('items', 'intended_level', { affects: {} })],
    [false, true],
  );
  const floor = [{ day_target: 1 }, { day_target: 0 }, { day_target: 1, chance: 50 }];
  assert.deepEqual(
    floor.map((d) => pass('populations', 'floor', d)),
    [true, false, false],
  );
  assert.deepEqual(
    [pass('populations', 'sight', { member_role: 'prey' }), pass('populations', 'sight', {})],
    [true, false],
  );
  const trails = { trails: { leads: [] } };
  assert.deepEqual(
    [
      pass('populations', 'trail', {}, { fact: 1 }, trails),
      pass('populations', 'hunts', {}, { fact: 1 }, {}),
      pass('populations', 'hunts', {}, {}, trails),
    ],
    [true, false, false],
  );
  const held = [{}, { container: true }, { container: true, location: { in: 'template' } }];
  assert.deepEqual(
    held.map((d) => pass('items', 'capacity', d)),
    [false, true, false],
  );
  const t = { prose: '~' };
  const narrated = { combat: { narration: { block: t } } };
  assert.deepEqual(
    [
      pass('items', 'block_chance', { slot: 'off_hand' }, {}, narrated),
      pass('items', 'block_chance', { slot: 'wield' }, {}, narrated),
      pass('items', 'block_chance', { slot: 'off_hand' }, {}, { combat: {} }),
    ],
    [true, false, false],
  );
  const away = { north: t, south: t, east: t, west: t, up: t, down: t };
  assert.deepEqual(added({ growth: [2, 4] }, 'ranks', defs, 'source.SkillDefinition')?.ranks, [
    { name: t },
    { name: t },
    { name: t },
  ]);
  assert.deepEqual(added({}, 'ambient', defs, 'source.NpcDefinition'), {
    ambient: [{ every: 1, lines: [t] }],
  });
  assert.deepEqual(added({}, 'sight', defs, 'source.PopulationPlan'), {
    sight: { delay: 1, narration: away },
  });
  const pack = added({}, 'pack', defs, 'source.PopulationPlan')?.pack as { narration: object };
  assert.deepEqual(pack.narration, {
    helper_joined: t,
    enemy_fled: away,
    primary_changed: t,
    pack_withdrew: t,
  });
});

// Break: a policy field or an ambient offered on a cartridge that does not lock policy or emote
// (resolve.ex:415; emotes.ex:3-4, :25), which the compiler refuses as UNDECLARED_CAPABILITY.
test('a policy field waits for policy and an ambient for emote', () => {
  const rows = [
    ['barriers', 'opens_when', 'policy'],
    ['dialogues', 'policy', 'policy'],
    ['dialogues.choices', 'policy', 'policy'],
    ['populations', 'birth_when', 'policy'],
    ['populations', 'wander_when', 'policy'],
    ['npcs', 'ambient', 'emote'],
    ['items', 'ambient', 'emote'],
    ['rooms', 'ambient', 'emote'],
  ];
  const offered = (caps: object) => rows.filter(([k, f]) => allowed(k, [f], caps).length).length;
  assert.deepEqual([offered({}), offered({ policy: 1, emote: 1 })], [0, rows.length]);
});
