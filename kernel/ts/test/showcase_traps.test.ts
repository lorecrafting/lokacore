// The showcase traps district (Sappers' Stair) walked step by step (docs/showcase/traps-district.md,
// guided loop, steps 1 to 9; slices T1 to T3). Steps 1 to 6 and 8 continue one world; steps 7 and 9
// branch from step 1's world and the sandbox starts fresh. Every attack is chance 100. Disarm starts at 0 against the flagstones' rating 1 and grows by 1 per use.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { describe } from '../src/mechanics/description_variant/rule.ts';
import { decode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { activeStatuses, statusKey } from '../src/mechanics/status/shared.ts';
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
  npc,
  play,
  perform,
  pool,
  refused,
  room,
  take,
  talk,
  wait,
  where,
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
  assert.deepEqual(exits(w), ['down', 'east', 'north', 'up']);
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
  assert.ok(bite.lines.includes('narration.needle'), bite.lines.join());
  w = bite.world;
  assert.deepEqual(poisoned(w), { generation: 1, ends_at: T + 7200 });
  assert.ok(labels(w).includes('condition.poisoned'));
  assert.deepEqual(gameView(w).cues, [{ sense: 'smell', text: 'cue.poison' }]);
  assert.notEqual(fact(w, 'plate_sprung'), true);
  assert.equal(pool(w, 'hp'), 10);
  validate('GameView', gameView(w));
});

// Breaks: the skill does not grow on use, the rating is ignored, the disarmed variant is missing,
// the disarm stays offered once done (policy plate_disarmed dropped), or a disarmed plate still
// offers the search (search_floor's plate_disarmed false dropped).
test('traps 3: the second disarm succeeds; a third is invalid_state', () => {
  const r = outcome(w, 'disarm_plate');
  assert.deepEqual([r.out, r.lines], ['success', ['narration.disarm_plate.success']]);
  w = r.world;
  assert.equal(fact(w, 'plate_disarmed'), true);
  assert.equal(flagstones(w), 'detail.flagstones.disarmed');
  assert.equal(refused(w, { type: 'perform', action: 'disarm_plate' }), 'invalid_state');
  // Boundary: found false, disarmed true (step 1's world is found false, disarmed false: offered).
  const facts = Object.fromEntries(
    Object.entries(w.state.facts!).map(([k, v]) => [
      k,
      (decode(k) as { fact: { key: string } }).fact.key === 'plate_found' ? false : v,
    ]),
  );
  const unfound = { ...w, state: { ...w.state, facts } };
  assert.equal(fact(unfound, 'plate_found'), false);
  assert.equal(refused(unfound, { type: 'perform', action: 'search_floor' }), 'invalid_state');
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
  assert.deepEqual(play(w, { type: 'read', target_id: detail(w, 'sapper_note') }).lines, [
    'readable.sapper_note',
  ]);
  assert.equal(notice(w, 'sapper_note').title, 'detail.sapper_note.title');
});

const pulls = (x: World, levers: string) =>
  [...levers].reduce((y, c) => perform(y, `pull_${c}`).world, x);
const turns = (x: World, wheel: number, n: number) =>
  Array.from({ length: n }).reduce<World>((y) => perform(y, `turn_wheel_${wheel}`).world, x);
const wheels = (x: World) => [1, 2, 3].map((n) => fact(x, `wheel_${n}`) ?? 0);
const open = (x: World, direction: string) => {
  const r = act(x, { type: 'open', direction });
  return r.decision.kind === 'accepted'
    ? r.decision.outcome
    : (r.decision as unknown as { error: { code: string } }).error.code;
};
const at = (x: World) => x.state.containers[x.body];
const notice = (x: World, key: string) =>
  gameView(x).notices!.find((n) => n.id === detail(x, key))!;

