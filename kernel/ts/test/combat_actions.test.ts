import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attack,
  combatWorld,
  command,
  elapsed,
  hp,
  positioned,
  rat,
  ref,
  room,
} from './combat_fixture.ts';
import { gameView, step, type World } from '../src/index.ts';
import { resolved } from '../src/commands/actions.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import type { CommandPayload, Key } from '../src/contracts.gen.ts';

function offeredWorld(): World {
  let w = combatWorld();
  const bram = w.entityIds[ref(w, 'npc', 'bram')];
  w = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [bram]: room(w, 'lantern_cellar') } },
  };
  const set = resolved(w, w.character);
  return {
    ...w,
    cartridge: {
      ...w.cartridge,
      actions: {
        ...w.cartridge.actions,
        retreat: { ...set.move, key: 'retreat' as Key, accessibility: 'actions.move.a11y' },
      },
    },
  };
}

// Breaks: combat filters UI labels instead of composed commands, leaving raw or alias bypasses.
test('encounter ActionSet filters ordinary raw verbs and aliases while retaining harmless inspection', () => {
  const initial = offeredWorld(),
    w = attack(initial).world;
  assert.deepEqual(
    [...new Set(Object.values(resolved(w, w.character)).map((a) => a.command))].sort(),
    ['flee', 'look', 'scan', 'stand'],
  );
  assert.deepEqual(
    gameView(w)
      .actions.filter((a) => a.available)
      .map((a) => a.action_key),
    ['flee', 'look', 'scan'],
  );
  const item = w.entityIds[ref(w, 'item', 'wool_cloak')];
  const blocked = [
    { type: 'move', direction: 'up' },
    { type: 'attack', target_id: rat(w) },
    { type: 'talk', target_id: w.entityIds[ref(w, 'npc', 'bram')] },
    ...['take', 'drop', 'wear', 'remove'].map((type) => ({ type, item_id: item })),
    { type: 'give', item_id: item, recipient_id: rat(w) },
    ...['open', 'close', 'lock', 'unlock'].map((type) => ({ type, direction: 'up' })),
    ...['sit', 'rest', 'sleep'].map((type) => ({ type })),
    { type: 'wait', until: 150 },
    { type: 'perform', action: 'unknown_recipe' },
  ].map((p) => ({ ...p, actor_id: w.character })) as CommandPayload[];
  for (const payload of blocked) {
    const r = step(w, command(w, payload, 10), 2);
    assert.equal(r.decision.kind, 'rejected', payload.type);
    assert.equal(r.world, w);
  }
  const invocation = identify('combat-test', w.character, {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000001',
    actor_id: w.character,
    action_key: 'retreat',
    target_ids: [],
    input: { direction: 'up' },
  });
  assert.equal(invocation.kind, 'identified');
  if (invocation.kind === 'identified')
    assert.deepEqual(resolve(w, invocation), {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
  for (const type of ['look', 'scan'] as const)
    assert.equal(
      step(w, command(w, { type, actor_id: w.character }, 11), 2).decision.kind,
      'accepted',
    );
  const seated = positioned(w, 'sitting');
  assert.equal(
    step(seated, command(seated, { type: 'stand', actor_id: w.character }, 12), 2).decision.kind,
    'accepted',
  );
});

// Breaks: pending dialogue overlays evade combat admission, or the filter outlives encounter closure.
test('pending choices disappear during combat and ordinary actions return after Flee or death', () => {
  const initial = offeredWorld(),
    bram = initial.entityIds[ref(initial, 'npc', 'bram')];
  const talked = step(
    initial,
    command(initial, { type: 'talk', actor_id: initial.character, target_id: bram }, 99),
    1,
  );
  assert.equal(talked.decision.kind, 'accepted');
  const choice = gameView(talked.world).choice;
  assert.ok(choice);
  const w = attack(talked.world).world;
  assert.equal(gameView(w).choice, undefined);
  assert.ok(
    !Object.values(resolved(w, w.character)).some(
      (a) => a.command === 'choose' || a.command === 'close_choice',
    ),
  );
  for (const payload of [
    {
      type: 'choose',
      actor_id: w.character,
      continuation_id: choice.continuation_id,
      choice_id: 'carry',
    },
    { type: 'close_choice', actor_id: w.character, continuation_id: choice.continuation_id },
  ] as CommandPayload[]) {
    const rejected = step(w, command(w, payload, 5), 2);
    assert.equal(rejected.decision.kind, 'rejected');
    assert.equal(rejected.world, w);
  }
  const fled = step(w, command(w, { type: 'flee', actor_id: w.character }, 2), 3);
  assert.equal(fled.decision.kind, 'accepted');
  assert.ok(resolved(fled.world, w.character).move);
  assert.ok(resolved(fled.world, w.character).retreat);
  assert.ok(gameView(fled.world).choice);
  const died = elapsed(hp(w, w.body, 1), 150, 3);
  assert.equal(died.decision.kind, 'accepted');
  assert.ok(resolved(died.world, w.character).move);
  assert.ok(resolved(died.world, w.character).sleep);
});
