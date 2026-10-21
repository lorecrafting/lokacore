// The showcase traps district (Sappers' Stair) walked step by step (docs/showcase/traps-district.md,
// guided loop, steps 1 to 4 and 7; slice T1). Steps 1 to 4 continue one world; step 7 branches from
// step 1's world. Disarm starts at 0 against the flagstones' rating 1 and grows by 1 per use.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { describe } from '../src/mechanics/description_variant/rule.ts';
import { validate } from '../src/foundation/validate.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import type { World } from '../src/runtime/decision.ts';
import {
  act,
  choose,
  detail,
  fact,
  fresh,
  go,
  HOUR,
  id,
  labels,
  play,
  pool,
  refused,
  take,
  talk,
  wait,
} from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-0000000007a1';
const C = { cartridge_id: 'toolbox_showcase', cartridge_version: '0.0.1' };
const poisoned = (w: World) => {
  const r =
    w.state.statuses?.[statusKey(w.body, { ...C, kind: 'status', key: 'poisoned' } as never)];
  return r && { generation: r.generation, ends_at: r.active ? r.ends_at : undefined };
};
const outcome = (w: World, action: string) => {
  const r = act(w, { type: 'perform', action });
  return {
    world: r.world,
    lines: r.lines,
    out: r.decision.kind === 'accepted' && r.decision.outcome,
  };
};
const flagstones = (w: World) => describe(w, w.character, w.details[detail(w, 'flagstones')]);
const exits = (w: World) =>
  gameView(w)
    .exits.map((e) => e.direction)
    .sort();

let w: World;
let step1: World;

// Breaks: the drill yard has no stair down, the sign reads other text, or the disarm is offered
// before the search (policy plate_found dropped).
test('traps 1: down from the drill yard; the sign reads; disarm before a search is invalid_state', () => {
  w = go(fresh(WORLD), 'west').world;
  w = choose(talk(w, 'aldous').world, 'learn').world;
  w = play(w, { type: 'wear', item_id: id(w, 'item', 'training_sword') }).world;
  w = go(w, 'down').world;
  // T1 builds only the stair and the passage: the plan's east and down exits come in T2 and T3.
  assert.deepEqual(exits(w), ['north', 'up']);
  assert.deepEqual(play(w, { type: 'read', target_id: detail(w, 'sign_traps') }).lines, [
    'readable.sign_traps',
  ]);
  assert.equal(refused(w, { type: 'perform', action: 'disarm_plate' }), 'invalid_state');
  assert.equal(flagstones(w), 'detail.flagstones');
  step1 = w;
});

// Breaks: the search sets nothing or can repeat, the found variant is missing, the failed disarm
// does not poison (plate_bites) or poisons for another span, the cue is not on the player's own
// breath, or the bite marks the plate sprung.
test('traps 2: the search finds the plate; the first disarm fails and poisons', () => {
  const search = outcome(w, 'search_floor');
  assert.deepEqual([search.out, search.lines], ['performed', ['narration.search_floor']]);
  w = search.world;
  assert.equal(fact(w, 'plate_found'), true);
  assert.equal(flagstones(w), 'detail.flagstones.found');
  assert.equal(refused(w, { type: 'perform', action: 'search_floor' }), 'invalid_state');
  const T = w.state.clock;
  const bite = outcome(w, 'disarm_plate');
  assert.equal(bite.out, 'failure');
  assert.ok(bite.lines.includes('narration.poisoned.applied'), bite.lines.join());
  w = bite.world;
  assert.deepEqual(poisoned(w), { generation: 1, ends_at: T + 7200 });
  assert.ok(labels(w).includes('condition.poisoned'));
  assert.deepEqual(gameView(w).cues, [{ sense: 'smell', text: 'cue.poison' }]);
  assert.notEqual(fact(w, 'plate_sprung'), true);
  assert.equal(pool(w, 'hp'), 10);
  validate('GameView', gameView(w));
});

