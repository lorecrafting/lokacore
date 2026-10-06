import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from './read.ts';
import { loadCartridge, INSTALLED, newWorld, step, stepElapsed, gameView } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import { resolved } from '../src/commands/actions.ts';

// Provisional input artifact; literal HP/time answers below are independent of its compiler.
const artifact = read('kernel/ts/test/fixtures/c5-provisional-artifact.json');
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const cartridge = loaded.cartridge as Cartridge;
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const run = 'aaaaaaaa-0000-4000-8000-000000000010' as never;
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;

function fixture(chance = 100, hp = 10) {
  const fresh = newWorld(cartridge, context, [1, 2, 3, 4]);
  const hounds = Object.entries(fresh.state.created ?? {}).filter(
    ([, e]) => e.origin?.kind === 'spawned' && e.origin.role === 'hound',
  );
  const target = hounds[0]![0] as never;
  const room = fresh.state.containers[target];
  const entities = { ...fresh.entities } as Record<string, any>;
  for (const [member] of hounds)
    entities[member] = { ...entities[member], attack: { ...entities[member].attack, chance } };
  const combat = fresh.cartridge.world!.combat!;
  const world: World = {
    ...fresh,
    entities,
    cartridge: {
      ...fresh.cartridge,
      world: {
        ...fresh.cartridge.world!,
        combat: {
          ...combat,
          player_attack: { chance: 0, damage_min: 1, damage_max: 1 },
          dodge: undefined,
        },
      },
    },
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [fresh.body]: room },
      resources: {
        ...fresh.state.resources,
        [key({ kind: 'resource', entity_id: fresh.body, resource: resourceRef(fresh, 'hp') })]: {
          value: hp,
          at: 64800,
        },
      },
    },
  };
  return { world, target, room };
}

function command(world: World, n: number, payload: object, revision: number) {
  return step(
    world,
    {
      id: id(n),
      world_context_id: world.context,
      payload: { ...payload, actor_id: world.character },
    } as never,
    revision,
  );
}

function elapsed(world: World, until: number, revision: number) {
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
    revision,
  );
}

const hp = (world: World) => level(world, world.body, resourceRef(world, 'hp'));

function readyBandage(world: World) {
  const item = Object.entries(world.entities).find(([, e]) => e.kind === 'item' && e.bandage)![0];
  const skill = {
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.35',
    kind: 'fact',
    key: 'skill_bandage',
  };
  const fact = key({
    kind: 'fact',
    fact: skill,
    scope: { kind: 'player', character_id: world.character },
  });
  const ready = {
    ...world,
    state: {
      ...world.state,
      containers: { ...world.state.containers, [item]: world.body },
      facts: { ...world.state.facts, [fact]: true },
    },
  } as World;
  return { ready, item };
}

// Breaks: a real positive surviving hound hit creates no timed wound, or a miss creates one.
test('only a surviving positive hound strike applies one owned bleed', () => {
  for (const [chance, initial, expected, bleeding] of [
    [100, 10, 9, true],
    [0, 10, 10, false],
    [100, 1, 10, false],
  ] as const) {
    const { world, target } = fixture(chance, initial);
    const begun = command(world, 1, { type: 'attack', target_id: target }, 1);
    assert.equal(begun.decision.kind, 'accepted');
    const due = elapsed(begun.world, 64950, 2);
    assert.equal(due.decision.kind, 'accepted', JSON.stringify(due.decision));
    assert.equal(hp(due.world), expected);
    assert.equal(!!due.world.state.bleeds?.[world.body]?.active, bleeding);
    if (bleeding) {
      const row = due.world.state.bleeds![world.body]!;
      assert.ok(row.active);
      assert.equal(row.generation, 1);
      assert.equal(row.next_tick_at, 65050);
      assert.equal(row.ends_at, 65250);
      assert.equal(due.world.state.jobs![row.job_id!].due_time, 65050);
      assert.deepEqual(gameView(due.world).bleeding, {
        label: 'condition.bleeding',
        generation: 1,
        ends_at: 65250,
        next_tick_at: 65050,
        hp_loss: 1,
        tick_every: 100,
      });
      assert.ok(
        due.decision.kind === 'accepted' &&
          due.decision.narration?.some((line) => line.key === 'narration.bleed.applied'),
      );
    }
  }
});

