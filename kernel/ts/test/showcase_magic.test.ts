// The magic district (docs/showcase/magic-district.md steps 1-9; Beads loka-y6yg.35): the Loft's
// spells cost ma and ash, lux lights the held lantern, the reading room hushes the voice for
// 120 s, the grimoire teaches flamma and resolves the hedge-wizard's errand, whose 30 experience
// and one cha point unlock ward; the oiled winch opens the crypt, flamma burns the wight and the
// bier, the bucket quenches it, and the golem yard chains wet, shocked, stunned and warm. Steps
// 1-8 share one world, in order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, newWorld } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { fuelView } from '../src/mechanics/light/shared.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import {
  act,
  attribute,
  choose,
  content,
  detail,
  fact,
  go,
  id,
  labels,
  npc,
  perform,
  play,
  pool,
  ref,
  refused,
  take,
  talk,
  wait,
} from './showcase_fixture.ts';

const CTX = '5ca5e000-0000-4000-8000-00000000a61c';
const C = { cartridge_id: 'toolbox_showcase', cartridge_version: '0.0.1' };
const view = (w: World) => {
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  return v;
};
const words = (w: World) => view(w).spell_words;
const chip = (w: World, key: string) => view(w).actions.find((a) => a.action_key === key);
const pools = (w: World) =>
  Object.fromEntries(
    (view(w).resources ?? [])
      .filter((r) => ['ma', 'ash'].includes(r.resource.key))
      .map((r) => [r.resource.key, r.current]),
  );
const cast = (w: World, word: string) => play(w, { type: 'cast', word });
const lit = (w: World) => fuelView(w, id(w, 'item', 'lantern'))?.lit;
const raise = (w: World, key: string) =>
  play(w, { type: 'raise_attribute', attribute: { ...C, kind: 'attribute', key } }).world;

/** Up the ladder, lux taught and the errand accepted. */
function taught(c: Cartridge = content) {
  let w = go(newWorld(c, CTX as never, [1, 2, 3, 4]), 'up').world;
  w = choose(talk(w, 'hedge_wizard').world, 'teach').world;
  w = choose(talk(w, 'hedge_wizard').world, 'accept').world;
  return w;
}
/** Through the reading room: the grimoire read after the hush, back in the loft. */
function read(w: World) {
  w = go(w, 'north').world;
  w = wait(w, w.state.clock + 120).world;
  w = take(w, 'grimoire');
  w = play(w, { type: 'read', target_id: id(w, 'item', 'grimoire') }).world;
  return go(w, 'south').world;
}

let w: World;

// Breaks: the hub has no ladder up, the sign is not readable in the loft, or an unlearned spell
// leaks into spell_words.
test('magic 1: up the ladder; the sign reads and the Word bar is empty', () => {
  w = go(newWorld(content, CTX as never, [1, 2, 3, 4]), 'up').world;
  const sign = play(w, { type: 'read', target_id: detail(w, 'sign_magic') });
  assert.deepEqual(sign.lines, ['readable.sign_magic']);
  assert.equal(words(w), undefined);
});

// Breaks: the wizard opens the errand before teaching lux, the errand is not accepted, lux casts
// without ash or spends the wrong pools, the gather adds no ash, the cast leaves the held lantern
// unlit or writes an ignite line, a cast without the lantern is refused or keeps its pools, or
// the climb back to the loft closes the errand before flamma is known.
test('magic 2: taught lux; it needs ash; the cast spends 2 ma and 1 ash and lights the lantern', () => {
  const first = talk(w, 'hedge_wizard');
  assert.equal(first.opened, 'wizard_lux');
  w = choose(first.world, 'teach').world;
  assert.equal(fact(w, 'lux_known'), true);
  const second = talk(w, 'hedge_wizard');
  assert.equal(second.opened, 'wizard_errand');
  w = choose(second.world, 'accept').world;
  assert.equal(view(w).journal[0]?.state, 'active');
  assert.deepEqual(words(w), [
    { word: 'lux', available: false, reason: { code: 'insufficient_resource' } },
  ]);
  assert.equal(refused(w, { type: 'cast', word: 'lux' }), 'insufficient_resource');
  w = perform(w, 'gather_ash').world;
  assert.deepEqual(pools(w), { ma: 5, ash: 1 });
  const bare = cast(w, 'lux');
  assert.deepEqual(pools(bare.world), { ma: 3, ash: 0 });
  assert.equal(lit(bare.world), false);
  w = take(w, 'lantern');
  const r = cast(w, 'lux');
  assert.deepEqual(r.lines, ['narration.lux']);
  w = r.world;
  assert.deepEqual(pools(w), { ma: 3, ash: 0 });
  assert.equal(lit(w), true);
  w = go(go(w, 'down').world, 'up').world; // the loft climb closes only a met errand
  assert.equal(view(w).journal[0]?.state, 'active');
});

