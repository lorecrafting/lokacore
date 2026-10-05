import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  world,
  fresh,
  ready,
  run,
  ok,
  entity,
  room,
  ref,
  fact,
  choose,
  moveTo,
  prefix,
} from './reward_storage_fixture.ts';
import { gameView } from '../src/runtime/world.ts';
import { value } from '../src/mechanics/fact.ts';
import { hp } from './combat_fixture.ts';

// Breaks: trust gets assigned 5, ignores authored amount/bounds, or any objective leaf is omitted.
test('reward adds and clamps trust; every independent death credit is required', () => {
  for (const [before, expected] of [
    [0, 5],
    [3, 8],
    [98, 100],
    [100, 100],
  ]) {
    const w = ready(fact(fresh, 'maud_trust', before));
    const rewarded = ok(w, choose(w));
    assert.equal(value(rewarded, rewarded.character, ref('fact', 'maud_trust')), expected);
    assert.equal(value(rewarded, rewarded.character, ref('fact', 'inn_cellar_cleared')), true);
    assert.equal(rewarded.state.containers[entity(w, 'item', 'reward_key')], w.body);
    assert.equal(Object.values(rewarded.state.quests!)[0].state, 'resolved');
    assert.equal(Object.values(rewarded.state.choices!).at(-1)!.status, 'resolved');
  }
  for (const [before, amount, expected] of [
    [7, 2, 9],
    [8, 2, 9],
    [-3, -2, -4],
  ]) {
    const alternative = world((c) => {
      c.facts[`${prefix}:fact/maud_trust`].value_type = {
        type: 'int',
        minimum: -4,
        maximum: 9,
        default: before,
      };
      c.dialogues[`${prefix}:dialogue/maud_turn_in`].choices.done.sequence[0].amount = amount;
    });
    const w = ready(alternative);
    assert.equal(value(ok(w, choose(w)), w.character, ref('fact', 'maud_trust')), expected);
  }
  for (const n of [1, 2, 3, 4, 5]) {
    const four = ready(fresh, n);
    assert.deepEqual(
      'reason' in gameView(four).choice!.choices[0]
        ? (gameView(four).choice!.choices[0] as { reason: unknown }).reason
        : undefined,
      { code: 'quest_requirement' },
    );
    const denied = run(four, choose(four));
    assert.deepEqual(denied.decision, { kind: 'rejected', error: { code: 'quest_requirement' } });
    assert.equal(denied.world, four);
  }
});

// Breaks: carry is skipped for NPC rewards, equality is rejected, or a refused choice partially resolves.
test('receive shares carry boundary and leaves Close usable after whole-command refusal', () => {
  for (const grams of [11900, 11901]) {
    let w = world((c) => {
      c.items[`${prefix}:item/lantern`].mass_grams = grams;
    });
    w = {
      ...w,
      state: {
        ...w.state,
        containers: { ...w.state.containers, [entity(w, 'item', 'lantern')]: w.body },
      },
    };
    w = ready(w);
    const r = run(w, choose(w));
    if (grams === 11900) assert.equal(r.decision.kind, 'accepted');
    else {
      assert.deepEqual(r.decision, { kind: 'rejected', error: { code: 'too_heavy' } });
      assert.equal(r.world, w);
      assert.deepEqual((gameView(w).choice!.choices[0] as { reason: unknown }).reason, {
        code: 'too_heavy',
      });
      assert.equal(
        gameView(
          ok(w, { type: 'close_choice', continuation_id: gameView(w).choice!.continuation_id }),
        ).choice,
        undefined,
      );
    }
  }
});

