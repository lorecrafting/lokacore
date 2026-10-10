// Toolbox row 2c on the compiled derived sampler: status modifiers move attributes, so derived
// stats and the hp maximum, while a status is active.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { gameView } from '../src/view/view.ts';
import { MIGHT, content, dummy, play, chosen, wait, seen, hpView } from './derived_fixture.ts';

// Breaks (row 2c): value() ignores an active status's modifies, adds it to another attribute, or
// keeps it after expiry.
test("the shrine's might (+3 str for an hour) lifts the strong hit from 6 to 8; expiry restores 6", () => {
  const hp = (w: World) => level(w, dummy(w), resourceRef(w, 'hp'));
  const strike = (w: World) =>
    wait(
      play(play(w, { type: 'move', direction: 'east' }), { type: 'attack', target_id: dummy(w) }),
      150,
    );
  let w = play(play(chosen('strong'), { type: 'move', direction: 'north' }), {
    type: 'move',
    direction: 'south',
  });
  assert.equal(hp(strike(w)), 12); // 20 - (4 + floor((18 - 10) / 2))
  assert.deepEqual(hpView(w), [10, 10]); // might names str only: con 10 keeps the hp maximum
  w = wait(w, 3000); // might never ticks: its one job is the expiry
  assert.equal(hp(strike(w)), 12);
  w = wait(w, 600); // the expiry at application + 3600
  assert.equal(hp(strike(w)), 14);
});

// The sampler with might also giving con `modifier`, and a held-in-hall tonic (hp +2, cures might).
function mightCon(modifier: number) {
  const c = structuredClone(content) as any;
  const str = c.statuses[MIGHT].modifies[0];
  c.statuses[MIGHT].modifies.push({ attribute: { ...str.attribute, key: 'con' }, modifier });
  c.lock.capabilities.food = 1;
  const anvil = c.items['derived_sampler@0.0.1:item/anvil'];
  const edible = { resource: { ...str.attribute, kind: 'resource', key: 'hp' }, amount: 2 };
  const cures = [{ ...str.attribute, kind: 'status', key: 'might' }];
  c.items['derived_sampler@0.0.1:item/tonic'] = {
    ...anvil,
    keywords: ['tonic'],
    mass_grams: 10,
    edible: { ...edible, cures, label: anvil.short, narration: anvil.short },
  };
  return c as Cartridge;
}
const tonic = (w: World) => w.entityIds['derived_sampler@0.0.1:item/tonic'];
const north = { type: 'move', direction: 'north' };

// Breaks (row 2c, as loka-kgd.10 for wear): applying a con-modifying status does not settle hp
// first, so 4 h idle at the cap banks credit the raised maximum grants at once (16/16).
test('a status lifting con after 4 h idle at full hp keeps hp 10 of 16, then regenerates', () => {
  let w = wait(chosen('strong', mightCon(6)), 4 * 3600);
  assert.deepEqual(hpView(w), [10, 10]);
  w = play(w, { type: 'move', direction: 'north' });
  assert.deepEqual(hpView(w), [10, 16]);
  w = wait(w, 3600); // to the expiry
  assert.deepEqual(hpView(w), [10, 10]);
});

// Breaks (row 2c): expiry ends a con-lowering status without the hp settle, so the credit banked
// under the lowered maximum pays out at once (16/16); or a status without per_tick ticks,
// narrates a tick, shows a tick part, or expires at its first end after a refresh.
test('a tickless might with con -6, refreshed at +1800, expires at +5400 with hp 10 of 16', () => {
  seen.length = 0;
  let w = play(chosen('hardy', mightCon(-6)), north);
  const t0 = w.state.clock;
  assert.deepEqual(hpView(w), [10, 10]);
  w = wait(w, 1800);
  w = play(play(w, { type: 'move', direction: 'south' }), north); // refresh: ends at t0 + 5400
  w = wait(w, t0 + 3600 - w.state.clock); // the first job, at the old end
  const line = gameView(w).conditions!;
  assert.deepEqual([line.length, line[0]!.per_tick, line[0]!.ends_at], [1, undefined, t0 + 5400]);
  assert.deepEqual(hpView(w), [10, 10]);
  w = wait(w, t0 + 5400 - w.state.clock - 1);
  assert.equal(gameView(w).conditions?.length, 1);
  w = wait(w, 1);
  assert.equal(gameView(w).conditions, undefined);
  assert.deepEqual(hpView(w), [10, 16]);
  assert.deepEqual(
    seen.filter((k) => /status_|might/.test(k)),
    ['status_expired', 'narration.might.expired'],
  );
});

