import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  combatWorld,
  attack,
  elapsed,
  hp,
  rat,
  room,
  command,
  positioned,
} from './combat_fixture.ts';
import { step, gameView } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { positionOf } from '../src/mechanics/position/shared.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { value } from '../src/mechanics/fact.ts';

const pools = (w: ReturnType<typeof combatWorld>) => [
  level(w, w.body, resourceRef(w, 'hp')),
  level(w, rat(w), resourceRef(w, 'hp')),
  w.state.rng,
];
// Breaks: immediate attack, dropped due-job RNG, wrong initiative, miss/fixed-damage extra draws.
test('frozen M4 A runs through real Attack and two trusted elapsed proposals', () => {
  const first = attack(combatWorld());
  assert.equal(first.decision.kind, 'accepted', JSON.stringify(first.decision));
  assert.deepEqual(pools(first.world), [10, 6, [1, 2, 3, 4]]);
  const one = elapsed(first.world, 150);
  assert.equal(one.decision.kind, 'accepted', JSON.stringify(one.decision));
  assert.deepEqual(pools(one.world), [9, 5, [25179138, 12295, 540162, 2107404]]);
  const two = elapsed(one.world, 300, 3);
  assert.equal(two.decision.kind, 'accepted', JSON.stringify(two.decision));
  assert.deepEqual(pools(two.world), [8, 5, [15224335, 29364750, 272377353, 1125134346]]);
  const fight = engaged(two.world, two.world.body)!;
  assert.equal(fight.row.round, 3);
  assert.equal(two.world.state.jobs![fight.row.job_id].due_time, 450);
});

// Breaks: dead retaliation, duplicate death, unhydrated intermediate corpse suppresses earned credit.
test('frozen M4 B closes before retaliation and credits the exact third rat at proposal.now', () => {
  const w = combatWorld();
  const begun = attack(hp(w, rat(w, 3), 1), 3);
  const next = elapsed(begun.world, 150);
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  if (next.decision.kind !== 'accepted') return;
  assert.deepEqual(next.world.state.rng, [12295, 1029, 1029, 25165824]);
  assert.equal(level(next.world, next.world.body, resourceRef(w, 'hp')), 10);
  assert.equal(engaged(next.world, w.body), undefined);
  assert.equal(Object.keys(next.world.state.created ?? {}).length, 1);
  assert.deepEqual(
    next.decision.events.map((e) => e.payload.type),
    ['attack_result', 'entity_died', 'fact_changed'],
  );
  assert.deepEqual(
    w.cartridge.world!.death_credit!.map((m) => value(next.world, w.character, m.fact)),
    [false, false, true, false, false],
  );
});

// Breaks: revival leaves the closed round alive or lets the restored body retaliate.
test('frozen M4 C dies sleeping on the rat-first round and returns the same body', () => {
  const one = elapsed(attack(combatWorld()).world, 150);
  const sleep = positioned(one.world, 'sleeping');
  const w = hp(hp(sleep, rat(sleep), 6), sleep.body, 2);
  const controlled = { ...w, state: { ...w.state, rng: [12295, 1029, 1029, 25165824] } };
  const next = elapsed(controlled, 300, 4);
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  assert.deepEqual(pools(next.world), [10, 6, [25179138, 12295, 540162, 2107404]]);
  assert.equal(positionOf(next.world, w.character), 'standing');
  assert.equal(next.world.state.containers[w.body], room(w, 'chapel_nave'));
  assert.equal(level(next.world, w.body, resourceRef(w, 'mv')), 100);
  assert.equal(engaged(next.world, w.body), undefined);
});

// Breaks: flee forgets the future round, charges ordinary/double cost, or retaliates on escape.
test('one-exit Flee pays once and cancels its future round without drawing', () => {
  const w = attack(combatWorld()).world;
  const before = engaged(w, w.body)!;
  const next = step(w, command(w, { type: 'flee', actor_id: w.character }, 2), 2);
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  assert.equal(level(next.world, w.body, resourceRef(w, 'mv')), 98);
  assert.equal(next.world.state.containers[w.body], room(w, 'drowned_lantern'));
  assert.equal(next.world.state.jobs![before.row.job_id].status, 'cancelled');
  const later = elapsed(next.world, 150, 3);
  assert.equal(later.decision.kind, 'accepted');
  assert.deepEqual(later.world.state.rng, [1, 2, 3, 4]);
  assert.equal(engaged(later.world, w.body), undefined);
});

// Breaks: waking after both opportunities, waking a miss, or silently standing sitting/resting actors.
test('a surviving sleeper wakes before its remaining opportunity, other positions skip', () => {
  for (const position of ['sleep', 'sit', 'rest'] as const) {
    const one = elapsed(attack(combatWorld()).world, 150);
    const seated = positioned(
      one.world,
      position === 'sleep' ? 'sleeping' : position === 'sit' ? 'sitting' : 'resting',
    );
    const w = hp(hp(seated, rat(seated), 6), seated.body, 4);
    const next = elapsed(
      { ...w, state: { ...w.state, rng: [12295, 1029, 1029, 25165824] } },
      300,
      4,
    );
    assert.equal(next.decision.kind, 'accepted');
    assert.deepEqual(
      pools(next.world),
      position === 'sleep'
        ? [2, 4, [15224335, 29364750, 272377353, 1125134346]]
        : [3, 6, [25179138, 12295, 540162, 2107404]],
    );
    assert.equal(
      positionOf(next.world, w.character),
      position === 'sleep' ? 'standing' : position === 'sit' ? 'sitting' : 'resting',
    );
  }
});

