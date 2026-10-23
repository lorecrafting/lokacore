// size: allow 750, the Homestead walk (steps 1 to 13) and its croft sandbox continue one world and share its helpers
// The showcase Homestead district walked step by step (docs/showcase/homestead-district.md,
// guided loop steps 1 to 8). Each test continues the world the one before it left.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { unrazable } from '../src/mechanics/service/build.ts';
import {
  act,
  attribute,
  detail,
  choose,
  DAY,
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
  ref,
  refused,
  reload,
  room,
  take,
  talk,
  wait,
  where,
  leave,
} from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-0000000004d8';
const R = (kind: string, key: string) => ({
  cartridge_id: 'toolbox_showcase',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const hire = (w: World, service: string, quoted_price: number) => ({
  type: 'use_service',
  provider_id: npc(w, 'carpenter'),
  service: R('service', service),
  quoted_price,
});
const tree = (w: World) =>
  gameView(w).skills!.map(({ skill, level, locked }) => [skill.key, level ?? null, locked ?? null]);
const choices = (w: World) =>
  gameView(w).choice!.choices.map((c) => [c.choice_id, c.available] as const);
const offer = (w: World, action: string) => {
  let found: { available: boolean; reason?: object } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === action ? (found = v) : v));
  assert.ok(found, `${action} offered`);
  return found;
};
const reason = (key: string) => ({ code: 'invalid_state', message: { key } });
const drop = (w: World, k: string) => play(w, { type: 'drop', item_id: id(w, 'item', k) }).world;
const here = (w: World) => where(w, w.body);
const cont = (w: World) => pending(w, w.character)![0];
// The lesson hub reopens after every answer; close_choice (Leave the conversation) ends the sitting.
const shut = (w: World) => play(w, { type: 'close_choice', continuation_id: cont(w) }).world;
const pennies = (w: World) => pool(w, 'pennies');
const walk = (w: World, ...ds: string[]) => ds.reduce((x, d) => go(x, d).world, w);
const built = (w: World) =>
  Object.keys(w.state.created ?? {}).filter((k) => w.state.created![k].origin.kind === 'built');
// Every GameView a step leaves must hold the protocol schema.
const valid = (w: World) => (assert.deepEqual(validate('GameView', gameView(w)), []), w);

let w: World;
const seen: string[] = []; // every GameView and decision before Carving is learned (hs-14)
const note = <R extends { decision: unknown; world: World }>(r: R) => {
  seen.push(JSON.stringify(r.decision), JSON.stringify(gameView(r.world)));
  return r;
};

// Breaks: the lane not west of fell_gate, the sign unreadable, or a skill row added, dropped or
// locked wrongly (carving and carpentry locked, the hidden joinery left out).
test('homestead 1: west from fell_gate, the sign, the skill tree', () => {
  w = go(fresh(WORLD), 'north').world;
  w = note(go(w, 'west')).world;
  assert.equal(here(w), room(w, 'holding_lane'));
  const sign = note(play(w, { type: 'read', target_id: detail(w, 'sign_homestead') }));
  assert.deepEqual(sign.lines, ['readable.sign_homestead']);
  assert.deepEqual(tree(valid(w)), [
    ['blade', null, null],
    ['carpentry', 0, true],
    ['carving', 0, true],
    ['cooking', 0, null],
    ['disarm', 0, null],
    ['intimidate', 0, null],
    ['pick', 0, null],
    ['stealth', 0, null],
    ['whittling', 0, null],
    ['woodcutting', 0, null],
  ]);
});

// Breaks: a lesson not taught, the paid carving lesson offered before whittling 2, the hidden
// joinery choice listed, carpentry open at woodcutting 1, or a forged carving choose admitted
// (hs-14).
test('homestead 2: the two free lessons; carving offered but unavailable; take the kit', () => {
  w = note(go(w, 'west')).world;
  assert.equal(here(w), room(w, 'carpenter_shop'));
  const opened = note(play(w, { type: 'talk', target_id: npc(w, 'carpenter') }));
  w = opened.world;
  assert.deepEqual(choices(w), [
    ['carpentry', false],
    ['carving', false],
    ['whittling', true],
    ['woodcutting', true],
  ]);
  w = note(choose(w, 'whittling')).world;
  w = note(choose(w, 'woodcutting')).world;
  assert.deepEqual(choices(w)[0], ['carpentry', false]); // woodcutting 1, one under the gate
  const forged = note(act(w, { type: 'choose', choice_id: 'carving', continuation_id: cont(w) }));
  assert.equal(forged.decision.kind, 'rejected');
  assert.equal((forged.decision as { error: { code: string } }).error.code, 'invalid_state');
  w = shut(w);
  for (const k of ['axe', 'stick_01', 'stick_02', 'cot', 'rug']) w = take(w, k);
  assert.deepEqual(
    tree(valid(w)).filter(([k]) => k === 'whittling' || k === 'woodcutting'),
    [
      ['whittling', 1, null],
      ['woodcutting', 1, null],
    ],
  );
});