// Breaks: Choose trusts stale Talk-time custody/life/presence, or reopens a terminal reward.
test('bound reward and NPC are revalidated; resolved continuation and quest cannot pay twice', () => {
  const w = ready();
  const maud = entity(w, 'npc', 'maud');
  const reward = entity(w, 'item', 'reward_key');
  const containers = w.state.containers;
  const stale = [
    [{ ...containers, [reward]: w.body }, 'not_owned'],
    [{ ...containers, [maud]: room(w, 'inn_rooms') }, 'not_present'],
  ] as const;
  for (const [next, code] of stale) {
    const bad = { ...w, state: { ...w.state, containers: next } };
    assert.deepEqual(run(bad, choose(bad)).decision, { kind: 'rejected', error: { code } });
    assert.deepEqual((gameView(bad).choice!.choices[0] as { reason: unknown }).reason, { code });
  }
  const mortal = ready(
    world((c) => {
      c.npcs[`${prefix}:npc/maud`].hp = { minimum: 0, maximum: 1, start: 1, gain: 0 };
    }),
  );
  const dead = hp(mortal, entity(mortal, 'npc', 'maud'), 0);
  assert.deepEqual(run(dead, choose(dead)).decision, {
    kind: 'rejected',
    error: { code: 'not_present' },
  });
  const rewarded = ok(w, choose(w));
  assert.deepEqual(run(rewarded, choose(w)).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  const lost = {
    ...rewarded,
    state: {
      ...rewarded.state,
      containers: { ...rewarded.state.containers, [reward]: room(w, 'inn_rooms') },
      choices: w.state.choices,
    },
  };
  assert.deepEqual(run(lost, choose(lost)).decision, {
    kind: 'rejected',
    error: { code: 'not_owned' },
  });
  const restoredCustody = {
    ...lost,
    state: { ...lost.state, containers: { ...lost.state.containers, [reward]: maud } },
  };
  assert.deepEqual(run(restoredCustody, choose(restoredCustody)).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
});

// Breaks: adjustment reads only base state, silently repairs corrupt values, or clamps an unsafe sum.
test('adjustment uses sequence overlay and faults on corrupt/unsafe values before effects', () => {
  const chained = ready(
    world((c) => {
      const o = c.dialogues[`${prefix}:dialogue/maud_turn_in`].choices.done;
      o.sequence.unshift({ op: 'fact.assign', fact: ref('fact', 'maud_trust'), value: 3 });
    }),
  );
  assert.equal(
    value(ok(chained, choose(chained)), chained.character, ref('fact', 'maud_trust')),
    8,
  );
  for (const corrupt of [false, 101, 1.5, null as never]) {
    const w = fact(ready(), 'maud_trust', corrupt);
    const r = run(w, choose(w));
    assert.equal(r.decision.kind, 'fault');
    assert.equal(r.world, w);
  }
  const reserved = ready();
  const cartridge = structuredClone(reserved.cartridge) as any;
  cartridge.dialogues[`${prefix}:dialogue/maud_turn_in`].choices.done.sequence = [
    { op: 'fact.adjust', fact: ref('fact', 'scene_lantern_kept'), amount: 1 },
  ];
  const engineWrite = { ...reserved, cartridge };
  assert.equal(run(engineWrite, choose(engineWrite)).decision.kind, 'fault');
  const unsafe = ready(
    world((c) => {
      c.facts[`${prefix}:fact/maud_trust`].value_type = {
        type: 'int',
        minimum: 0,
        maximum: 9007199254740991,
        default: 9007199254740991,
      };
    }),
  );
  assert.equal(run(unsafe, choose(unsafe)).decision.kind, 'fault');
});

// Breaks: incoming item_acquired uses NPC holder, so proposal fails to join an already-active quest.
test('received identity completes an already-active acquisition quest in the same proposal', () => {
  let w = world((c) => {
    c.quests[`${prefix}:quest/receive_key`] = {
      key: 'receive_key',
      title: 'fixture.quest',
      offer: {
        label: 'fixture.accept',
        policy: { policy_version: 1, root: { op: 'all', items: [] } },
      },
      objective: { evidence: 'post_activation_event', item_acquired: ref('item', 'reward_key') },
    };
  });
  w = ok(w, { type: 'accept_quest', quest: ref('quest', 'receive_key') });
  w = ready(w);
  const r = run(w, choose(w));
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const q = Object.values(r.world.state.quests!).find((q) => q.quest.key === 'receive_key')!;
  assert.equal(q.state, 'objectives_complete');
});

// Breaks: incoming custody overrides all choices/items instead of only the selected receive role.
test('incoming custody is choice-specific and other bound items stay actor-held', () => {
  let w = world((c) => {
    const d = c.dialogues[`${prefix}:dialogue/maud_turn_in`];
    d.roles.other = { role: 'item', item: ref('item', 'lantern') };
    d.choices.other = { label: 'fixture.done', narration: 'fixture.completed' };
  });
  const lantern = entity(w, 'item', 'lantern');
  w = { ...w, state: { ...w.state, containers: { ...w.state.containers, [lantern]: w.body } } };
  w = ready(w);
  assert.equal(run(w, choose(w)).decision.kind, 'accepted');
  assert.deepEqual(run(w, { ...choose(w), choice_id: 'other' }).decision, {
    kind: 'rejected',
    error: { code: 'not_owned' },
  });
  const otherHeld = {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [lantern]: entity(w, 'npc', 'maud') },
    },
  };
  assert.deepEqual(run(otherHeld, choose(otherHeld)).decision, {
    kind: 'rejected',
    error: { code: 'not_owned' },
  });
});