// The sampler with might (con `modifier`) and a dummy that always hits for 1.
const fierce = (modifier: number) => {
  const c = mightCon(modifier) as any;
  c.npcs['derived_sampler@0.0.1:npc/dummy'].attack.chance = 100;
  return c;
};

// Breaks (row 2c): a status job's or reaction's hp write and a combat round's write on the same
// body in one advance fault: precondition_failed when the proposal hydrates a job's `at` against
// the advance's end clock (runtime/proposal.ts now), conflicting_write when the round and the
// status write in different writer groups (status/job.ts statusGroup).
test('a con -6 might expiring at +3600 and the dummy round at +3650 commit in one wait: 3 of 10', () => {
  let w = play(play(chosen('strong', fierce(-6)), north), { type: 'move', direction: 'south' });
  w = play(wait(w, 3500 - w.state.clock), { type: 'move', direction: 'east' });
  w = play(w, { type: 'attack', target_id: dummy(w) });
  assert.deepEqual(hpView(w), [4, 4]);
  w = wait(w, 200);
  assert.equal(gameView(w).conditions, undefined);
  assert.deepEqual(hpView(w), [3, 10]);
});

test('might applied by the dummy round (attack_result) commits with the round: +6 9 of 16, -6 4 of 4', () => {
  for (const [modifier, after] of [
    [6, [9, 16]],
    [-6, [4, 4]],
  ] as const) {
    const c = fierce(modifier);
    const shrine = 'derived_sampler@0.0.1:reaction/shrine';
    c.reactions[shrine] = { ...c.reactions[shrine], on: { event: 'attack_result' } };
    let w = play(chosen('strong', c), { type: 'move', direction: 'east' });
    w = wait(play(w, { type: 'attack', target_id: dummy(w) }), 200);
    assert.equal(gameView(w).conditions?.length, 1);
    assert.deepEqual(hpView(w), after, String(modifier));
  }
});

// Breaks (row 2c): a cure ends a con-lowering status without the hp settle (an edible eaten at
// full hp, so it restores nothing), and the hour of regen banked at the cap pays out.
test('a tonic cures a refreshed might with con -6 after 4000 s at 10 of 10: hp reads 10 of 16', () => {
  let w = chosen('hardy', mightCon(-6));
  w = wait(play(play(w, { type: 'take', item_id: tonic(w) }), north), 1800);
  w = wait(play(play(w, { type: 'move', direction: 'south' }), north), 2200); // ends at +5400
  w = play(w, { type: 'eat', item_id: tonic(w) });
  assert.equal(gameView(w).conditions, undefined);
  assert.deepEqual(hpView(w), [10, 16]);
});

// Breaks (row 2c): the meal's hp gain precedes the cure's settle, whose stale `from` faults
// composition (precondition_failed), or the cure leaves the lowered maximum.
test('a tonic eaten at hp 10 of 13 (might con -3) cures it and restores 2: hp 12 of 16', () => {
  let w = chosen('hardy', mightCon(-3));
  w = play(play(w, { type: 'take', item_id: tonic(w) }), north);
  assert.deepEqual(hpView(w), [10, 13]);
  w = play(w, { type: 'eat', item_id: tonic(w) });
  assert.deepEqual(hpView(w), [12, 16]);
});