// Breaks: the carve consumes no stick, yields no spoon, the skill does not grow per use, or a
// third carve with no stick is admitted.
test('homestead 3: carve_spoon twice; the third has no stick', () => {
  const carve = () => note(act(w, { type: 'perform', action: 'carve_spoon' }));
  for (const level of [2, 3]) {
    const r = carve();
    assert.deepEqual(r.lines, ['narration.carve_spoon.success']);
    w = r.world;
    assert.equal(tree(w).find(([k]) => k === 'whittling')![1], level);
    // Whittling 2 exactly opens the carving lesson (offered unavailable at 1, homestead 2).
    if (level === 2)
      assert.deepEqual(
        choices(talk(w, 'carpenter').world).find(([k]) => k === 'carving'),
        ['carving', true],
      );
  }
  assert.equal(fact(w, 'uses_whittling'), 2);
  for (const k of ['stick_01', 'stick_02'])
    assert.equal(where(w, id(w, 'item', k)), room(w, 'midden'));
  for (const k of ['spoon_01', 'spoon_02']) assert.equal(where(w, id(w, 'item', k)), w.body);
  assert.deepEqual(offer(w, 'carve_spoon').reason, reason('craft.carve_spoon.needs'));
  assert.equal(refused(w, { type: 'perform', action: 'carve_spoon' }), 'invalid_state');
  // hs-14: the hidden joinery leaves no trace in any view or decision before Carving.
  assert.equal(seen.length, 18); // two per noted decision; the authored Leave press is gone (loka-x6t.21)
  assert.ok(!seen.some((s) => s.includes('joinery')));
});

// Breaks: the lesson unpaid, the joinery row or choice still hidden after Carving 1, or a second
// carving lesson admitted.
test('homestead 4: carving for 2 pennies; joinery appears', () => {
  w = talk(w, 'carpenter').world;
  w = choose(w, 'carving').world;
  assert.equal(pennies(w), 8);
  assert.equal(
    refused(w, { type: 'choose', choice_id: 'carving', continuation_id: cont(w) }),
    'invalid_state',
  );
  assert.deepEqual(
    tree(valid(w)).filter(([k]) => ['carving', 'joinery'].includes(k as string)),
    [
      ['carving', 1, false],
      ['joinery', null, false],
    ],
  );
  w = talk(shut(w), 'carpenter').world;
  assert.equal(choices(w).find(([k]) => k === 'joinery')?.[1], true);
  w = shut(w);
});

// Breaks: a chop yields no log or more than one, woodcutting does not grow, carpentry taught
// before woodcutting 2, a saw consumes the wrong count or yields no timber, the timbered raise
// admitted at carpentry 1, or a third saw with no logs admitted.
test('homestead 5: chop four logs, learn carpentry, saw two timbers', () => {
  w = walk(w, 'east', 'south', 'west');
  assert.equal(here(w), room(w, 'glade'));
  const logs = Array.from({ length: 8 }, (_, i) => id(w, 'item', `log_0${i + 1}`));
  const held = (x: World) => logs.filter((l) => where(x, l) === x.body).length;
  for (const level of [2, 3, 3, 3]) {
    w = play(w, { type: 'perform', action: 'chop' }).world;
    assert.equal(tree(w).find(([k]) => k === 'woodcutting')![1], level);
  }
  assert.equal(held(w), 4);
  w = walk(w, 'east', 'north', 'west');
  w = choose(talk(w, 'carpenter').world, 'carpentry').world;
  assert.equal(pennies(w), 6);
  w = shut(w);
  for (const level of [1, 2]) {
    w = play(w, { type: 'perform', action: 'saw' }).world;
    assert.equal(tree(w).find(([k]) => k === 'carpentry')![1], level);
    // carpentry 1, one under the raise's gate: its policy fails before the timber count
    if (level === 1)
      assert.deepEqual(offer(walk(w, 'east'), 'raise_timbered_hut').reason, {
        code: 'invalid_state',
      });
  }
  assert.equal(held(w), 0);
  assert.equal(logs.filter((l) => where(w, l) === room(w, 'woodpile')).length, 8);
  for (const k of ['timber_01', 'timber_02']) assert.equal(where(w, id(w, 'item', k)), w.body);
  assert.deepEqual(offer(w, 'saw').reason, reason('craft.saw.needs'));
});

// Breaks: the woodpile's eight logs not the chop's cap (a ninth chop admitted, or the eighth
// refused), or carpentry not open at exactly woodcutting 2.
test('homestead 5 boundary: the eighth chop yields, the ninth is refused', () => {
  let x = walk(fresh(WORLD), 'north', 'west', 'west');
  x = leave(choose(talk(x, 'carpenter').world, 'woodcutting').world);
  x = play(walk(take(x, 'axe'), 'east', 'south', 'west'), {
    type: 'perform',
    action: 'chop',
  }).world;
  x = talk(walk(x, 'east', 'north', 'west'), 'carpenter').world;
  assert.deepEqual(choices(x)[0], ['carpentry', true]); // woodcutting 2: the gate exactly
  x = walk(shut(x), 'east', 'south', 'west');
  for (let i = 1; i < 8; i++) x = play(x, { type: 'perform', action: 'chop' }).world;
  assert.equal(where(x, id(x, 'item', 'log_08')), x.body);
  assert.equal(refused(x, { type: 'perform', action: 'chop' }), 'invalid_state');
});