// Breaks: a lever's reset or step is missing or fires in the wrong key order (lever_c_reset must
// precede lever_c_step), the door opens off stage 3, the slate reads other text, a reset
// recloses the door, or a player who shuts the door from inside is locked in; lever A sets its stage
// with no bolt line, or restarts later progress with no reset line (loka-y6yg.50).
test('traps 5: the levers open the north door only in order A, B, C; the slate reads', () => {
  w = go(go(w, 'south').world, 'east').world;
  assert.equal(at(w), room(w, 'lever_hall'));
  assert.deepEqual(exits(w), ['east', 'north', 'west']);
  assert.deepEqual(perform(w, 'pull_a').lines, ['narration.lever', 'narration.lever_bolt']);
  const again = perform(pulls(w, 'ab'), 'pull_a');
  assert.deepEqual(again.lines, [
    'narration.lever',
    'narration.lever_reset',
    'narration.lever_bolt',
  ]);
  assert.equal(fact(again.world, 'lever_stage'), 1);
  assert.equal(fact(pulls(w, 'ab'), 'lever_stage'), 2);
  assert.equal(fact(pulls(w, 'abb'), 'lever_stage'), 0);
  const ac = pulls(w, 'ac');
  assert.equal(fact(ac, 'lever_stage'), 0);
  assert.equal(open(ac, 'north'), 'invalid_state');
  w = pulls(w, 'abc');
  assert.equal(fact(w, 'lever_stage'), 3);
  assert.equal(open(w, 'north'), 'opened');
  w = play(w, { type: 'open', direction: 'north' }).world;
  w = go(w, 'north').world;
  assert.equal(at(w), room(w, 'lever_vault'));
  assert.deepEqual(play(w, { type: 'read', target_id: detail(w, 'vault_slate') }).lines, [
    'readable.vault_slate',
  ]);
  assert.equal(notice(w, 'vault_slate').title, 'detail.vault_slate.title');
  w = pulls(go(w, 'south').world, 'c');
  assert.equal(fact(w, 'lever_stage'), 0);
  const inside = play(go(w, 'north').world, { type: 'close', direction: 'south' }).world;
  assert.equal(at(inside), room(w, 'lever_vault'));
  assert.equal(open(inside, 'south'), 'opened'); // a visitor is never shut in at stage 0
  // One visit is enough: shut from the hall at stage 0, the door still opens (visited at_least 1).
  assert.equal(open(play(w, { type: 'close', direction: 'north' }).world, 'north'), 'opened');
});

// Breaks: a wheel's turn or wrap is missing, wraps at another digit, or its wrap precedes its turn;
// the door ignores a wheel or wants another digit; a player who shuts it from inside is locked in;
// or the bitters do not cure.
test('traps 6: the wheels open the east door at 3, 1, 2; the bitters cure the poison', () => {
  for (const n of [1, 2, 3]) {
    const nine = turns(w, n, 9);
    assert.equal(fact(nine, `wheel_${n}`), 9);
    assert.equal(
      describe(nine, nine.character, nine.details[detail(nine, `wheel_${n}`)]),
      `detail.wheel_${n}.9`,
    );
    assert.equal(fact(turns(nine, n, 1), `wheel_${n}`), 0);
  }
  assert.equal(open(turns(turns(w, 1, 3), 3, 2), 'east'), 'invalid_state'); // [3, 0, 2]
  assert.equal(open(turns(turns(w, 2, 1), 3, 2), 'east'), 'invalid_state'); // [0, 1, 2]
  w = turns(turns(turns(w, 1, 3), 2, 1), 3, 1);
  assert.deepEqual(wheels(w), [3, 1, 1]);
  assert.equal(open(w, 'east'), 'invalid_state');
  w = turns(w, 3, 1);
  assert.deepEqual(wheels(w), [3, 1, 2]);
  assert.equal(open(w, 'east'), 'opened');
  w = go(turns(play(w, { type: 'open', direction: 'east' }).world, 1, 1), 'east').world;
  w = play(w, { type: 'close', direction: 'west' }).world;
  assert.equal(open(w, 'west'), 'opened'); // a visitor is never shut in off 3, 1, 2
  w = play(w, { type: 'open', direction: 'west' }).world;
  w = take(w, 'bitters_skin');
  assert.ok(poisoned(w)?.ends_at, 'still poisoned before the drink');
  assert.equal(pool(w, 'hp'), 10);
  const skin = id(w, 'item', 'bitters_skin');
  const r = play(w, { type: 'drink', vessel_id: skin });
  assert.ok(!r.lines.includes('narration.poisoned.tick'), r.lines.join());
  w = r.world;
  assert.equal(poisoned(w)?.ends_at, undefined);
  assert.deepEqual(labels(w), []);
  assert.equal(pool(w, 'hp'), 10);
  assert.equal(w.state.liquids?.[skin]?.quantity, 1);
  validate('GameView', gameView(w));
});