// Breaks: the next pack hound replaces the wound's original producer and faults its real round.
test('a second hound hit refreshes the original source and pending cadence', () => {
  const { world, target } = fixture();
  const begun = command(world, 1, { type: 'attack', target_id: target }, 1);
  const first = elapsed(begun.world, 64950, 2);
  const row = first.world.state.bleeds![world.body]!;
  assert.ok(row.active);
  const tick = elapsed(first.world, 65050, 3);
  assert.equal(tick.decision.kind, 'accepted');
  const next = elapsed(tick.world, 65100, 4);
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  assert.ok(
    next.decision.kind === 'accepted' &&
      next.decision.events.some(
        (e) =>
          e.payload.type === 'attack_result' &&
          e.payload.loss > 0 &&
          e.payload.attacker_id !== row.source_id,
      ),
  );
  const refreshed = next.world.state.bleeds![world.body]!;
  assert.ok(refreshed.active);
  assert.equal(refreshed.source_id, row.source_id);
  assert.equal(refreshed.next_tick_at, 65150);
  const ticking = tick.world.state.bleeds![world.body]!;
  assert.ok(ticking.active);
  assert.equal(refreshed.job_id, ticking.job_id);
});

// Breaks: a final cadence later than the refreshed end rejects its lawful expiry job.
test('off-cadence re-engagement reaches the earlier expiry without an extra hit', () => {
  const { world, target, room } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const fled = command(first.world, 2, { type: 'flee' }, 3);
  assert.equal(fled.decision.kind, 'accepted');
  const waited = elapsed(fled.world, 64975, 4);
  const from = waited.world.state.containers[world.body];
  const direction = Object.entries(waited.world.rooms[from].exits).find(
    ([, edge]) => waited.world.roomIds[refString(edge.to)] === room,
  )?.[0];
  assert.ok(direction);
  const returned = command(waited.world, 3, { type: 'move', direction }, 5);
  assert.equal(returned.decision.kind, 'accepted');
  const engaged = command(returned.world, 4, { type: 'attack', target_id: target }, 6);
  assert.equal(engaged.decision.kind, 'accepted');
  const tick = elapsed(engaged.world, 65050, 7);
  assert.equal(tick.decision.kind, 'accepted', JSON.stringify(tick.decision));
  const second = elapsed(tick.world, 65125, 8);
  assert.equal(second.decision.kind, 'accepted', JSON.stringify(second.decision));
  const bleed = second.world.state.bleeds![world.body]!;
  assert.ok(bleed.active);
  assert.equal(bleed.ends_at, 65425);
  const escaped = command(second.world, 5, { type: 'flee' }, 9);
  assert.equal(escaped.decision.kind, 'accepted');
  let before = escaped;
  for (const [i, at] of [65150, 65250, 65350].entries()) {
    before = elapsed(before.world, at, i + 10);
    assert.equal(before.decision.kind, 'accepted', JSON.stringify(before.decision));
  }
  const pending = before.world.state.bleeds![world.body]!;
  assert.ok(pending.active);
  assert.equal(pending.next_tick_at, 65450);
  assert.equal(before.world.state.jobs![pending.job_id!].due_time, 65425);
  const end = elapsed(before.world, 65425, 13);
  assert.equal(end.decision.kind, 'accepted', JSON.stringify(end.decision));
  assert.equal(end.world.state.bleeds![world.body]!.active, false);
  assert.equal(hp(end.world), hp(before.world));
});

// Breaks: a real tick damages after cure, expiry damages at its exclusive end, or a held item is spent without qualified active treatment.
test('one held qualified bandage cures after one tick and keeps exact HP', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  assert.equal(first.decision.kind, 'accepted');
  const fled = command(first.world, 2, { type: 'flee' }, 3);
  assert.equal(fled.decision.kind, 'accepted');
  const tick = elapsed(fled.world, 65050, 4);
  assert.equal(tick.decision.kind, 'accepted', JSON.stringify(tick.decision));
  assert.equal(hp(tick.world), 8);
  const { ready, item: bandage } = readyBandage(tick.world);
  const row = ready.state.bleeds![world.body]!;
  assert.deepEqual(
    gameView(ready)
      .inventory.find((e) => e.id === bandage)
      ?.actions.filter((a) => a.action_key === 'bandage')
      .map((a) => a.available),
    [true],
  );
  const cured = command(
    ready,
    3,
    { type: 'bandage', item_id: bandage, effect_generation: row.generation },
    5,
  );
  assert.equal(cured.decision.kind, 'accepted', JSON.stringify(cured.decision));
  assert.equal(cured.world.state.containers[bandage], world.consumed);
  assert.equal(cured.world.state.bleeds![world.body]!.active, false);
  assert.equal(hp(cured.world), 8);
  const later = elapsed(cured.world, 65150, 6);
  assert.equal(later.decision.kind, 'accepted');
  assert.equal(hp(later.world), 8);
});