// Breaks: the raise consumes no timber or sends it elsewhere, builds no room north of the lane
// or for another owner, or a second hut (plain or timbered) admitted on the taken site.
test('homestead 6: raise the timbered hut north of the lane', () => {
  w = walk(w, 'east');
  w = play(w, { type: 'perform', action: 'raise_timbered_hut' }).world;
  for (const k of ['timber_01', 'timber_02'])
    assert.equal(where(w, id(w, 'item', k)), room(w, 'timber_yard'));
  const [hut] = built(w);
  assert.deepEqual(JSON.parse(JSON.stringify(w.state.created![hut!].origin)), {
    kind: 'built',
    site: R('room', 'holding_lane'),
    direction: 'north',
    owner: w.character,
  });
  assert.ok(gameView(valid(w)).exits.some((e) => e.direction === 'north'));
  assert.deepEqual(offer(w, 'raise_timbered_hut').reason, reason('service.site_taken'));
  assert.equal(refused(w, { type: 'perform', action: 'raise_timbered_hut' }), 'invalid_state');
  assert.deepEqual(offer(walk(w, 'west'), 'raise_hut_plain').reason, reason('service.site_taken'));
});

// Breaks: the plain hut's price not 5 (the exact five refused), or the hut built with no payment.
test('homestead 6 branch: the plain hut for exactly 5 pennies; a second is site_taken', () => {
  let x = walk(fresh(WORLD), 'north', 'west', 'west');
  x = play(x, hire(x, 'raise_hut_plain', 5)).world;
  assert.equal(pennies(x), 5);
  assert.equal(built(x).length, 1);
  assert.deepEqual(offer(x, 'raise_hut_plain').reason, reason('service.site_taken'));
});

// Breaks: the hut's rug variant not read, or the cot reaction firing where it is not authored
// (the built hut: Toolbox finding 1) or with the cot in hand.
test('homestead 7: the rug variant in the hut; resting there with the cot applies nothing', () => {
  w = walk(w, 'north');
  const hut = here(w);
  assert.equal(gameView(w).place.description.key, 'blueprint.hut_timbered.description');
  w = drop(w, 'rug');
  assert.equal(gameView(w).place.description.key, 'blueprint.hut_timbered.description.rug');
  assert.equal(
    gameView(take(w, 'rug')).place.description.key,
    'blueprint.hut_timbered.description',
  );
  w = drop(w, 'cot');
  const rest = play(w, { type: 'rest' });
  assert.deepEqual(rest.lines, []);
  assert.deepEqual(labels(wait(rest.world, w.state.clock + 3600).world), []);
  w = play(rest.world, { type: 'stand' }).world;
  assert.equal(here(w), hut);
});

// Breaks: the raze unpaid or refused for the owner, the north exit kept, the hut's floor lost
// rather than moved to the lane (finding 3), the plain hut not offered again, a hut admitted at 4
// pennies, or a stranger's raze or one over a corpse admitted (refusal order: owner, then
// occupied).
test('homestead 8: raze for 2 pennies; the cot and rug land in the lane', () => {
  const [hut] = built(w);
  const b = w.cartridge.services![ref('service', 'raze_hut')]!.benefit as never;
  const other = '00000000-0000-4000-8000-0000000000c3' as never;
  assert.deepEqual(unrazable(w, b, other), { code: 'permission_denied' });
  const corpse = structuredClone(w) as any;
  const dead = '00000000-0000-4000-8000-0000000000c4';
  corpse.state.created[dead] = {
    id: dead,
    definition: ref('item', 'cot'),
    origin: { kind: 'death', victim_id: other, owner_id: other, event_id: other },
  };
  corpse.state.containers[dead] = hut;
  assert.deepEqual(unrazable(corpse, b, w.character), reason('service.occupied'));
  assert.deepEqual(unrazable(corpse, b, other), { code: 'permission_denied' });
  w = walk(w, 'south', 'west');
  w = play(w, hire(w, 'raze_hut', 2)).world;
  assert.equal(pennies(w), 4);
  assert.deepEqual(w.state.built, { [hut!]: { razed_at: w.state.clock } });
  const lane = room(w, 'holding_lane');
  for (const k of ['cot', 'rug']) assert.equal(where(w, id(w, 'item', k)), lane);
  assert.equal(refused(w, hire(w, 'raze_hut', 2)), 'invalid_state');
  assert.equal(offer(w, 'raise_hut_plain').available, false);
  assert.equal(refused(w, hire(w, 'raise_hut_plain', 5)), 'insufficient_resource');
  w = walk(w, 'east');
  assert.ok(!gameView(valid(w)).exits.some((e) => e.direction === 'north'));
});