// Breaks: the hush is not applied on entry or ends early or late, it leaves the cast, the say or
// the shout open, the grimoire does not teach flamma, the level-up line is missing or doubled, or
// the errand does not resolve in the read itself.
test('magic 3: the reading room hushes for 120 s; the grimoire teaches flamma and ends the errand', () => {
  w = go(perform(w, 'gather_ash').world, 'north').world; // ash in hand: the hush, not the cost, refuses
  const entered = w.state.clock;
  assert.ok(labels(w).includes('condition.hushed'));
  assert.equal(refused(w, { type: 'cast', word: 'lux' }), 'invalid_state');
  assert.equal(refused(w, { type: 'say', word: 'hello' }), 'invalid_state');
  assert.equal(refused(w, { type: 'shout', word: 'hello' }), 'invalid_state');
  assert.equal(words(w)?.[0]?.available, false);
  assert.equal(chip(w, 'say'), undefined); // a blocked verb offers no chip
  const still = wait(w, entered + 119).world;
  assert.equal(refused(still, { type: 'cast', word: 'lux' }), 'invalid_state');
  w = wait(still, entered + 120).world;
  assert.ok(!labels(w).includes('condition.hushed'));
  assert.equal(words(w)?.[0]?.available, true);
  assert.equal(chip(w, 'say')?.available, true);
  w = take(w, 'grimoire'); // a readable item reads in hand
  const r = act(w, { type: 'read', target_id: id(w, 'item', 'grimoire') });
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  // Listed after the read; refused until the wight is in the room (its policy is npc_present).
  assert.deepEqual(
    words(w)?.find((s) => s.word === 'flamma'),
    {
      word: 'flamma',
      available: false,
      reason: { code: 'invalid_state' },
    },
  );
  assert.equal(r.lines.filter((l) => l === 'levelling.level_up').length, 1);
  assert.equal(fact(w, 'flamma_known'), true);
  assert.equal(view(w).journal[0]?.state, 'resolved');
});

// Breaks: the errand pays no ward_taught or experience, or ward's policy passes at cha 6 or fails at cha 7 (the cha boundary).
test('magic 4: level 2 from the errand; ward needs cha 7, one raise', () => {
  w = go(w, 'south').world;
  assert.equal(fact(w, 'ward_taught'), true);
  assert.deepEqual(view(w).levelling, { level: 2, experience: 30, next: 100, unspent: 1 });
  const ward = {
    word: 'ward',
    available: false,
    reason: { code: 'invalid_state', message: { key: 'reason.ward' } },
  };
  assert.deepEqual(
    words(w)?.find((s) => s.word === 'ward'),
    ward,
  );
  w = raise(w, 'cha');
  assert.equal(attribute(w, 'cha'), 7);
  assert.deepEqual(
    words(w)?.find((s) => s.word === 'ward'),
    { word: 'ward', available: true },
  );
});

// Breaks: ward's level floor passes at level 1 (29 experience, cha 7 from the start) or fails at
// level 2 (30): the level boundary of the same policy.
test('magic 4b: ward needs level 2 at the exact threshold', () => {
  const at = (grant: number) => {
    const c = structuredClone(content) as any;
    c.attributes[ref('attribute', 'cha')].start = 7;
    c.reactions[ref('reaction', 'errand_reward')].apply.find(
      (s: any) => s.op === 'experience.grant',
    ).amount = grant;
    const v = read(taught(c));
    return words(v)?.find((s) => s.word === 'ward')?.available;
  };
  assert.deepEqual([at(29), at(30)], [false, true]);
});

// Breaks: the grimoire read before the errand is accepted leaves the errand open for good (its
// fact_changed has already fired), so ward is never taught; or the loft entry resolves it
// before it is accepted.
test('magic 4c: the grimoire read first; the errand resolves on the next climb to the loft', () => {
  let v = go(newWorld(content, CTX as never, [1, 2, 3, 4]), 'up').world;
  v = read(choose(talk(v, 'hedge_wizard').world, 'teach').world);
  v = choose(talk(v, 'hedge_wizard').world, 'accept').world;
  assert.equal(view(v).journal[0]?.state, 'active');
  v = go(go(v, 'down').world, 'up').world; // the wizard hears of it when you come back up
  assert.equal(view(v).journal[0]?.state, 'resolved');
  assert.equal(fact(v, 'ward_taught'), true);
});

