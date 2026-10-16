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
  detail,
  choose,
  fact,
  fresh,
  go,
  id,
  labels,
  npc,
  play,
  pool,
  ref,
  refused,
  reload,
  room,
  take,
  talk,
  wait,
  where,
} from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-0000000004a1';
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
// The lesson hub reopens after every answer, Leave included; close_choice ends the sitting.
const shut = (w: World) => play(w, { type: 'close_choice', continuation_id: cont(w) }).world;
const pennies = (w: World) => pool(w, 'pennies');
const walk = (w: World, ...ds: string[]) => ds.reduce((x, d) => go(x, d).world, w);
const built = (w: World) =>
  Object.keys(w.state.created ?? {}).filter((k) => w.state.created![k].origin.kind === 'built');
// Every GameView a step leaves must hold the protocol schema.
const valid = (w: World) => (assert.deepEqual(validate('GameView', gameView(w)), []), w);

let w: World;
const seen: string[] = []; // every GameView and decision before Carving is learned (hs-14)
const note = (r: { decision: unknown; world: World }) => {
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
    ['intimidate', 0, null],
    ['pick', 0, null],
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
    ['leave', true],
    ['whittling', true],
    ['woodcutting', true],
  ]);
  w = note(choose(w, 'whittling')).world;
  w = note(choose(w, 'woodcutting')).world;
  assert.deepEqual(choices(w)[0], ['carpentry', false]); // woodcutting 1, one under the gate
  const forged = note(act(w, { type: 'choose', choice_id: 'carving', continuation_id: cont(w) }));
  assert.equal(forged.decision.kind, 'rejected');
  assert.equal((forged.decision as { error: { code: string } }).error.code, 'invalid_state');
  w = shut(note(choose(w, 'leave')).world);
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
  }
  assert.equal(fact(w, 'uses_whittling'), 2);
  for (const k of ['stick_01', 'stick_02'])
    assert.equal(where(w, id(w, 'item', k)), room(w, 'midden'));
  for (const k of ['spoon_01', 'spoon_02']) assert.equal(where(w, id(w, 'item', k)), w.body);
  assert.deepEqual(offer(w, 'carve_spoon').reason, reason('craft.carve_spoon.needs'));
  assert.equal(refused(w, { type: 'perform', action: 'carve_spoon' }), 'invalid_state');
  // hs-14: the hidden joinery leaves no trace in any view or decision before Carving.
  assert.equal(seen.length, 20);
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
  assert.deepEqual(
    choices(w).find(([k]) => k === 'joinery'),
    ['joinery', true],
  );
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
  x = choose(choose(talk(x, 'carpenter').world, 'woodcutting').world, 'leave').world;
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
// rather than moved to the lane (finding 3), the plain hut not offered again, a hut admitted at
// 4 pennies, or a stranger's raze or one over a corpse admitted (refusal order: owner, then
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