// Breaks: the cot reaction ignoring its item_present (resting with the cot in hand) or its room,
// or well_rested not ticking five times in its hour.
test('homestead 7 lane branch: rest with the cot on the lane floor', () => {
  const held = take(w, 'cot');
  assert.deepEqual(play(held, { type: 'rest' }).lines, []);
  const r = play(w, { type: 'rest' });
  assert.deepEqual(r.lines, ['narration.well_rested.applied']);
  assert.deepEqual(labels(r.world), ['condition.well_rested']);
  const after = wait(r.world, w.state.clock + 3600);
  // Five ticks in the hour; one elapsed decision's narration folds them into one line.
  assert.equal(after.events.filter((e) => e.type === 'status_ticked').length, 5);
  assert.deepEqual(labels(after.world), []);
});

// Breaks (hs-14 load check): the dialogue schema admitting a label on the hidden-lesson dialogue.
test('a label on carpenter_lessons is a schema violation', () => {
  assert.equal(
    reload((c) => (c.dialogues[ref('dialogue', 'carpenter_lessons')].label = 'x')),
    'SCHEMA_VIOLATION .cartridge.dialogues["toolbox_showcase@0.0.1:dialogue/carpenter_lessons"].label',
  );
});

const farmer = (w: World, service: string, quoted_price: number) => ({
  ...hire(w, service, quoted_price),
  provider_id: npc(w, 'farmer'),
});
// The order is free and the claim costs 1 (a 0 claim price is a schema violation).
const cook = (w: World, service: string) => ({
  ...hire(w, service, service === 'stew' ? 0 : 1),
  provider_id: npc(w, 'cook'),
});
const give = (w: World, k: string) =>
  play(w, { type: 'give', item_id: id(w, 'item', k), recipient_id: npc(w, 'farmer') }).world;
const regard = (w: World) => fact(w, 'regard', npc(w, 'farmer'));
const farmerText = (w: World) =>
  gameView(w).entities.find((e) => e.id === npc(w, 'farmer'))?.description;
// Found by trial (as fishing.test.ts): the luck draw passes with PASS and fails with FAIL.
const PASS = [2, 2, 2, 2];
const FAIL = [1, 1, 1, 1];
const FISH = ['trout_01', 'trout_02', 'eel_01', 'salmon_01'];
const cast = (w: World, rng: number[]) =>
  act({ ...w, state: { ...w.state, rng } } as World, {
    type: 'perform',
    action: 'fish',
    target_id: id(w, 'item', 'pond_water'),
    item_id: id(w, 'item', 'rod'),
  });
/** The fish in room `k`, or held when `k` is 'held'. */
const fishIn = (w: World, k: string) =>
  FISH.filter((f) => where(w, id(w, 'item', f)) === (k === 'held' ? w.body : room(w, k)));
const landed = (w: World) => {
  const r = cast(w, PASS);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return fishIn(r.world, 'pond');
};
const pond = (clock: number) =>
  take(wait(walk(fresh(WORLD), 'north', 'west', 'south', 'east'), clock).world, 'rod');
const statusOn = (w: World, k: string, key: string) =>
  Object.entries(w.state.statuses ?? {}).some(([s, v]) => {
    const t = JSON.parse(s) as { body_id: string; status: { key: string } };
    return t.body_id === id(w, 'item', k) && t.status.key === key && v.active;
  });
const describe = (w: World, k: string) =>
  gameView(w).entities.find((e) => e.id === id(w, 'item', k))?.description;

// Breaks: a gift reaction firing on the wrong item or the wrong fact, regard not per NPC, the
// warm description not read; the barter taking one pelt, paying pennies, scheduling a job, or repeating.
test('homestead 9: gifts move regard; two pelts barter for the knife once', () => {
  w = walk(w, 'south');
  w = give(take(w, 'holding_apple'), 'holding_apple');
  assert.equal(regard(w), 1);
  assert.equal(farmerText(w), 'npc.farmer.description_warm');
  w = give(take(w, 'dead_rat'), 'dead_rat');
  assert.equal(regard(w), 0);
  assert.equal(farmerText(w), 'npc.farmer.description');
  w = walk(take(walk(w, 'west'), 'pelt_01'), 'east');
  assert.equal(refused(w, farmer(w, 'knife_for_pelts', 0)), 'not_owned');
  assert.deepEqual(offer(w, 'barter').reason, {
    code: 'not_owned',
    message: { key: 'service.missing_inputs' },
  });
  w = walk(take(take(walk(w, 'west'), 'pelt_02'), 'pelt_03'), 'east');
  const jobs = Object.keys(w.state.jobs ?? {}).length;
  w = play(w, farmer(w, 'knife_for_pelts', 0)).world;
  assert.equal(where(w, id(w, 'item', 'knife_01')), w.body);
  const stall = ['pelt_01', 'pelt_02', 'pelt_03'].filter(
    (k) => where(w, id(w, 'item', k)) === room(w, 'stall'),
  );
  assert.equal(stall.length, 2);
  assert.equal(pennies(w), 4);
  assert.equal(Object.keys(w.state.jobs ?? {}).length, jobs);
  assert.equal(refused(w, farmer(w, 'knife_for_pelts', 0)), 'invalid_state');
  assert.deepEqual(offer(w, 'barter').reason, reason('service.order_open'));
  valid(w);
});