// Breaks: <= accuracy, skipping accuracy at declared endpoints, damage draw on miss/fixed interval.
test('accuracy20 misses on roll20; endpoint chances still draw accuracy', () => {
  for (const chance of [0, 20, 100]) {
    const w = combatWorld();
    const settings = w.cartridge.world!.combat!;
    const controlled = {
      ...w,
      cartridge: {
        ...w.cartridge,
        world: {
          ...w.cartridge.world,
          combat: { ...settings, player_attack: { chance, damage_min: 1, damage_max: 1 } },
        },
      },
    };
    const next = elapsed(attack(controlled).world, 150);
    assert.equal(next.decision.kind, 'accepted');
    assert.deepEqual(pools(next.world), [9, chance === 100 ? 5 : 6, [12295, 1029, 1029, 25165824]]);
  }
});

// Breaks: combat suppresses/doubles legacy recovery or loses MV fractional credit at immediate escape.
test('production hour-boundary recovery precedes damage and Flee preserves the remainder', () => {
  const w = hp(combatWorld(true, 68250), combatWorld(true, 68250).body, 4);
  const target = key({ kind: 'resource', resource: resourceRef(w, 'mv'), entity_id: w.body });
  const controlled = {
    ...w,
    state: {
      ...w.state,
      resources: {
        ...w.state.resources,
        [target]: { value: 90, at: 68250, rate: 18, remainder: 0 },
      },
    },
  };
  const due = elapsed(attack(controlled).world, 68400);
  assert.equal(due.decision.kind, 'accepted', JSON.stringify(due.decision));
  assert.deepEqual(pools(due.world), [8, 5, [25179138, 12295, 540162, 2107404]]);
  const escaped = step(
    due.world,
    command(due.world, { type: 'flee', actor_id: w.character }, 2),
    3,
  );
  assert.equal(escaped.decision.kind, 'accepted');
  assert.deepEqual(escaped.world.state.resources![target], {
    value: 88,
    at: 68400,
    rate: 18,
    remainder: 2700,
  });
});

// Breaks: raw target bypass, repeat/switch Attack allocation, or Attack advertised on noncombat NPC.
test('admission refuses absent, dead, sanctuary, nonstanding and already engaged participants', () => {
  const w = combatWorld();
  const seated = step(w, command(w, { type: 'sit', actor_id: w.character }), 1).world;
  const remote = {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [w.body]: room(w, 'drowned_lantern') },
    },
  };
  const sanctuary = {
    ...w,
    rooms: {
      ...w.rooms,
      [room(w, 'lantern_cellar')]: { ...w.rooms[room(w, 'lantern_cellar')], sanctuary: true },
    },
  };
  const busy = attack(w).world;
  for (const [before, n] of [
    [seated, 1],
    [remote, 1],
    [sanctuary, 1],
    [hp(w, rat(w), 0), 1],
    [busy, 1],
    [busy, 2],
  ] as const) {
    const out = attack(before, n);
    assert.equal(out.decision.kind, 'rejected');
    assert.equal(out.world, before);
  }
  assert.ok(
    gameView(w)
      .entities.find((e) => e.id === rat(w))!
      .actions.some((a) => a.action_key === 'attack'),
  );
  const landing = {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [w.body]: room(w, 'ferry_landing') },
    },
  };
  assert.ok(
    !gameView(landing)
      .entities.flatMap((e) => e.actions)
      .some((a) => a.action_key === 'attack'),
  );
});

// Breaks: each uniform call gets a fresh eight-draw budget, or an exhausted proposal adopts prefix RNG/HP.
// Independent Python xoshiro calculation: accuracy3019873350; next seven raws all reject bound2147483649:
// 2778870678,3218504330,2184986130,3037241175,3032836435,3141722952,3972115460.
// Ninth raw1913555854 would accept, so resetting the per-call budget incorrectly commits.
test('eight raw draws including damage rejections exhaust the whole round atomically', () => {
  const w = combatWorld();
  const settings = w.cartridge.world!.combat!;
  const controlled = {
    ...w,
    cartridge: {
      ...w.cartridge,
      world: {
        ...w.cartridge.world,
        combat: {
          ...settings,
          player_attack: { chance: 75, damage_min: 1, damage_max: 2147483649 },
        },
      },
    },
    state: { ...w.state, rng: [3116826059, 1870624627, 1508195160, 4130000286] },
  };
  const begun = attack(controlled).world;
  const next = elapsed(begun, 150);
  assert.equal(next.decision.kind, 'fault');
  assert.equal(next.world, begun);
});