// Breaks: a lever's step and reset narrate the same line or nothing; a wheel names another digit,
// a turn names none or two, or its readout runs before its wrap (it would name 10, not 0). The
// doors' state is the exits' (the hall's asides went with loka-x6t.125).
test('traps 5-6 feedback: pulls and turns narrate', () => {
  const x = go(go(go(fresh(WORLD), 'west').world, 'down').world, 'east').world;
  const said = (y: World, action: string) =>
    perform(y, action).lines.filter((l) => l !== 'narration.lever');
  assert.deepEqual(said(x, 'pull_b'), ['narration.lever_reset']);
  assert.deepEqual(said(pulls(x, 'a'), 'pull_b'), ['narration.lever_bolt']);
  assert.deepEqual(said(pulls(x, 'ab'), 'pull_c'), ['narration.lever_open']); // the solve's own line
  assert.deepEqual(said(pulls(x, 'a'), 'pull_c'), ['narration.lever_reset']);
  for (const n of [1, 2, 3]) {
    let y = x;
    const read: string[][] = [];
    for (let i = 0; i < 10; i += 1) {
      const r = perform(y, `turn_wheel_${n}`);
      read.push(r.lines.filter((l) => l.startsWith(`narration.wheel_${n}.`)));
      y = r.world;
    }
    assert.deepEqual(
      read,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((k) => [`narration.wheel_${n}.${k}`]),
    );
  }
  validate('GameView', gameView(x));
});