// Breaks: the rat reaction adjusting by anything but -1, or the cold description not read.
test('homestead 9 branch: the rat first leaves the farmer cold', () => {
  let x = walk(fresh(WORLD), 'north', 'west', 'south');
  x = give(take(x, 'dead_rat'), 'dead_rat');
  assert.equal(regard(x), -1);
  assert.equal(farmerText(x), 'npc.farmer.description_cold');
});

// Breaks: the bite landing nothing or two trout, the cooldown dropped, cap 1 lifted, the deep
// refilled at once, or spoiling not applied on the catch.
test('homestead 10: two trout by day, one per cast, then the deep is empty', () => {
  w = take(walk(w, 'east'), 'rod');
  assert.ok(w.state.clock % DAY < 18 * HOUR, 'still the trout window');
  let r = cast(w, PASS);
  w = r.world;
  const [first] = fishIn(w, 'pond');
  assert.match(first!, /^trout_0[12]$/);
  assert.ok(statusOn(take(w, first!), first!, 'spoiling'));
  assert.equal((cast(w, PASS).decision as any).error.code, 'cooldown');
  w = wait(take(w, first!), w.state.clock + 600).world;
  assert.equal(landed(w).length, 1);
  w = cast(w, PASS).world;
  w = take(w, fishIn(w, 'pond')[0]!);
  w = wait(w, w.state.clock + 600).world;
  assert.deepEqual(landed(w), []);
  assert.deepEqual(fishIn(w, 'held').sort(), ['trout_01', 'trout_02']);
  valid(w);
});

// Breaks: the eel, trout or salmon rule ignoring its window (06:00 and 18:00 edges) or sky, or a failing draw landing a fish.
test('homestead 10 branch: eel by night, salmon on a wet day, nothing on a miss', () => {
  assert.deepEqual(landed(pond(22 * HOUR)), ['eel_01']);
  // Day 3 (gale, no salmon): 05:59:59 is still eel, 06:00 is trout.
  assert.deepEqual(landed(pond(2 * DAY + 6 * HOUR - 1)), ['eel_01']);
  assert.match(landed(pond(2 * DAY + 6 * HOUR)).join(), /^trout_0[12]$/);
  // 17:59:59 is still trout, 18:00 is eel.
  assert.match(landed(pond(2 * DAY + 18 * HOUR - 1)).join(), /^trout_0[12]$/);
  assert.deepEqual(landed(pond(2 * DAY + 18 * HOUR)), ['eel_01']);
  const wet = landed(pond(DAY + 10 * HOUR));
  assert.equal(wet.length, 2);
  assert.ok(wet.includes('salmon_01'));
  const miss = cast(pond(10 * HOUR), FAIL);
  assert.deepEqual(fishIn(miss.world, 'pond'), []);
});

const eat = (w: World, k: string) => play(w, { type: 'eat', item_id: id(w, 'item', k) });
const str = (w: World) => attribute(w, 'str');
const cookAt = (w: World, recipe: string) => ({
  type: 'perform',
  action: recipe,
  target_id: detail(w, 'hearth'),
});
let fed: World; // step 11 just after the stew, fed still active

// Breaks: the order taking one fish, its price or escrow custody, the ready_after boundary
// (+299 or +300), the stew not fed, or fed's str modifier or duration.
test('homestead 11: order a stew from two fish, claim it at +300, eat it', () => {
  w = walk(w, 'west', 'south');
  assert.equal(refused(drop(w, 'trout_02'), cook(w, 'stew')), 'not_owned');
  w = play(w, cook(w, 'stew')).world;
  assert.equal(pennies(w), 4);
  assert.deepEqual(fishIn(w, 'larder').sort(), ['trout_01', 'trout_02']);
  assert.equal(fact(w, 'ordered'), true);
  const t = w.state.clock;
  assert.equal(refused(wait(w, t + 299).world, cook(w, 'claim')), 'invalid_state');
  assert.deepEqual(offer(wait(w, t + 299).world, 'claim').reason, reason('service.not_ready'));
  w = wait(w, t + 300).world;
  w = play(w, cook(w, 'claim')).world;
  assert.equal(pennies(w), 3);
  assert.equal(where(w, id(w, 'item', 'stew_plain_01')), w.body);
  const mv = pool(w, 'mv')!;
  assert.equal(str(w), 10);
  w = eat(w, 'stew_plain_01').world;
  fed = w;
  assert.equal(pool(w, 'mv'), Math.min(100, mv + 10));
  assert.equal(str(w), 11);
  assert.deepEqual(labels(w), ['condition.fed']);
  w = wait(w, w.state.clock + 3600).world;
  assert.equal(str(w), 10);
  valid(w);
});