// Breaks: separate due-job writer groups make a lawful re-engaged round and bleed tick fault atomically.
test('Flee and re-engagement pair the exact same-due round and bleed tick', () => {
  const orders = new Set<string>();
  for (let n = 4; n < 20 && orders.size < 2; n++) {
    const { world, target, room } = fixture();
    const first = elapsed(
      command(world, 1, { type: 'attack', target_id: target }, 1).world,
      64950,
      2,
    );
    assert.equal(first.decision.kind, 'accepted');
    const fled = command(first.world, 2, { type: 'flee' }, 3);
    assert.equal(fled.decision.kind, 'accepted');
    const waited = elapsed(fled.world, 65000, 4);
    assert.equal(waited.decision.kind, 'accepted');
    const from = waited.world.state.containers[world.body];
    const direction = Object.entries(waited.world.rooms[from].exits).find(
      ([, edge]) => waited.world.roomIds[refString(edge.to)] === room,
    )?.[0];
    assert.ok(direction);
    const returned = command(waited.world, 3, { type: 'move', direction }, 5);
    assert.equal(returned.decision.kind, 'accepted', JSON.stringify(returned.decision));
    const second = command(returned.world, n, { type: 'attack', target_id: target }, 6);
    assert.equal(second.decision.kind, 'accepted', JSON.stringify(second.decision));
    const tick = elapsed(second.world, 65050, 7);
    assert.equal(tick.decision.kind, 'accepted', JSON.stringify(tick.decision));
    const row = Object.values(tick.world.state.encounters ?? {}).find((e) => e.status === 'open')!;
    const bleed = tick.world.state.bleeds![world.body]!;
    assert.ok(bleed.active);
    assert.equal(tick.world.state.jobs![row.job_id].due_time, 65150);
    assert.equal(tick.world.state.jobs![bleed.job_id!].due_time, 65150);
    orders.add(row.job_id < bleed.job_id! ? 'round_first' : 'bleed_first');
    const paired = elapsed(tick.world, 65150, 8);
    assert.equal(paired.decision.kind, 'accepted', JSON.stringify(paired.decision));
    assert.equal(hp(paired.world), 6);
    const refreshed = paired.world.state.bleeds![world.body]!;
    assert.ok(refreshed.active);
    assert.equal(refreshed.generation, 1);
    assert.equal(refreshed.next_tick_at, 65250);
    assert.equal(refreshed.ends_at, 65450);
  }
  assert.deepEqual([...orders].sort(), ['bleed_first', 'round_first']);
});

// Breaks: a fatal bleed tick leaves an active job that kills the Chapel-returned body again.
test('fatal tick closes bleed before same-body Chapel return', () => {
  const { world, target } = fixture(100, 2);
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  assert.equal(first.decision.kind, 'accepted', JSON.stringify(first.decision));
  assert.equal(hp(first.world), 1);
  const applied = first.world.state.bleeds![world.body]!;
  assert.ok(applied.active);
  const source = applied.source_id;
  const fled = command(first.world, 2, { type: 'flee' }, 3);
  assert.equal(fled.decision.kind, 'accepted');
  const fatal = elapsed(fled.world, 65050, 4);
  assert.equal(fatal.decision.kind, 'accepted', JSON.stringify(fatal.decision));
  assert.equal(fatal.world.state.bleeds![world.body]!.active, false);
  assert.equal(hp(fatal.world), 10);
  const deaths =
    fatal.decision.kind === 'accepted'
      ? fatal.decision.events.filter((e) => e.payload.type === 'entity_died')
      : [];
  assert.equal(deaths.length, 1);
  const died = deaths[0]?.payload;
  assert.ok(died && died.type === 'entity_died');
  assert.deepEqual(
    [died.cause, died.killer_id, died.credited_character_id],
    ['bleeding', source, null],
  );
  const later = elapsed(fatal.world, 65150, 5);
  assert.equal(later.decision.kind, 'accepted');
  assert.equal(hp(later.world), 10);
});

// Breaks: expiry at the exclusive end applies a third tick or leaves an active wound.
test('bleed expires at 65250 after exactly two HP ticks', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const fled = command(first.world, 2, { type: 'flee' }, 3);
  const tick1 = elapsed(fled.world, 65050, 4);
  assert.equal(tick1.decision.kind, 'accepted', JSON.stringify(tick1.decision));
  assert.deepEqual(
    tick1.decision.narration?.map((line) => line.key),
    ['narration.bleed.tick'],
  );
  const tick2 = elapsed(tick1.world, 65150, 5);
  assert.equal(tick2.decision.kind, 'accepted', JSON.stringify(tick2.decision));
  const end = elapsed(tick2.world, 65250, 6);
  assert.equal(end.decision.kind, 'accepted', JSON.stringify(end.decision));
  assert.deepEqual(
    end.decision.narration?.map((line) => line.key),
    ['narration.bleed.expired'],
  );
  assert.equal(hp(end.world), 7);
  assert.equal(end.world.state.bleeds![world.body]!.active, false);
});