// Breaks: ward does not apply warded or spend its ma, or a second cast re-announces the status.
test('magic 5: ward applies warded and costs 1 ma; a second cast only refreshes it', () => {
  const r = act(w, { type: 'cast', word: 'ward' });
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  assert.ok(r.lines.includes('narration.warded.applied'));
  assert.ok(labels(w).includes('condition.warded'));
  assert.equal(pools(w).ma, 2);
  const types = (x: typeof r) =>
    x.decision.kind === 'accepted' ? x.decision.events.map((e) => e.payload.type) : [];
  // shock_on_wet and warmth_dries listen on status_applied, so the landing is recorded.
  assert.deepEqual(types(r), ['status_applied', 'action_completed']);
  const again = act(w, { type: 'cast', word: 'ward' });
  assert.deepEqual(types(again), ['action_completed']);
  assert.ok(!again.lines.includes('narration.warded.applied'));
});

const hp = (w: World, k: string) => level(w, npc(w, k), resourceRef(w, 'hp'));
const statuses = (w: World, k: string) =>
  activeStatuses(w, npc(w, k))
    .map((s) => s.status.key)
    .sort();
const types = (r: ReturnType<typeof act>) =>
  r.decision.kind === 'accepted' ? r.decision.events.map((e) => e.payload.type) : [];
const drop = (w: World, k: string) => play(w, { type: 'drop', item_id: id(w, 'item', k) }).world;
const use = (w: World, action: string, target: string, tool: string) =>
  act(w, {
    type: 'perform',
    action,
    target_id: id(w, 'item', target),
    item_id: id(w, 'item', tool),
  });
const cues = (w: World) => view(go(w, 'up').world).cues;
const SMOKE = [{ sense: 'smell', text: 'cue.smoke', direction: 'down' }];

// Breaks: the gate opens unoiled, the use pair is not offered or takes the wrong tool or target,
// the oiling spends the oil, Open fails on the oiled gate, the lit crypt hides the wight, or the
// unlit crypt reads lit (lists the wight, misses dark_description).
test('magic 6: the oiled winch opens the crypt; the lantern shows the wight', () => {
  w = go(take(take(w, 'oilcan'), 'loft_bucket'), 'east').world;
  assert.equal(refused(w, { type: 'move', direction: 'down' }), 'exit_closed');
  const card = view(w)
    .inventory?.flatMap((e) => e.actions ?? [])
    .find((a) => a.action_key === 'oil_winch');
  assert.deepEqual(
    [card?.label, card?.target_ids, card?.available],
    ['actions.oil_winch', [id(w, 'item', 'gate_winch'), id(w, 'item', 'oilcan')], true],
  );
  assert.equal(use(w, 'oil_winch', 'gate_winch', 'loft_bucket').decision.kind, 'rejected');
  const oil = w.state.liquids[id(w, 'item', 'oilcan')];
  const r = use(w, 'oil_winch', 'gate_winch', 'oilcan');
  assert.deepEqual(r.lines, ['narration.oil_winch']);
  w = r.world;
  assert.equal(fact(w, 'gate_oiled'), true);
  assert.deepEqual(w.state.liquids[id(w, 'item', 'oilcan')], oil);
  w = play(w, { type: 'open', direction: 'down' }).world;
  const dark = go(
    play(w, { type: 'douse', item_id: id(w, 'item', 'lantern') }).world,
    'down',
  ).world;
  assert.equal(view(dark).place.description.key, 'room.crypt.dark');
  assert.deepEqual(view(dark).entities ?? [], []);
  w = go(w, 'down').world;
  assert.deepEqual(
    view(w)
      .entities?.map((e) => e.id)
      .sort(),
    [id(w, 'item', 'bier'), npc(w, 'wight')].sort(),
  );
  assert.equal(use(w, 'oil_winch', 'bier', 'oilcan').decision.kind, 'rejected');
});

// Breaks: flamma ignores the wight's fire resistance or its own damage, opens no fight, leaves the
// bier unburnt or the stair without smoke, ward does not halve the physical blow, Flee goes
// elsewhere, the returning wight re-engages, the kill credits no one or the wrong body, or a
// third bolt casts on the corpse.
test('magic 7: flamma burns the wight to 4 and the bier; warded blow 1; the second bolt kills', () => {
  const r = act(w, { type: 'cast', word: 'flamma' });
  assert.deepEqual(r.lines, ['narration.flamma']);
  assert.deepEqual(types(r), ['action_completed', 'status_applied']);
  w = r.world;
  assert.equal(hp(w, 'wight'), 4);
  assert.ok(view(w).combat);
  assert.deepEqual(
    activeStatuses(w, id(w, 'item', 'bier')).map((s) => s.status.key),
    ['burning'],
  );
  const before = pool(w, 'hp');
  w = wait(w, w.state.clock + 150).world; // one round
  assert.equal(before - pool(w, 'hp'), 1);
  w = play(w, { type: 'flee' }).world;
  assert.equal(view(w).place.title.key, 'room.crypt_stair.title');
  assert.deepEqual(view(w).cues, SMOKE);
  w = go(w, 'down').world;
  assert.equal(view(w).combat, undefined);
  const kill = act(w, { type: 'cast', word: 'flamma' });
  w = kill.world;
  const died =
    kill.decision.kind === 'accepted'
      ? kill.decision.events.find((e) => e.payload.type === 'entity_died')?.payload
      : undefined;
  assert.equal((died as { killer_id?: string } | undefined)?.killer_id, w.body);
  assert.equal(hp(w, 'wight'), 0);
  assert.deepEqual(view(w).levelling, { level: 2, experience: 40, next: 100, unspent: 0 });
  assert.equal(pools(w).ma, 0);
  assert.equal(refused(w, { type: 'cast', word: 'flamma' }), 'invalid_state');
});