// Breaks: cook_stew needing other than two fish or no lesson, the yield or larder custody wrong,
// hearty's +2 or its stacking with fed, cook_feast offered at Cooking 1.
test('homestead 12: learn cooking, cook a hearty stew from two fresh fish, eat it', () => {
  w = choose(talk(w, 'cook').world, 'cooking').world;
  w = wait(walk(w, 'north', 'east'), 2 * DAY + 10 * HOUR).world;
  for (let i = 0; i < 2; i += 1) {
    const r = cast(w, PASS);
    w = take(r.world, fishIn(r.world, 'pond')[0]!);
    w = wait(w, w.state.clock + 600).world;
  }
  w = walk(w, 'west', 'south');
  const one = drop(w, fishIn(w, 'held')[0]!);
  assert.equal(refused(one, cookAt(one, 'cook_stew')), 'invalid_state');
  assert.deepEqual(offer(one, 'cook_stew').reason, reason('craft.cook_stew.needs'));
  // The lowest larder EntityId: derived, as ids move with every item the cartridge adds.
  const [hearty] = ['01', '02', '03'].map((n) => id(w, 'item', `stew_hearty_${n}`)).sort();
  w = play(w, cookAt(w, 'cook_stew')).world;
  assert.equal(where(w, hearty!), w.body);
  assert.equal(fishIn(w, 'larder').length, 2);
  assert.equal(fact(w, 'uses_cooking'), 1);
  assert.deepEqual(offer(w, 'cook_feast').reason, { code: 'invalid_state' });
  w = play(w, { type: 'eat', item_id: hearty! }).world;
  assert.equal(str(w), 12);
  assert.deepEqual(labels(w), ['condition.hearty']);
  // Branch: the same stew eaten while fed is still active.
  const both = structuredClone(fed) as any;
  both.state.containers[hearty!] = both.body;
  assert.equal(str(play(both, { type: 'eat', item_id: hearty! }).world), 13);
  // The loop's pennies last: the 3 left buy the plot (step 13).
  assert.equal(pennies(play(walk(w, 'north'), farmer(w, 'buy_plot', 3)).world), 0);
  valid(w);
});

const put = (w: World, k: string, c: string) =>
  act(w, { type: 'put', item_id: id(w, 'item', k), container_id: id(w, 'item', c) });
const yard = () => walk(fresh(WORLD), 'north', 'west', 'south');
/** A fresh yard at `clock` with the plot bought and the seed (and can) held. */
const sowable = (clock: number) =>
  wait(
    take(take(play(yard(), farmer(yard(), 'buy_plot', 3)).world, 'seed_01'), 'watering_can'),
    clock,
  ).world;
const sown = sowable(28800);
const plot = (w: World) => id(w, 'item', 'plot');
const water = (w: World) =>
  play(w, {
    type: 'perform',
    action: 'water_plot',
    target_id: plot(w),
    item_id: id(w, 'item', 'watering_can'),
  }).world;
// Which larder turnip the replenish draws follows the item ids, so any of the three counts.
const turnip = (w: World) =>
  ['turnip_01', 'turnip_02', 'turnip_03'].find((k) => where(w, id(w, 'item', k)) === plot(w));
const croftTouched = (w: World) =>
  statusOn(w, 'croft_plot', 'withered') ||
  ['turnip_01', 'turnip_02', 'turnip_03'].some(
    (k) => where(w, id(w, 'item', k)) === id(w, 'item', 'croft_plot'),
  );

