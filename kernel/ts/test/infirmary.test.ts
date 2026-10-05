import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import {
  fresh,
  id,
  herbs,
  bandages,
  wick,
  patch,
  ledger,
  standing,
  driver,
  ref,
} from './infirmary_fixture.ts';

// Breaks: Harvest substitutes a higher ID, mints a sprig, ignores Take carrying, or refills over time.
test('finite harvest selects the lowest real ID at equality and Drop/Take share stock', () => {
  const a = driver({
    ...standing([], 11980),
    state: {
      ...standing([], 11980).state,
      containers: {
        ...standing([], 11980).state.containers,
        [fresh.body]: id('room', 'willow_shade'),
      },
    },
  });
  assert.equal(gameView(a.world()).notices!.find((n) => n.id === patch)!.remaining, 12);
  a.run({ type: 'harvest', target_id: patch });
  assert.equal(a.world().state.containers[herbs[0]], fresh.body);
  assert.equal(gameView(a.world()).notices!.find((n) => n.id === patch)!.remaining, 11);
  a.run({ type: 'harvest', target_id: patch }, 'too_heavy');
  a.run({ type: 'drop', item_id: herbs[0] });
  assert.equal(gameView(a.world()).notices!.find((n) => n.id === patch)!.remaining, 12);
  a.run({ type: 'take', item_id: herbs[0] });
  a.replace({
    ...a.world(),
    state: {
      ...a.world().state,
      containers: {
        ...a.world().state.containers,
        ...Object.fromEntries(herbs.map((h) => [h, fresh.body])),
      },
    },
  });
  a.run({ type: 'harvest', target_id: patch }, 'not_found');
  assert.deepEqual(a.world().state.rng, [1, 2, 3, 4]);
});

// Breaks: multi-item turn-in omits outgoing custody, replaces stock, or reacceptance resets its contribution.
test('four immediate explicit exchanges conserve all twelve herbs/bandages and cap only S9 gain', () => {
  const a = driver(standing(herbs));
  const occurrences = new Set<string>();
  for (const [axis, gain] of [
    [1, 1],
    [2, 2],
    [3, 3],
    [3, 3],
  ]) {
    a.accept();
    const qs = Object.entries(a.world().state.quests!).filter(
      ([, q]) => q.quest.key === 'infirmary_herbs',
    );
    assert.equal(qs.length, 1);
    assert.equal(occurrences.has(qs[0][0]), false);
    occurrences.add(qs[0][0]);
    a.exchange();
    assert.deepEqual([a.axis(), a.contribution()], [axis, gain]);
  }
  herbs.forEach((h) => assert.equal(a.world().state.containers[h], wick));
  bandages.forEach((h) => assert.equal(a.world().state.containers[h], fresh.body));
  a.talk();
  const view = gameView(a.world());
  assert.equal(view.choice!.choices[0].available, false);
  assert.equal(a.world().state.clock, 64800);
});

// Breaks: final carrying counts only incoming rewards, or omits a positive-net ceiling check.
test('exchange final load allows reducing overload and positive-net equality, refuses one gram over', () => {
  for (const [herbMass, bandageMass, total, expected] of [
    [20, 10, 12020, 'accepted'],
    [10, 20, 11970, 'accepted'],
    [10, 20, 11971, 'too_heavy'],
  ] as const) {
    const base = standing(herbs.slice(0, 3), total - 3 * herbMass);
    const entities = { ...base.entities };
    herbs.forEach((h) => {
      entities[h] = { ...entities[h], mass_grams: herbMass } as never;
    });
    bandages.forEach((h) => {
      entities[h] = { ...entities[h], mass_grams: bandageMass } as never;
    });
    const a = driver({ ...base, entities });
    a.talk();
    const cid = gameView(a.world()).choice!.continuation_id;
    a.run({ type: 'choose', continuation_id: cid, choice_id: 'accept' }, expected);
    if (expected === 'accepted') {
      a.exchange();
      assert.equal(a.world().state.containers[herbs[0]], wick);
      assert.equal(a.world().state.containers[bandages[0]], fresh.body);
    }
  }
});

// Breaks: an old bound continuation resolves a replacement occurrence or silently substitutes a dropped herb.
test('bound turn-in refuses stale exact custody and older occurrence without effects', () => {
  const a = driver(standing(herbs));
  a.accept();
  a.talk();
  const prior = a.world();
  const cid = gameView(prior).choice!.continuation_id;
  a.replace({
    ...prior,
    state: {
      ...prior.state,
      containers: { ...prior.state.containers, [herbs[0]]: id('room', 'infirmary') },
    },
  });
  a.run({ type: 'choose', continuation_id: cid, choice_id: 'exchange' }, 'not_owned');
  a.replace(prior);
  a.choose('exchange');
  a.accept();
  a.talk();
  const next = a.world();
  const nextCid = gameView(next).choice!.continuation_id;
  a.replace({
    ...next,
    state: {
      ...next.state,
      choices: {
        ...next.state.choices,
        [nextCid]: {
          ...next.state.choices![nextCid],
          quest_instance_id: prior.state.choices![cid].quest_instance_id,
        },
      },
    },
  });
  a.run({ type: 'choose', continuation_id: nextCid, choice_id: 'exchange' }, 'invalid_state');
});

// Breaks: the cap uses global standing, spends saturated allowance, or resets allowance after unrelated loss.
test('global saturation spends no allowance and unrelated loss never refunds S9 contribution', () => {
  const fact = (k: string) =>
    key({
      kind: 'fact',
      fact: ref('fact', k),
      scope: { kind: 'player', character_id: fresh.character },
    });
  const start = standing(herbs);
  const saturated = driver({
    ...start,
    state: { ...start.state, facts: { [fact('priory_fen_axis')]: 10 } },
  });
  saturated.accept();
  saturated.exchange();
  assert.deepEqual([saturated.axis(), saturated.contribution()], [10, 0]);
  const capped = driver({
    ...start,
    state: {
      ...start.state,
      facts: { [fact('priory_fen_axis')]: 1, [fact('infirmary_contribution')]: 3 },
    },
  });
  capped.accept();
  capped.exchange();
  assert.deepEqual([capped.axis(), capped.contribution()], [1, 3]);
});

// Breaks: B5 re-resolves Wick from a changed definition map instead of preserving the accepted and continuation-bound participant.
test('exchange retains original Wick bindings after definition mapping drift', () => {
  const a = driver(standing(herbs.slice(0, 3)));
  a.accept();
  a.talk();
  const w = a.world();
  a.replace({
    ...w,
    entityIds: { ...w.entityIds, 'ashmere_missing_child@0.0.20:npc/wick': id('room', 'cloister') },
  });
  a.choose('exchange');
  assert.equal(a.world().state.containers[herbs[0]], wick);
  assert.equal(a.world().state.containers[bandages[0]], fresh.body);
});