// Breaks: quench is not offered for the burning bier, leaves it burning or the smoke cue on,
// spends the water, or quenches an unburning bier.
test('magic 8: the loft bucket quenches the bier; water unchanged; the smoke clears', () => {
  const card = view(w)
    .inventory?.flatMap((e) => e.actions ?? [])
    .find((a) => a.action_key === 'quench');
  assert.deepEqual(
    [card?.label, card?.target_ids],
    ['actions.quench', [id(w, 'item', 'bier'), id(w, 'item', 'loft_bucket')]],
  );
  assert.equal(use(w, 'quench', 'bier', 'oilcan').decision.kind, 'rejected'); // water only
  const water = w.state.liquids[id(w, 'item', 'loft_bucket')];
  const r = use(w, 'quench', 'bier', 'loft_bucket');
  assert.deepEqual(r.lines, ['narration.quench']);
  w = r.world;
  assert.deepEqual(w.state.liquids[id(w, 'item', 'loft_bucket')], water);
  assert.deepEqual(
    activeStatuses(w, id(w, 'item', 'bier')).map((s) => s.status.key),
    ['spent'],
  );
  assert.equal(cues(w), undefined);
  assert.equal(use(w, 'quench', 'bier', 'loft_bucket').decision.kind, 'rejected');
});

// Breaks: the step-8 load plus the yard's three items is too heavy, shock_on_wet fires without wet (or not at all), the stun does not cure wet and shocked,
// the stun or shock tick at the wrong rate, or warmth does not dry the golem (so the jar stuns).
test('magic 9: the golem yard; wet then the jar stuns (hp 17); the jar alone shocks (19)', () => {
  let y = go(go(go(w, 'up').world, 'west').world, 'west').world; // all of step 8's load in hand
  for (const k of ['rain_bucket', 'spark_jar', 'yard_torch']) y = take(y, k);
  const wet = drop(y, 'rain_bucket');
  assert.deepEqual(statuses(wet, 'golem'), ['wet']);
  const stun = drop(wet, 'spark_jar');
  assert.deepEqual(statuses(stun, 'golem'), ['stunned']);
  assert.equal(hp(wait(stun, stun.state.clock + 60).world, 'golem'), 17);
  const shock = drop(y, 'spark_jar');
  assert.deepEqual(statuses(shock, 'golem'), ['shocked']);
  assert.equal(hp(wait(shock, shock.state.clock + 60).world, 'golem'), 19);
  const warm = drop(drop(y, 'rain_bucket'), 'yard_torch');
  assert.deepEqual(statuses(warm, 'golem'), ['warm']);
  assert.deepEqual(statuses(drop(warm, 'spark_jar'), 'golem'), ['shocked', 'warm']);
});

// Breaks: the attic loses its lit roof (lists no one), its own ash, its lantern's lux step, its
// golem chain, or its wight's Attack.
test('magic sandbox: the attic; every word and the fight without a light', () => {
  let a = perform(go(taught(), 'up').world, 'gather_attic_ash').world;
  assert.equal(pools(a).ash, 1);
  a = cast(take(a, 'attic_lantern'), 'lux').world;
  assert.equal(fuelView(a, id(a, 'item', 'attic_lantern'))?.lit, true);
  for (const k of ['attic_bucket', 'attic_jar', 'attic_torch']) a = take(a, k);
  assert.deepEqual(statuses(drop(a, 'attic_torch'), 'attic_golem'), ['warm']);
  a = drop(drop(a, 'attic_bucket'), 'attic_jar');
  assert.deepEqual(statuses(a, 'attic_golem'), ['stunned']);
  const hit = act(a, { type: 'attack', target_id: npc(a, 'attic_wight') });
  assert.equal(hit.decision.kind, 'accepted');
});