// Breaks: the plot lock, the sow rule (status, stamp, spent seed), the description thresholds,
// the water midpoint (43200 is late), the seed return, the cure on resowing, the winter guard,
// a seed given away (sow would start the plot's clock on the farmer).
test('homestead 13: buy the plot, sow at 08:00, water after the midpoint, harvest', () => {
  const seed = take(yard(), 'seed_01');
  const gift = {
    type: 'give',
    item_id: id(seed, 'item', 'seed_01'),
    recipient_id: npc(seed, 'farmer'),
  };
  assert.equal(refused(seed, gift), 'invalid_state');
  assert.equal(
    refused(take(yard(), 'seed_01'), {
      type: 'put',
      item_id: id(sown, 'item', 'seed_01'),
      container_id: plot(sown),
    }),
    'permission_denied',
  );
  assert.equal(pennies(sown), 7);
  let s = put(sown, 'seed_01', 'plot').world;
  assert.equal(statusOn(s, 'plot', 'growing'), true);
  assert.equal(fact(s, 'sown_at', plot(s)), 28800);
  assert.equal(where(s, id(s, 'item', 'seed_01')), room(s, 'midden'));
  assert.equal(describe(wait(s, 28800 + 3599).world, 'plot'), 'item.plot.description');
  assert.equal(describe(wait(s, 28800 + 3600).world, 'plot'), 'item.plot.shoots');
  assert.equal(describe(wait(s, 28800 + 64799).world, 'plot'), 'item.plot.shoots');
  assert.equal(describe(wait(s, 28800 + 64800).world, 'plot'), 'item.plot.heavy');
  const at = (t: number) => wait(water(wait(s, 28800 + t).world), 28800 + DAY).world;
  const ripe = at(43201);
  const crop = turnip(ripe) ?? assert.fail('no turnip ripened');
  assert.equal(statusOn(ripe, 'plot', 'withered'), false);
  // One sow stamps both lifecycles on its holder; the other plot must stay untouched.
  assert.equal(croftTouched(ripe), false);
  const h = take(ripe, crop);
  assert.equal(where(h, id(h, 'item', crop)), h.body);
  for (const late of [at(43200), wait(s, 28800 + DAY).world]) {
    assert.equal(turnip(late), undefined);
    assert.equal(describe(late, 'plot'), 'item.plot.withered');
    assert.equal(croftTouched(late), false);
  }
  // The seed returns 172800 after world start (25200); resowing cures withered.
  s = wait(s, 28800 + DAY).world;
  assert.equal(where(wait(s, 197999).world, id(s, 'item', 'seed_01')), room(s, 'midden'));
  s = take(wait(s, 198000).world, 'seed_01');
  s = put(s, 'seed_01', 'plot').world;
  assert.equal(statusOn(s, 'plot', 'withered'), false);
  assert.equal(statusOn(s, 'plot', 'growing'), true);
  // Day 4 is winter: the seed lies in the plot and nothing grows.
  const winter = put(sowable(3 * DAY + 28800), 'seed_01', 'plot').world;
  assert.equal(where(winter, id(winter, 'item', 'seed_01')), plot(winter));
  assert.equal(statusOn(winter, 'plot', 'growing'), false);
  valid(h);
});

// Breaks: a container (one added later included) without the pair sow stamps on its holder.
test('homestead sandbox: every container but the two plots is immune to both sow statuses', () => {
  const open = Object.entries(fresh(WORLD).cartridge.items!).filter(
    ([k, d]) =>
      d.container &&
      !/item\/(croft_)?plot$/.test(k) &&
      ['growing', 'growing_croft'].some((s) => !d.immune?.some((r) => r.key === s)),
  );
  assert.deepEqual(open, []);
});

// Breaks: the strongbox's immune pair (growing on it would wither or ripen the plots).
test('homestead sandbox: a seed put in the strongbox starts nothing', () => {
  const at = { ...sown.state.containers, [sown.body]: room(sown, 'tollhouse') };
  let w = { ...sown, state: { ...sown.state, containers: at } } as World;
  w = perform(perform(w, 'pick_strongbox').world, 'pick_strongbox').world;
  w = play(w, { type: 'open', target_id: id(w, 'item', 'strongbox') }).world;
  w = put(w, 'seed_01', 'strongbox').world;
  const on = ['strongbox', 'plot', 'croft_plot'].flatMap((k) =>
    ['growing', 'growing_croft', 'withered'].filter((s) => statusOn(w, k, s)),
  );
  const later = wait(w, 28800 + DAY).world;
  assert.deepEqual(
    [where(w, id(w, 'item', 'seed_01')), on, fact(w, 'sown_at', plot(w))],
    [id(w, 'item', 'strongbox'), [], undefined],
  );
  assert.deepEqual([croftTouched(later), turnip(later)], [false, undefined]);
});

const hens = (w: World) =>
  Object.entries(w.state.created ?? {})
    .filter(([, c]) => c.definition.key === 'hen')
    .map(([e]) => where(w, e));
const eggs = (w: World) =>
  [1, 2, 3, 4, 5, 6].filter((n) => where(w, id(w, 'item', `egg_0${n}`)) === id(w, 'item', 'nest'))
    .length;

// Breaks: feeding not on the trough, the spent grain kept, laying off the 14400 tick, the nest
// cap, births past night_target 4 (cap 4 is the loader's ceiling for it) or a hen leaving the
// croft, the grain return.
test('homestead sandbox: grain in the trough lays eggs to the nest cap; hens breed to four', () => {
  let h = walk(fresh(WORLD), 'north', 'west', 'up');
  assert.deepEqual(hens(h), [room(h, 'holding_croft'), room(h, 'holding_croft')]);
  h = take(h, 'grain_01');
  // Taking the grain is not feeding: no eggs from grain in hand.
  assert.equal(eggs(wait(h, h.state.clock + 14400).world), 0);
  h = put(h, 'grain_01', 'trough').world;
  const t = h.state.clock;
  assert.equal(where(h, id(h, 'item', 'grain_01')), room(h, 'midden'));
  assert.equal(eggs(wait(h, t + 14399).world), 0);
  assert.equal(eggs(wait(h, t + 14400).world), 2);
  assert.equal(eggs(wait(h, t + 28800).world), 3);
  assert.equal(hens(wait(h, 71999).world).length, 2);
  assert.equal(hens(wait(h, 72000).world).length, 4);
  // The grain returns 86400 after world start (25200).
  assert.equal(where(wait(h, 111599).world, id(h, 'item', 'grain_01')), room(h, 'midden'));
  assert.equal(where(wait(h, 111600).world, id(h, 'item', 'grain_01')), room(h, 'holding_croft'));
  h = wait(h, 3 * DAY).world;
  assert.deepEqual(hens(h), Array(4).fill(room(h, 'holding_croft')));
  valid(h);
});

