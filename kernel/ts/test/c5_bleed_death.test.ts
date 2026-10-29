import assert from 'node:assert/strict';
import { test } from 'node:test';
import { key } from '../src/foundation/compose.ts';
import type { World } from '../src/index.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { acquisition } from '../src/mechanics/skills.ts';
import { command, elapsed, fixture, sampler } from './c5_bleed_fixture.ts';

const { prefix, ref } = sampler;

// Inline water route: a swim skill, a surface and a dark bottom whose 50-unit breath ends at 65000.
function water(c: any) {
  for (const cap of ['water', 'light']) {
    c.lock.capabilities[cap] = 1;
    c.manifest.requires.capabilities[cap] = 1;
  }
  const room = (key: string, exits: object, dark = false) => {
    c.rooms[`${prefix}:room/${key}`] = {
      key,
      title: 'room.burrow.title',
      description: 'room.burrow.description',
      ...(dark ? { dark_description: 'room.burrow.description' } : {}),
      exits,
    };
  };
  room('pool', { down: { to: ref('room', 'pool_bottom') } });
  room('pool_bottom', { up: { to: ref('room', 'pool') } }, true);
  c.skills[`${prefix}:skill/swim`] = {
    key: 'swim',
    label: 'skill.bandage.label',
    requirement: 'skill.bandage.requirement',
    qualification: { op: 'all', items: [] },
  };
  c.facts[`${prefix}:fact/skill_swim`] = {
    key: 'skill_swim',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: "Skill swim's acquisition (skills@1): only skills@1 writes it.",
  };
  c.world.carry = { max_grams: 20000 };
  c.world.water = {
    skill: ref('skill', 'swim'),
    maximum_grams: 6000,
    entry_cost: 10,
    duration: 50,
    warning: 'narration.bleed.tick',
    drowned: 'narration.bleed.tick',
    routes: [{ surface: ref('room', 'pool'), bottom: ref('room', 'pool_bottom') }],
  };
}

// Breaks: a real noncombat death returns the body with its old bleed and due job still live.
test('short water expiry clears active bleed before shrine return', () => {
  const { world, target } = fixture(100, 10, water);
  const hp = resourceRef(world, 'hp');
  const attack = command(world, 1, { type: 'attack', target_id: target }, 1);
  assert.equal(attack.decision.kind, 'accepted');
  const wound = elapsed(attack.world, 64950, 2);
  assert.equal(wound.decision.kind, 'accepted', JSON.stringify(wound.decision));
  const bleed = wound.world.state.bleeds![world.body]!;
  assert.ok(bleed.active);
  const fled = command(wound.world, 3, { type: 'flee' }, 3);
  assert.equal(fled.decision.kind, 'accepted');
  const skill = key({
    kind: 'fact',
    fact: acquisition(ref('skill', 'swim')),
    scope: { kind: 'player', character_id: world.character },
  });
  const near: World = {
    ...fled.world,
    state: {
      ...fled.world.state,
      containers: {
        ...fled.world.state.containers,
        [world.body]: world.roomIds[`${prefix}:room/pool`],
      },
      facts: { ...fled.world.state.facts, [skill]: true },
    },
  };
  const entered = command(near, 4, { type: 'move', direction: 'down' }, 4);
  assert.equal(entered.decision.kind, 'accepted', JSON.stringify(entered.decision));
  assert.equal(entered.world.state.water![world.character].deadline, 65000);
  const died = elapsed(entered.world, 65000, 5);
  assert.equal(died.decision.kind, 'accepted', JSON.stringify(died.decision));
  assert.equal(died.world.state.bleeds![world.body]!.active, false);
  assert.equal(died.world.state.jobs![bleed.job_id!].status, 'cancelled');
  assert.equal(level(died.world, world.body, hp), 10);
  assert.equal(died.world.state.containers[world.body], world.roomIds[`${prefix}:room/shrine`]);
  const later = elapsed(died.world, 65050, 6);
  assert.equal(later.decision.kind, 'accepted');
  assert.equal(level(later.world, world.body, hp), 10);
});