// Breaks: the skill does not grow on use, the rating is ignored, the disarmed variant is missing,
// or the disarm stays offered once done (policy plate_disarmed dropped).
test('traps 3: the second disarm succeeds; a third is invalid_state', () => {
  const r = outcome(w, 'disarm_plate');
  assert.deepEqual([r.out, r.lines], ['success', ['narration.disarm_plate.success']]);
  w = r.world;
  assert.equal(fact(w, 'plate_disarmed'), true);
  assert.equal(flagstones(w), 'detail.flagstones.disarmed');
  assert.equal(refused(w, { type: 'perform', action: 'disarm_plate' }), 'invalid_state');
});

// Breaks: the disarmed plate still springs (plate_springs's plate_disarmed guard dropped), or the
// note is missing or reads other text.
test('traps 4: north over the disarmed plate; the note reads', () => {
  const before = poisoned(w);
  const r = go(w, 'north');
  assert.ok(!r.lines.some((l) => l.startsWith('narration.poisoned')), r.lines.join());
  w = r.world;
  assert.deepEqual(poisoned(w), before);
  assert.notEqual(fact(w, 'plate_sprung'), true);
  w = take(w, 'sapper_note');
  assert.deepEqual(play(w, { type: 'read', target_id: id(w, 'item', 'sapper_note') }).lines, [
    'readable.sapper_note',
  ]);
});

// Breaks: the plate does not spring on entry, springs again while sprung (plate_sprung guard
// dropped), never rearms (plate_rearms), the re-entry adds a generation instead of a refresh, or
// a failed disarm on a sprung plate bites again (plate_bites's guard dropped).
test('traps 7: an undisarmed plate springs, holds, rearms on the hour and refreshes', () => {
  const entry = go(step1, 'north');
  let x = entry.world;
  const E = x.state.clock;
  assert.ok(entry.lines.includes('narration.poisoned.applied'), entry.lines.join());
  assert.deepEqual(poisoned(x), { generation: 1, ends_at: E + 7200 });
  assert.equal(fact(x, 'plate_sprung'), true);
  // Ten minutes on (still sprung, before the hour), so a second application would move ends_at.
  x = wait(go(x, 'south').world, E + 600).world;
  assert.equal(fact(x, 'plate_sprung'), true); // the setup must leave E + 600 before the hour
  const again = go(x, 'north');
  assert.ok(!again.lines.some((l) => l.startsWith('narration.poisoned')), again.lines.join());
  assert.deepEqual(poisoned(again.world), { generation: 1, ends_at: E + 7200 });

  // While sprung, a found plate's failed disarm does not bite again.
  const y = outcome(x, 'search_floor').world;
  const miss = outcome(y, 'disarm_plate');
  assert.equal(miss.out, 'failure');
  assert.deepEqual(poisoned(miss.world), { generation: 1, ends_at: E + 7200 });

  const hour = Math.ceil((E + 1) / HOUR) * HOUR;
  x = wait(x, hour).world;
  assert.equal(fact(x, 'plate_sprung'), false);
  const back = go(x, 'north');
  assert.deepEqual(poisoned(back.world), { generation: 1, ends_at: back.world.state.clock + 7200 });
  assert.equal(fact(back.world, 'plate_sprung'), true);
});

// Breaks: the poison ticks on another cadence or amount, or never expires.
test('traps 7: left alone, the poison ticks at +1800, +3600, +5400 and expires at +7200', () => {
  let x = go(step1, 'north').world;
  const E = x.state.clock;
  const hp: (number | undefined)[] = [];
  for (const t of [1800, 3600, 5400]) {
    x = wait(x, E + t).world;
    hp.push(pool(x, 'hp'));
  }
  assert.deepEqual(hp, [9, 8, 7]);
  const end = wait(x, E + 7200);
  assert.ok(end.lines.includes('narration.poisoned.expired'), end.lines.join());
  assert.equal(poisoned(end.world)?.ends_at, undefined);
  assert.equal(pool(end.world, 'hp'), 7);
});
