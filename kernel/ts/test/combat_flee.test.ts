import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatWorld, attack, command, room } from './combat_fixture.ts';
import { gameView, step, type World } from '../src/index.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { key } from '../src/foundation/compose.ts';
import { composed } from '../src/commands/actions.ts';
import { escapeDirections } from '../src/mechanics/combat/flee.ts';
import type { DefinitionRef, Key } from '../src/contracts.gen.ts';

function twoExits(): World {
  const w = attack(combatWorld()).world;
  const here = room(w, 'lantern_cellar');
  const to = (name: string) =>
    ({
      cartridge_id: 'ashmere_sampler',
      cartridge_version: '0.0.9',
      kind: 'room',
      key: name,
    }) as DefinitionRef;
  return {
    ...w,
    rooms: {
      ...w.rooms,
      [here]: {
        ...w.rooms[here],
        exits: {
          west: { to: to('chapel_nave') },
          north: { to: to('drowned_lantern') },
        },
      },
    },
  };
}
const flee = (w: ReturnType<typeof twoExits>) =>
  step(w, command(w, { type: 'flee', actor_id: w.character }, 2), 2);

// Breaks: choosing first/insertion-order exits, burning an IdSource draw, or dropping selected RNG.
test('two-exit Flee selects canonical north/west using independent seeded answers', () => {
  const cases = [
    { seed: [1, 2, 3, 4], after: [7, 0, 1026, 12288], destination: 'drowned_lantern' },
    { seed: [1, 33554432, 3, 4], after: [33554437, 33554434, 2, 8208], destination: 'chapel_nave' },
  ];
  for (const c of cases) {
    const initial = twoExits();
    const w = {
      ...initial,
      state: { ...initial.state, rng: c.seed as [number, number, number, number] },
    };
    assert.deepEqual(escapeDirections(w, w.character), ['north', 'west']);
    const result = flee(w);
    assert.equal(result.decision.kind, 'accepted');
    assert.equal(result.world.state.containers[w.body], room(w, c.destination));
    assert.deepEqual(result.world.state.rng, c.after);
    assert.equal(level(result.world, w.body, resourceRef(w, 'mv')), 98);
    assert.equal(Object.values(result.world.state.encounters!)[0].status, 'closed');
    assert.deepEqual(flee(w).decision, result.decision);
  }
});

// Breaks: hidden/locked exits or insufficient multiplied fare enter the random candidate set.
test('blocked exits are excluded; zero exits or insufficient fare refuse without a draw', () => {
  const initial = twoExits(),
    here = room(initial, 'lantern_cellar');
  const barrier = Object.values(initial.cartridge.barriers!)[0];
  const ref = {
    cartridge_id: initial.cartridge.manifest.id,
    cartridge_version: initial.cartridge.manifest.version,
    kind: 'barrier',
    key: barrier.key,
  } as DefinitionRef;
  const w = {
    ...initial,
    rooms: {
      ...initial.rooms,
      [here]: {
        ...initial.rooms[here],
        exits: {
          ...initial.rooms[here].exits,
          north: { ...initial.rooms[here].exits.north!, barrier: ref },
        },
      },
    },
  };
  assert.deepEqual(escapeDirections(w, w.character), ['west']);
  const escaped = flee(w);
  assert.equal(escaped.world.state.containers[w.body], room(w, 'chapel_nave'));
  assert.deepEqual(escaped.world.state.rng, [1, 2, 3, 4]);
  const noExits = { ...w, rooms: { ...w.rooms, [here]: { ...w.rooms[here], exits: {} } } };
  const mv = key({ kind: 'resource', resource: resourceRef(w, 'mv'), entity_id: w.body });
  const tooTired = {
    ...initial,
    state: {
      ...initial.state,
      resources: {
        ...initial.state.resources,
        [mv]: { ...initial.state.resources![mv], value: 1 },
      },
    },
  };
  const policyBlocked: World = {
    ...initial,
    rooms: {
      ...initial.rooms,
      [here]: {
        ...initial.rooms[here],
        actions: [{ op: 'subtract', actions: ['move' as Key] }],
      },
    },
  };
  for (const blocked of [noExits, tooTired, policyBlocked]) {
    assert.deepEqual(escapeDirections(blocked, blocked.character), []);
    const result = flee(blocked);
    assert.deepEqual(result.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
    assert.equal(result.world, blocked);
    const offered = gameView(blocked).actions.filter((a) => a.action_key === 'flee');
    assert.equal(offered.length, 1);
    assert.equal(offered[0].available, false);
  }
});

// Breaks: a direction-bearing movement verb bypasses escape RNG or touch advertises a chosen exit.
test('active combat exposes one directionless Flee and refuses directional movement', () => {
  const w = twoExits(),
    view = gameView(w);
  assert.deepEqual(
    view.actions.filter((a) => a.action_key === 'flee').map((a) => a.input),
    [[]],
  );
  assert.ok(!view.actions.some((a) => a.action_key === 'move'));
  assert.ok(view.exits.every((e) => !e.available));
  const result = step(
    w,
    command(w, { type: 'move', actor_id: w.character, direction: 'north' as Key }, 2),
    2,
  );
  assert.deepEqual(result.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(result.world, w);
});

// Breaks: each Flee candidate resets policy accounting and escapes the command-wide query budget.
test('random Flee candidate policies share the command query budget and fault atomically', () => {
  const initial = twoExits();
  const move = composed(initial, initial.character).move;
  const w: World = {
    ...initial,
    cartridge: {
      ...initial.cartridge,
      actions: {
        ...initial.cartridge.actions,
        move: {
          ...move,
          accessibility: 'actions.move.a11y',
          policy: {
            policy_version: 1,
            root: {
              op: 'all',
              items: Array.from({ length: 16385 }, () => ({ op: 'time_window', from: 0, to: 24 })),
            },
          },
        },
      },
    },
  };
  const result = flee(w);
  assert.deepEqual(result.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(result.limit, 'query_steps');
  assert.equal(result.world, w);
});
