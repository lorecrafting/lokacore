import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  step,
  gameView,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { value } from '../src/mechanics/fact.ts';
import { read } from './read.ts';

const artifact = read('kernel/ts/test/fixtures/c6-provisional-artifact.json');
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw Error(JSON.stringify(loaded));
const cartridge = loaded.cartridge as Cartridge;
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
function setup(hour = 18) {
  const fresh = newWorld(cartridge, context, [1, 2, 3, 4]);
  const room = Object.entries(fresh.rooms).find(([, r]) => r.key === 'hound_run')![0];
  let world: World = {
    ...fresh,
    state: {
      ...fresh.state,
      clock: hour * 3600,
      containers: { ...fresh.state.containers, [fresh.body]: room as never },
    },
  };
  let ordinal = 1;
  const command = (payload: object) => {
    const result = step(
      world,
      {
        id: id(ordinal),
        world_context_id: world.context,
        payload: { ...payload, actor_id: world.character },
      } as never,
      ordinal++,
    );
    world = result.world;
    return result.decision;
  };
  const view = () => gameView(world);
  const attempt = () => Object.values(world.state.expeditions ?? {})[0];
  const detail = (key: string) =>
    Object.entries(world.details).find(([, d]) => d.key === key)![0] as never;
  return { command, view, attempt, detail, world: () => world };
}

// Breaks: credit comes from the current room, a repeat, or a skipped edge instead of a fresh accepted transfer.
test('five ordered post-start entries alone resolve S27 and lower faction once', () => {
  const a = setup(18);
  const accepted = (payload: object) => {
    const decision = a.command(payload);
    assert.equal(
      decision.kind,
      'accepted',
      `${JSON.stringify(payload)}: ${JSON.stringify(decision)}`,
    );
  };
  accepted({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' });
  assert.equal(a.attempt()?.cursor, 0);
  assert.ok(a.view().combat);
  accepted({ type: 'flee' });
  if (a.view().place.title.key === 'room.adder_nest.title')
    accepted({ type: 'move', direction: 'west' });
  if (a.view().place.title.key === 'room.hound_run.title')
    accepted({ type: 'move', direction: 'west' });
  assert.equal(a.attempt()?.cursor, 1);
  for (const [direction, cursor] of [
    ['west', 2],
    ['south', 3],
    ['north', 4],
    ['east', 5],
  ] as const) {
    accepted({ type: 'move', direction });
    assert.equal(a.attempt()?.cursor, cursor);
  }
  assert.equal(a.attempt()?.status, 'completed');
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'a_night_in_the_marsh')?.state,
    'resolved',
  );
  const spec = Object.values(a.world().cartridge.quests ?? {}).find(
    (q) => q.expedition,
  )!.expedition!;
  assert.equal(value(a.world(), a.world().character, spec.survived_fact), true);
  assert.equal(value(a.world(), a.world().character, spec.faction), -1);
  assert.equal(a.view().time, 64800);
});

// Breaks: an outside-footprint exit retains old credit, or a stale prior attempt can use shelter after retry.
test('departure fails only the attempt and Restart immediately binds a new identity', () => {
  const a = setup(23);
  const start = a.command({
    type: 'expedition',
    detail_id: a.detail('gnawed_bones'),
    transition: 'start',
  });
  assert.equal(start.kind, 'accepted');
  const first = a.attempt()!.attempt_id;
  assert.equal(a.command({ type: 'flee' }).kind, 'accepted');
  if (a.view().place.title.key === 'room.adder_nest.title')
    assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  if (a.view().place.title.key === 'room.hound_run.title')
    assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(a.attempt()?.cursor, 1);
  assert.equal(a.command({ type: 'move', direction: 'north' }).kind, 'accepted');
  assert.equal(a.attempt()?.status, 'failed');
  assert.equal(a.attempt()?.cursor, 0);
  // Use ordinary exits to regain Hound Run; no clock or hound replacement gate applies.
  assert.equal(a.command({ type: 'move', direction: 'south' }).kind, 'accepted');
  assert.equal(a.command({ type: 'move', direction: 'east' }).kind, 'accepted');
  const prior = a.attempt()!;
  const restart = a.command({
    type: 'expedition',
    detail_id: a.detail('gnawed_bones'),
    transition: 'restart',
    quest_instance_id: prior.quest_instance_id,
    attempt_id: first,
  });
  assert.equal(restart.kind, 'accepted', JSON.stringify(restart));
  assert.equal(a.attempt()?.cursor, 0);
  assert.notEqual(a.attempt()?.attempt_id, first);
  assert.equal(a.view().time, 82800);
});