// Breaks: the croft plot's put or get lock, water_croft off growing_croft, or the croft ripen and
// wither rules off the 43200 edge.
test('homestead sandbox: the croft plot is locked, ripens when watered early, withers when late', () => {
  const crop = (x: World) =>
    ['turnip_01', 'turnip_02', 'turnip_03'].filter(
      (k) => where(x, id(x, 'item', k)) === id(x, 'item', 'croft_plot'),
    );
  const tenant = walk(take(yard(), 'seed_01'), 'north', 'up');
  const sowing = {
    type: 'put',
    item_id: id(tenant, 'item', 'seed_01'),
    container_id: id(tenant, 'item', 'croft_plot'),
  };
  assert.equal(refused(tenant, sowing), 'permission_denied');
  const s = act(walk(sowable(28800), 'north', 'up'), sowing).world;
  const t = s.state.clock;
  assert.equal(statusOn(s, 'croft_plot', 'growing_croft'), true);
  const at = (d: number) => {
    const x = wait(s, t + d).world;
    return wait(
      play(x, {
        type: 'perform',
        action: 'water_croft',
        target_id: id(x, 'item', 'croft_plot'),
        item_id: id(x, 'item', 'watering_can'),
      }).world,
      t + DAY,
    ).world;
  };
  const ripe = at(43201);
  const [turnip] = crop(ripe);
  assert.match(turnip!, /^turnip_0[123]$/);
  assert.equal(where(take(ripe, turnip!), id(ripe, 'item', turnip!)), ripe.body);
  const late = at(43200);
  assert.deepEqual(crop(late), []);
  assert.equal(statusOn(late, 'croft_plot', 'withered'), true);
  // The lane plot stays untouched by the croft sow.
  for (const x of [ripe, late]) {
    assert.equal(statusOn(x, 'plot', 'withered'), false);
    assert.equal(where(x, id(x, 'item', 'turnip_01')) === plot(x), false);
  }
});

// Breaks: the croft site's prices (exact 5 to raise, 2 to raze), the croft cot reaction off its
// item_present, fish_croft not taking the second rod, or the croft hearth off Cooking 1.
test('homestead sandbox: the croft site, cot, pool and hearth', () => {
  let c = walk(fresh(WORLD), 'north', 'west', 'up');
  assert.deepEqual(play(take(c, 'cot_2'), { type: 'rest' }).lines, []);
  assert.deepEqual(play(c, { type: 'rest' }).lines, ['narration.well_rested.applied']);
  const fishing = (x: World) => ({
    type: 'perform',
    action: 'fish_croft',
    target_id: detail(x, 'croft_pool'),
  });
  assert.equal(refused(c, fishing(c)), 'invalid_state');
  const rod = { ...take(c, 'rod_2'), state: { ...take(c, 'rod_2').state, rng: PASS } } as World;
  assert.equal(act(rod, fishing(rod)).decision.kind, 'accepted');
  // The carpenter takes the croft commission in the shop.
  let shop = walk(fresh(WORLD), 'north', 'west', 'west');
  shop = play(shop, hire(shop, 'raise_croft_hut', 5)).world;
  assert.equal(pennies(shop), 5);
  assert.equal(built(shop).length, 1);
  const hut = built(shop)[0];
  shop = play(shop, hire(shop, 'raze_croft_hut', 2)).world;
  assert.equal(pennies(shop), 3);
  assert.deepEqual(shop.state.built, { [hut!]: { razed_at: shop.state.clock } });
  assert.deepEqual(offer(c, 'cook_stew_croft').reason, { code: 'invalid_state' });
  const taught = choose(talk(walk(c, 'down', 'south', 'south'), 'cook').world, 'cooking').world;
  const cook = walk(taught, 'north', 'north', 'up');
  assert.deepEqual(offer(cook, 'cook_stew_croft').reason, reason('craft.cook_stew_croft.needs'));
});

// Breaks: the nest's put lock dropped or keyed to a fact other than owns_pen.
test('homestead sandbox: only the pen owner puts into the nest', () => {
  const stick = (x: World) => take(walk(x, 'north', 'up'), 'stick_03');
  const tenant = stick(yard());
  const denied = put(tenant, 'stick_03', 'nest').decision as { error?: { code: string } };
  assert.equal(denied.error?.code, 'permission_denied');
  const owner = put(stick(play(yard(), farmer(yard(), 'buy_pen', 3)).world), 'stick_03', 'nest');
  assert.equal(owner.decision.kind, 'accepted', JSON.stringify(owner.decision));
  const o = owner.world;
  assert.equal(where(o, id(o, 'item', 'stick_03')), id(o, 'item', 'nest'));
});
