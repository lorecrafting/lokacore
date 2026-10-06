import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed, type World } from '../src/index.ts';
import { acquisition } from '../src/mechanics/skills.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { refString, type Cartridge } from '../src/runtime/decision.ts';
import { read } from './read.ts';

const run = 'aaaaaaaa-0000-4000-8000-000000000010' as never;
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;
function command(world: World, n: number, payload: object) {
  return step(
    world,
    {
      id: id(n),
      world_context_id: world.context,
      payload: { ...payload, actor_id: world.character },
    } as never,
    n,
  );
}
function elapsed(world: World, until: number, n: number) {
  return stepElapsed(
    world,
    {
      id: elapsedCommandId(run, world.context, world.state.clock, until) as never,
      world_context_id: world.context,
      payload: {
        type: 'elapsed',
        actor_id: world.character,
        run_id: run,
        from: world.state.clock,
        until,
      },
    },
    n,
  );
}

// Breaks: a real noncombat death returns the body with its old bleed and due job still live.
test('authored short water expiry clears active bleed before Chapel return', () => {
  const content = JSON.parse(read('protocol/fixtures/missing_child_v037_hash.json').canonical);
  content.world.water.duration = 50;
  const canonical = encode(content);
  const hash = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: content, content_hash: hash })),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(loaded.cartridge as Cartridge, id(100), [1, 2, 3, 4]);
  const target = Object.entries(fresh.state.created ?? {}).find(
    ([, e]) => e.origin.kind === 'spawned' && e.origin.role === 'hound',
  )![0];
  const entities = { ...fresh.entities } as Record<string, any>;
  for (const [member, e] of Object.entries(fresh.state.created ?? {}))
    if (e.origin.kind === 'spawned' && e.origin.role === 'hound')
      entities[member] = {
        ...entities[member],
        attack: { ...entities[member].attack, chance: 100 },
      };
  const hp = resourceRef(fresh, 'hp');
  const world: World = {
    ...fresh,
    entities,
    cartridge: {
      ...fresh.cartridge,
      world: {
        ...fresh.cartridge.world!,
        combat: {
          ...fresh.cartridge.world!.combat!,
          player_attack: { chance: 0, damage_min: 1, damage_max: 1 },
          dodge: undefined,
        },
      },
    },
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [fresh.body]: fresh.state.containers[target] },
      resources: {
        ...fresh.state.resources,
        [key({ kind: 'resource', entity_id: fresh.body, resource: hp })]: { value: 10, at: 64800 },
      },
    },
  };
  const attack = command(world, 1, { type: 'attack', target_id: target });
  assert.equal(attack.decision.kind, 'accepted');
  const wound = elapsed(attack.world, 64950, 2);
  assert.equal(wound.decision.kind, 'accepted', JSON.stringify(wound.decision));
  const bleed = wound.world.state.bleeds![world.body]!;
  assert.ok(bleed.active);
  const fled = command(wound.world, 3, { type: 'flee' });
  assert.equal(fled.decision.kind, 'accepted');
  const well = fled.world.roomIds[refString({ ...content.entry, key: 'well_shaft' })];
  const skill = acquisition(content.world.water.skill);
  const scoped = key({
    kind: 'fact',
    fact: skill,
    scope: { kind: 'player', character_id: world.character },
  });
  const near: World = {
    ...fled.world,
    state: {
      ...fled.world.state,
      containers: { ...fled.world.state.containers, [world.body]: well },
      facts: { ...fled.world.state.facts, [scoped]: true },
    },
  };
  const entered = command(near, 4, { type: 'move', direction: 'down' });
  assert.equal(entered.decision.kind, 'accepted', JSON.stringify(entered.decision));
  assert.equal(entered.world.state.water![world.character].deadline, 65000);
  const died = elapsed(entered.world, 65000, 5);
  assert.equal(died.decision.kind, 'accepted', JSON.stringify(died.decision));
  assert.equal(died.world.state.bleeds![world.body]!.active, false);
  assert.equal(died.world.state.jobs![bleed.job_id!].status, 'cancelled');
  assert.equal(level(died.world, world.body, hp), 10);
  assert.equal(
    died.world.state.containers[world.body],
    died.world.roomIds[refString({ ...content.entry, key: 'chapel_nave' })],
  );
  const later = elapsed(died.world, 65050, 6);
  assert.equal(later.decision.kind, 'accepted');
  assert.equal(level(later.world, world.body, hp), 10);
});