// Breaks: the combat command filter hides or rejects the one exact treatment while initiative is open.
test('held qualified bandage treats during combat without spending its round', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  assert.equal(first.decision.kind, 'accepted');
  const { ready, item } = readyBandage(first.world);
  const row = ready.state.bleeds![world.body]!;
  const [encounterId, encounter] = Object.entries(ready.state.encounters ?? {}).find(
    ([, e]) => e.status === 'open',
  )!;
  assert.deepEqual(
    gameView(ready)
      .inventory.find((e) => e.id === item)
      ?.actions.filter((a) => a.action_key === 'bandage')
      .map((a) => a.available),
    [true],
  );
  const treated = command(
    ready,
    9,
    { type: 'bandage', item_id: item, effect_generation: row.generation },
    3,
  );
  assert.equal(treated.decision.kind, 'accepted', JSON.stringify(treated.decision));
  assert.equal(treated.world.state.encounters![encounterId].job_id, encounter.job_id);
  assert.equal(treated.world.state.encounters![encounterId].status, 'open');
  assert.equal(treated.world.state.containers[item], world.consumed);
  assert.equal(treated.world.state.bleeds![world.body]!.active, false);
});

// Breaks: broadening the combat command allowlist admits an authored perform recipe beside Bandage.
test('an authored recipe remains excluded while the hound fight offers Bandage', () => {
  const { world, target } = fixture();
  const first = command(world, 1, { type: 'attack', target_id: target }, 1);
  const fight = elapsed(first.world, 64950, 2).world;
  const { ready } = readyBandage(fight);
  assert.ok(Object.values(ready.cartridge.recipes ?? {}).some((r) => r.key === 'study_tracks'));
  assert.equal(resolved(ready, ready.character).study_tracks, undefined);
  assert.ok(Object.values(resolved(ready, ready.character)).some((a) => a.command === 'bandage'));
});

// Breaks: a stale Book button spends a held bandage against a later effect generation.
test('stale generation refuses with the exact held item and world intact', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const { ready, item } = readyBandage(first.world);
  const stale = command(
    ready,
    9,
    {
      type: 'bandage',
      item_id: item,
      effect_generation: ready.state.bleeds![world.body]!.generation + 1,
    },
    3,
  );
  assert.equal(stale.decision.kind, 'rejected');
  assert.equal(stale.decision.error.code, 'invalid_state');
  assert.equal(stale.world.state, ready.state);
  assert.equal(stale.world.state.containers[item], world.body);
});

// Breaks: mere ownership of a bandage bypasses Wick's acquired, current DEX qualification.
test('unlearned bandage cannot consume the held item', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const { ready, item } = readyBandage(first.world);
  const unlearned = {
    ...ready,
    state: { ...ready.state, facts: first.world.state.facts },
  } as World;
  const refused = command(
    unlearned,
    9,
    {
      type: 'bandage',
      item_id: item,
      effect_generation: unlearned.state.bleeds![world.body]!.generation,
    },
    3,
  );
  assert.equal(refused.decision.kind, 'rejected');
  assert.equal(refused.decision.error.code, 'invalid_state');
  assert.equal(refused.world.state, unlearned.state);
  assert.equal(refused.world.state.containers[item], world.body);
});

// Breaks: treatment reaches through another holder and spends an item outside direct custody.
test('nested bandage cannot cure the current generation', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const { ready, item } = readyBandage(first.world);
  const bag = Object.entries(ready.entities).find(([, e]) => e.kind === 'item' && e.container)![0];
  const nested = {
    ...ready,
    state: {
      ...ready.state,
      containers: { ...ready.state.containers, [bag]: world.body, [item]: bag },
    },
  } as World;
  const refused = command(
    nested,
    9,
    {
      type: 'bandage',
      item_id: item,
      effect_generation: nested.state.bleeds![world.body]!.generation,
    },
    3,
  );
  assert.equal(refused.decision.kind, 'rejected');
  assert.equal(refused.decision.error.code, 'not_owned');
  assert.equal(refused.world.state, nested.state);
  assert.equal(refused.world.state.containers[item], bag);
});