// Breaks: the plate does not spring on entry, springs again while sprung (plate_sprung guard
// dropped), never rearms (plate_rearms), the re-entry adds a generation instead of a refresh, or
// a failed disarm on a sprung plate bites again (plate_bites's guard dropped).
test('traps 7: an undisarmed plate springs, holds, rearms on the hour and refreshes', () => {
  const entry = go(step1, 'north');
  let x = entry.world;
  const E = x.state.clock;
  assert.ok(entry.lines.includes('narration.poisoned.applied'), entry.lines.join());
  assert.ok(entry.lines.includes('narration.needle'), entry.lines.join());
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

// Breaks: the poison ticks on another cadence or amount, or never expires; or (loka-y6yg.48) the
// item-expiry dedupe also folds the player's own ticks, so one long wait tells one tick, not three.
test('traps 7: left alone, the poison ticks at +1800, +3600, +5400 and expires at +7200', () => {
  let x = go(step1, 'north').world;
  const E = x.state.clock;
  const run_id = 'aaaaaaaa-0000-4000-8000-0000000007a7';
  const payload = { type: 'elapsed', actor_id: x.character, run_id, from: E, until: E + 7200 };
  const id = elapsedCommandId(run_id, x.context, E, E + 7200);
  const once = stepElapsed(x, { id, world_context_id: x.context, payload } as never, 1).decision;
  const said = once.kind === 'accepted' ? once.narration?.map((l) => l.key) : undefined;
  assert.equal(said?.filter((k) => k === 'narration.poisoned.tick').length, 3, said?.join());
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

/** The pack members spawned in `roomKey`, lower id first. */
const goblinsIn = (x: World, roomKey: string) =>
  Object.keys(x.state.created ?? {})
    .filter(
      (e) => x.state.created![e].origin.kind === 'spawned' && where(x, e) === room(x, roomKey),
    )
    .sort();
const hp = (x: World, e: string) => level(x, e as never, resourceRef(x, 'hp'));
const statuses = (x: World, e: string) => activeStatuses(x, e as never).map((s) => s.spec.key);
const afraidEnds = (x: World, e: string) =>
  activeStatuses(x, e as never).find((s) => s.spec.key === 'afraid')?.row.ends_at;
/** One Attack on `target`, then a round at a time until the encounter closes; the rounds' lines. */
function flight(x: World, target: string) {
  const r = play(x, { type: 'attack', target_id: target });
  const start = r.world.state.clock;
  const r1 = wait(r.world, start + 150);
  const r2 = wait(r1.world, start + 300);
  return { join: r.lines, r1, r2 };
}
/** The pack in the den, afraid, flees south one goblin a round; no hit on the player; the
 * plate (disarmed or not) poisons no goblin. */
function assertFlight(x: World) {
  const [a, b] = goblinsIn(x, 'chief_den');
  const { join, r1, r2 } = flight(x, a!);
  assert.deepEqual(join, ['combat.goblin_joined']);
  assert.deepEqual(r1.lines, [
    'combat.player_hit',
    'combat.goblin_fled_south',
    'combat.goblin_targeted',
  ]);
  assert.deepEqual([hp(r1.world, a!), goblinsIn(r1.world, 'chief_den')], [4, [b]]);
  assert.deepEqual(r2.lines, ['combat.goblin_fled_south', 'combat.goblins_gone']);
  assert.deepEqual(goblinsIn(r2.world, 'plate_passage'), [a, b]);
  assert.deepEqual([statuses(r2.world, a!), statuses(r2.world, b!)], [['afraid'], ['afraid']]);
  assert.equal(engaged(r2.world, r2.world.body), undefined);
  assert.equal(pool(r2.world, 'hp'), 10);
  return r2.world;
}
let den: World;
let stair: World;
const mood = (w: World, id: string) =>
  gameView(w).entities.flatMap((e) => (e.id === id ? [e.name, e.words?.bare, e.description] : []));
const CALM = ['npc.goblin.short', 'npc.den_goblin.bare', 'npc.goblin.description'];
const AFRAID = ['short_afraid', 'bare_afraid', 'description_afraid'].map((k) => `npc.goblin.${k}`);

// Breaks: the den or pack is missing, the begone card offered outside the den, the shout misses the
// pack (co_present dropped) or lands on the chief (immune dropped) or player, the afraid span or mood
// differs (no `when`, or the base words kept), or the afraid pack stands (fear or its flight dropped).
test('traps 8: in the den the shout frightens both goblins, not the chief; they flee south', () => {
  stair = go(go(w, 'west').world, 'west').world;
  w = go(go(stair, 'north').world, 'north').world;
  assert.equal(at(w), room(w, 'chief_den'));
  den = w;
  const [a, b] = goblinsIn(w, 'chief_den');
  assert.ok(a && b, 'two goblins in the den');
  assert.ok(refused(stair, { type: 'perform', action: 'shout_begone' }));
  assert.deepEqual(mood(w, a!), CALM);
  const s = perform(w, 'shout_begone');
  const fear = 'narration.afraid.applied';
  assert.deepEqual(s.lines, ['narration.shout_begone.success', fear, fear]);
  w = s.world;
  const T = w.state.clock;
  assert.deepEqual([afraidEnds(w, a), afraidEnds(w, b)], [T + 600, T + 600]);
  assert.deepEqual([statuses(w, npc(w, 'chief')), statuses(w, w.body)], [[], []]);
  assert.deepEqual(mood(w, a!), AFRAID);
  assert.deepEqual(mood(w, npc(w, 'chief')).slice(2), ['npc.chief.description']);
  assert.deepEqual(validate('GameView', gameView(w)), []);
  w = assertFlight(w);
});

// Breaks: a calm pack flees too (the flight is not off fear), or the control's numbers move.
test('traps 8 control: without the shout the pack stands; two rounds leave 8 and 2', () => {
  const [a, b] = goblinsIn(den, 'chief_den');
  const { r2 } = flight(den, a!);
  assert.deepEqual([pool(r2.world, 'hp'), hp(r2.world, a!), hp(r2.world, b!)], [8, 2, 6]);
  assert.deepEqual(goblinsIn(r2.world, 'chief_den'), [a, b]);
});

// Breaks: a pack's flight_below_percent drops (a calm goblin under a quarter of its hp stands)
// or rises (a calm goblin at a third of its hp flees).
test('traps 8 wounded: a calm goblin struck to 1 of 6 hp flees, to 2 of 6 stands, in each pack', () => {
  for (const [x, home] of [
    [den, 'chief_den'],
    [go(stair, 'down').world, 'sapper_cellar'],
  ] as const) {
    const [a, b] = goblinsIn(x, home);
    const at = key({ kind: 'resource', resource: resourceRef(x, 'hp'), entity_id: a as never });
    const hurt = (value: number) => ({
      ...x,
      state: {
        ...x.state,
        resources: { ...x.state.resources, [at]: { value, at: x.state.clock } },
      },
    });
    assert.deepEqual([hp(hurt(3), a!), statuses(hurt(3), a!)], [3, []]);
    assert.deepEqual(goblinsIn(flight(hurt(3), a!).r1.world, home), [b], home);
    const stands = flight(hurt(4), a!).r1.world;
    assert.deepEqual([hp(stands, a!), goblinsIn(stands, home)], [2, [a, b]], home);
  }
});

// Breaks: the chief takes more than one blow, pays other experience, or its fall frightens no
// goblin (chief_fell's co_present dropped) or frightens the player.
test('traps 9: the chief falls to one blow; its fall frightens the pack, which then flees', () => {
  const k = play(den, { type: 'attack', target_id: npc(den, 'chief') });
  const r1 = wait(k.world, k.world.state.clock + 150);
  assert.deepEqual(r1.lines, [
    'combat.player_hit',
    'combat.npc_died',
    'narration.afraid.applied',
    'narration.afraid.applied',
  ]);
  const x = r1.world;
  assert.equal(gameView(x).levelling?.experience, 10);
  assert.equal(engaged(x, x.body), undefined);
  const T = x.state.clock;
  assert.deepEqual(
    goblinsIn(x, 'chief_den').map((g) => afraidEnds(x, g)),
    [T + 600, T + 600],
  );
  assert.deepEqual(statuses(x, x.body), []);
  assertFlight(x);
});

// Breaks: the cellar's plate does not spring on entry, a re-entry while sprung or a disarmed
// cellar plate springs again (cellar_springs's guards), a failed disarm on the rearmed plate does
// not bite (cellar_bites), search or disarm is offered out of turn, the search or disarm scripted action is missing or
// keyed to the passage plate, or the cellar's skin or pack is missing.
test('traps sandbox: the cellar plate springs, is found and disarmed, then holds', () => {
  let x = fresh(WORLD);
  assert.notEqual(fact(x, 'cellar_sprung'), true);
  const down = go(go(go(x, 'west').world, 'down').world, 'down');
  assert.ok(down.lines.includes('narration.needle'), down.lines.join());
  x = down.world;
  assert.equal(at(x), room(x, 'sapper_cellar'));
  assert.ok(poisoned(x)?.ends_at, 'the entry poisons');
  assert.equal(fact(x, 'cellar_sprung'), true);
  assert.equal(goblinsIn(x, 'sapper_cellar').length, 2);
  assert.ok(id(x, 'item', 'cellar_skin') && where(x, id(x, 'item', 'cellar_skin')) === at(x));
  const first = poisoned(x);
  const again = go(go(x, 'up').world, 'down');
  assert.ok(!again.lines.some((l) => l.startsWith('narration.poisoned')), again.lines.join());
  assert.deepEqual(poisoned(again.world), first);
  assert.equal(refused(x, { type: 'perform', action: 'disarm_cellar' }), 'invalid_state');
  x = perform(x, 'search_cellar').world;
  assert.equal(refused(x, { type: 'perform', action: 'search_cellar' }), 'invalid_state');
  assert.deepEqual([fact(x, 'cellar_found'), fact(x, 'plate_found')], [true, undefined]);
  assert.equal(outcome(x, 'disarm_cellar').out, 'failure');
  // On the hour the plate rearms under the player; a failed disarm then bites (cellar_bites).
  x = wait(x, Math.ceil((x.state.clock + 1) / HOUR) * HOUR).world;
  const miss = outcome(x, 'disarm_cellar');
  assert.deepEqual([fact(x, 'cellar_sprung'), miss.out], [false, 'failure']);
  assert.notDeepEqual(poisoned(miss.world), poisoned(x), 'the unsprung miss bites');
  assert.ok(miss.lines.includes('narration.needle'), miss.lines.join());
  const r = outcome(miss.world, 'disarm_cellar');
  assert.equal(r.out, 'success');
  x = r.world;
  assert.deepEqual([fact(x, 'cellar_disarmed'), fact(x, 'plate_disarmed')], [true, undefined]);
  const before = poisoned(x);
  x = wait(go(x, 'up').world, Math.ceil((x.state.clock + 1) / HOUR) * HOUR).world;
  assert.equal(fact(x, 'cellar_sprung'), false);
  const back = go(x, 'down');
  assert.ok(!back.lines.some((l) => l.startsWith('narration.poisoned')), back.lines.join());
  assert.deepEqual(poisoned(back.world), before);
});

// Breaks: the cellar twins drift from the den's: the cellar chief is not immune, its fall frightens
// no goblin (cellar_chief_fell's co_present), or an afraid cellar goblin stands (the pack's flight).
test("traps sandbox twins: the cellar pack fears the shout and its chief's fall, and flees up", () => {
  const x = go(stair, 'down').world;
  const [a, b] = goblinsIn(x, 'sapper_cellar');
  const chief = npc(x, 'cellar_chief');
  const s = perform(x, 'shout_begone_cellar').world;
  assert.deepEqual(
    [statuses(s, a!), statuses(s, b!), statuses(s, chief)],
    [['afraid'], ['afraid'], []],
  );
  assert.deepEqual(mood(s, a!), AFRAID);
  const { r1 } = flight(s, a!);
  assert.deepEqual(goblinsIn(r1.world, 'sapper_stair'), [a]);
  const k = play(x, { type: 'attack', target_id: chief });
  const died = wait(k.world, k.world.state.clock + 150);
  assert.ok(died.lines.includes('combat.npc_died'), died.lines.join());
  const f = died.world;
  assert.deepEqual([statuses(f, a!), statuses(f, b!)], [['afraid'], ['afraid']]);
});
