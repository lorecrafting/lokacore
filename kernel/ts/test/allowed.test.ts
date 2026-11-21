// The add menu's gates (allowed.ts) and seeds (card.ts SEEDS) for fields the compiler takes only beside another.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { added, allowed, blocked, held } from '../play/card.ts';
import { contentGraph } from '../play/reach.ts';
import { turnOn } from '../play/allowed.ts';

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
    // a reaction's `once`/`cooldown` lowers a guard into `when` (reaction_once.ex), so the
    // engine's own lowering needs policy too, not only an authored when
    ['reactions', 'when', 'policy'],
    ['npcs', 'ambient', 'emote'],
    ['items', 'ambient', 'emote'],
    ['rooms', 'ambient', 'emote'],
  ];
  const offered = (caps: object) => rows.filter(([k, f]) => allowed(k, [f], caps).length).length;
  assert.deepEqual([offered({}), offered({ policy: 1, emote: 1 })], [0, rows.length]);
});

// Break: an added capacity is 1 on a container already holding two items, which the compiler refuses
// (CAPACITY_EXCEEDED, entities.ex:250-253), or the count takes a room's items as the container's.
test('an added capacity starts at the items the compiled graph places inside, at least 1', () => {
  const ref = (kind: string, key: string) => ({
    cartridge_id: 'c',
    cartridge_version: '1',
    kind,
    key,
  });
  const inBox = { location: { in: 'item', item: ref('item', 'box') } };
  const inHall = { location: { in: 'room', room: ref('room', 'hall') } };
  const { edges } = contentGraph({
    items: {
      'c@1:item/box': inHall,
      'c@1:item/jar': inHall,
      'c@1:item/a': inBox,
      'c@1:item/b': inBox,
    },
  });
  const cap = (r: string) => added({}, 'capacity', defs, 'source.ItemDefinition', held(edges, r));
  assert.deepEqual(cap('c@1:item/box'), { capacity: 2 });
  assert.deepEqual(cap('c@1:item/a'), { capacity: 1 }); // holds nothing
  assert.deepEqual(cap('c@1:room/hall'), { capacity: 1 }); // the box and jar are in the hall, not items in it
});

// Break: a field the registry holds disappears from the add menu with no reason, so the author cannot
// tell "your cartridge lacks schedule" from "this card cannot hold it" (loka-wfrgk.94's go/no-go F8).
// The two halves must partition the menu: nothing listed twice, nothing lost between them.
test("a menu's refused fields come back with the reason, and the halves partition the menu", () => {
  const npc = ['ask', 'attack', 'daily_schedule', 'hp', 'name_variants', 'shop'];
  // the cartridge declares schedule and not speech: daily_schedule is addable, ask is refused for it
  const caps = { schedule: 1, description_variant: 1 };
  assert.deepEqual(blocked('npcs', npc, caps), [
    { field: 'ask', caps: ['speech', 'topic'], needs: false }, // OWNERS: 'speech topic'
    { field: 'attack', caps: ['combat'], needs: true }, // world.combat and the NPC's hp too
    { field: 'shop', caps: ['commerce'], needs: false },
  ]);
  // the halves partition: every registry field the card offered lands in exactly one
  const yes = allowed('npcs', npc, caps);
  const no = blocked('npcs', npc, caps).map((b) => b.field);
  assert.deepEqual([...yes, ...no].sort(), [...npc].sort());
  // a field whose only bar is a need the definition fails: no capability missing, so caps is empty
  assert.deepEqual(blocked('npcs', ['daily_schedule'], { schedule: 1 }, { spawn_template: true }), [
    { field: 'daily_schedule', caps: [], needs: true }, // calendar.ex template_schedules
  ]);
});

// Break: Add mechanic… turning on the wrong capability, a stale version, one of several missing, or
// offering a turn-on for a field whose own need no capability can meet (book-ui.md generic sheet).
test('turnOn writes each missing owning capability at its registry version, or nothing', () => {
  const cart = { requires: { capabilities: { speech: 1 } }, world: {} };
  const at = (cap: string, version: number) => ({
    path: ['requires', 'capabilities', cap],
    value: version,
  });
  assert.deepEqual(turnOn('actions', 'policy', cart), [at('policy', 1)]);
  assert.deepEqual(turnOn('items', 'edible', cart), [
    at('food', 1),
    at('resource', 1),
    at('containment', 1),
  ]); // OWNERS 'food resource containment'; registry versions all 1
  assert.deepEqual(turnOn('npcs', 'ask', cart), [at('topic', 1)]); // speech is already on
  // world.combat unset: a world number, not a capability, so no turn-on (the row stays greyed)
  assert.equal(turnOn('npcs', 'attack', cart, { hp: 5 }), undefined);
  assert.deepEqual(turnOn('npcs', 'attack', { ...cart, world: { combat: {} } }, { hp: 5 }), [
    at('combat', 1),
  ]);
});
