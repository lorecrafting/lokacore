// The magic district (docs/showcase/magic-district.md steps 1-9; Beads loka-y6yg.35): the Loft's
// spells cost ma and ash, lux lights the held lantern, the reading room hushes the voice for
// 120 s, the grimoire teaches flamma and resolves the hedge-wizard's errand, whose 30 experience
// and one cha point unlock ward; the oiled winch opens the crypt, flamma burns the wight and the
// bier, the bucket quenches it, and the golem yard chains wet, shocked, stunned and warm. Steps
// 1-8 share one world, in order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, newWorld } from '../src/index.ts';
import { bodyOf, type Cartridge, type World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { fuelView } from '../src/mechanics/light/shared.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { activeStatuses, applyStatus, statusStep } from '../src/mechanics/status/shared.ts';
import { apply } from '../src/runtime/apply.ts';
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
  room,
  perform,
  play,
  pool,
  ref,
  refused,
  take,
  talk,
  wait,
} from './showcase_fixture.ts';
import { ctx } from './harness.ts';

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
const cast = (w: World, word: string, target_id: string) =>
  play(w, { type: 'cast', word, target_id });
const lit = (w: World) => fuelView(w, id(w, 'item', 'lantern'))?.lit;
/** An aimed spell's offer on its target's entry (loka-x6t.109). */
const offer = (w: World, target: string, key: string) =>
  [...view(w).entities, ...view(w).inventory]
    .find((e) => e.id === target)
    ?.actions.find((a) => a.action_key === key);
const raise = (w: World, key: string) =>
  play(w, { type: 'raise_attribute', attribute: { ...C, kind: 'attribute', key } }).world;

/** Up the ladder, lux taught and the errand accepted. */
function taught(c: Cartridge = content) {
  let w = go(newWorld(c, ctx(CTX), [1, 2, 3, 4]), 'up').world;
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
  w = go(newWorld(content, ctx(CTX), [1, 2, 3, 4]), 'up').world;
  const sign = play(w, { type: 'read', target_id: detail(w, 'sign_magic') });
  assert.deepEqual(sign.lines, ['readable.sign_magic']);
  assert.equal(words(w), undefined);
});

// Breaks: the wizard opens the errand before teaching lux, the errand is not accepted, lux casts
// without ash or spends the wrong pools, the gather adds no ash, the cast leaves the held lantern
// unlit or writes no lit line, an untargeted lux casts, the climb back to the loft closes the errand before flamma is known, or the
// errand dialogue (its accept refused) still opens while the errand is active, or the accept
// reopens the errand's page with "Fetch the second word: not now" (M10c).
test('magic 2: taught lux; it needs ash; the cast spends 2 ma and 1 ash and lights the lantern', () => {
  const first = talk(w, 'hedge_wizard');
  assert.equal(first.opened, 'wizard_lux');
  w = choose(first.world, 'teach').world;
  assert.equal(fact(w, 'lux_known'), true);
  const second = talk(w, 'hedge_wizard');
  assert.equal(second.opened, 'wizard_errand');
  w = choose(second.world, 'accept').world;
  assert.equal(view(w).journal[0]?.state, 'active');
  // the accept is the offer's one answer: the conversation ends, no hub reopens on a refused accept
  assert.equal(pending(w, w.character), undefined);
  assert.equal(talk(w, 'hedge_wizard').opened, 'wizard_awaiting');
  w = take(w, 'lantern');
  const lantern = id(w, 'item', 'lantern');
  const short = offer(w, lantern, 'lux');
  assert.deepEqual(short?.available === false && short.reason, {
    code: 'insufficient_resource',
    message: { key: 'resource.short', bindings: { amount: 1, resource: 'ash' } },
  });
  assert.equal(
    refused(w, { type: 'cast', word: 'lux', target_id: lantern }),
    'insufficient_resource',
  );
  w = perform(w, 'gather_ash').world;
  assert.deepEqual(pools(w), { ma: 5, ash: 1 });
  assert.equal(offer(w, lantern, 'lux')?.available, true);
  assert.equal(refused(w, { type: 'cast', word: 'lux' }), 'invalid_target'); // aimed: a target is required
  const r = cast(w, 'lux', lantern);
  assert.deepEqual(r.lines, ['narration.lux', 'light.lantern_ignited']); // loka-y6yg.44 (M2b)
  w = r.world;
  assert.deepEqual(pools(w), { ma: 3, ash: 0 });
  assert.equal(lit(w), true);
  w = go(go(w, 'down').world, 'up').world; // the loft climb closes only a met errand
  assert.equal(view(w).journal[0]?.state, 'active');
});

// Breaks: the hush is not applied on entry or ends early or late, it leaves the cast, the say or
// the shout open, the grimoire does not teach flamma, an aimed spell is listed in spell_words, the
// level-up or handover line is missing or doubled (M6), or the errand does not resolve in the read.
test('magic 3: the reading room hushes for 120 s; the grimoire teaches flamma and ends the errand', () => {
  w = go(perform(w, 'gather_ash').world, 'north').world; // ash in hand: the hush, not the cost, refuses
  const entered = w.state.clock;
  assert.ok(labels(w).includes('condition.hushed'));
  const lux = { type: 'cast', word: 'lux', target_id: id(w, 'item', 'lantern') } as const;
  assert.equal(refused(w, lux), 'invalid_state');
  assert.equal(refused(w, { type: 'say', word: 'hello' }), 'invalid_state');
  assert.equal(refused(w, { type: 'shout', word: 'hello' }), 'invalid_state');
  assert.equal(offer(w, lux.target_id, 'lux'), undefined); // a blocked verb offers no chip or card
  assert.equal(chip(w, 'say'), undefined);
  const still = wait(w, entered + 119).world;
  assert.equal(refused(still, lux), 'invalid_state');
  w = wait(still, entered + 120).world;
  assert.ok(!labels(w).includes('condition.hushed'));
  assert.equal(offer(w, lux.target_id, 'lux')?.available, true);
  assert.equal(chip(w, 'say')?.available, true);
  w = take(w, 'grimoire'); // a readable item reads in hand
  const r = act(w, { type: 'read', target_id: id(w, 'item', 'grimoire') });
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  // aimed spells are offered on their targets, never as words
  assert.deepEqual(
    (words(w) ?? []).filter((s) => ['flamma', 'lux'].includes(s.word)),
    [],
  );
  for (const line of ['levelling.level_up', 'narration.errand_reward'])
    assert.equal(r.lines.filter((l) => l === line).length, 1, line);
  assert.equal(fact(w, 'flamma_known'), true);
  assert.equal(view(w).journal[0]?.state, 'resolved');
});

// Breaks: the errand pays no ward_taught or experience, or ward's policy passes at cha 6 or fails at cha 7 (the cha boundary).
test('magic 4: level 2 from the errand; ward needs cha 7, one raise', () => {
  w = go(w, 'south').world;
  assert.equal(offer(w, npc(w, 'hedge_wizard'), 'flamma'), undefined); // flamma's policy is npc_present wight
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

// Breaks: the grimoire read before the errand is accepted leaves the wizard asking for a word the
// Journal says is read (the waiting line has no flamma_known gate), or the report choice does not
// resolve the errand.
test('magic 4c: the grimoire read first; the wizard takes the word and the errand resolves', () => {
  let v = go(newWorld(content, ctx(CTX), [1, 2, 3, 4]), 'up').world;
  v = read(choose(talk(v, 'hedge_wizard').world, 'teach').world);
  v = choose(talk(v, 'hedge_wizard').world, 'accept').world;
  assert.equal(view(v).journal[0]?.state, 'active');
  assert.equal(pending(v, v.character), undefined); // the accept ended the conversation (M10c)
  const again = talk(v, 'hedge_wizard');
  assert.equal(again.opened, 'wizard_awaiting_report'); // not the waiting line
  const done = choose(again.world, 'done');
  assert.ok(done.lines.includes('narration.errand_reward'));
  assert.equal(view(done.world).journal[0]?.state, 'resolved');
  assert.equal(fact(done.world, 'ward_taught'), true);
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
const bier = (w: World) => activeStatuses(w, id(w, 'item', 'bier')).map((s) => s.status.key);
const types = (r: ReturnType<typeof act>) =>
  r.decision.kind === 'accepted' ? r.decision.events.map((e) => e.payload.type) : [];
const status = (key: string) =>
  ({ cartridge_id: 'toolbox_showcase', cartridge_version: '0.0.1', kind: 'status', key }) as never;
const body = (w: World) => bodyOf(w, w.character)!;
const drop = (w: World, k: string) => play(w, { type: 'drop', item_id: id(w, 'item', k) }).world;
const why = (r: { decision: unknown }) => (r.decision as { error?: { code: string } }).error?.code;
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
// the oiling spends the oil, oil on another metal thing opens the gate (M8a), Open fails on the oiled gate,
// the lit crypt hides the wight, or the unlit crypt reads lit (lists the wight, misses
// dark_description).
test('magic 6: the oiled winch opens the crypt; the lantern shows the wight', () => {
  w = take(take(w, 'oilcan'), 'loft_bucket');
  assert.equal(offer(w, id(w, 'item', 'loft_bucket'), 'lux'), undefined); // lux needs a lamp
  w = go(w, 'east').world;
  assert.equal(refused(w, { type: 'move', direction: 'down' }), 'exit_closed');
  assert.equal(refused(w, { type: 'open', direction: 'down' }), 'invalid_state');
  const card = view(w)
    .inventory?.flatMap((e) => e.actions ?? [])
    .find((a) => a.action_key === 'oil_winch');
  assert.deepEqual(
    [card?.label, card?.target_ids, card?.available],
    ['actions.oil_winch', [id(w, 'item', 'gate_winch'), id(w, 'item', 'oilcan')], true],
  );
  assert.equal(why(use(w, 'oil_winch', 'gate_winch', 'loft_bucket')), 'invalid_target');
  const lamp = use(w, 'oil_winch', 'lantern', 'oilcan').world; // metal, so it oils, but only the winch's row opens the gate
  assert.equal(refused(lamp, { type: 'open', direction: 'down' }), 'invalid_state');
  const oil = w.state.liquids?.[id(w, 'item', 'oilcan')];
  const r = use(w, 'oil_winch', 'gate_winch', 'oilcan');
  assert.deepEqual(r.lines, ['narration.oil_winch']);
  w = r.world;
  assert.equal(fact(w, 'gate_oiled', id(w, 'item', 'gate_winch')), true);
  assert.deepEqual(w.state.liquids?.[id(w, 'item', 'oilcan')], oil);
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
  assert.equal(why(use(w, 'oil_winch', 'bier', 'oilcan')), 'invalid_state');
});

// Breaks: flamma ignores the wight's fire resistance or its own damage, opens no fight, leaves the
// bier unburnt or the stair without smoke, ward does not halve the physical blow, Flee goes
// elsewhere, the returning wight re-engages, the kill credits no one or the wrong body or writes no
// kill line, a third bolt casts on the corpse, or a wight hidden in the dark can be aimed at.
test('magic 7: flamma burns the wight to 4 and the bier; warded blow 1; the second bolt kills', () => {
  const lantern = { type: 'douse', item_id: id(w, 'item', 'lantern') };
  const flamma = { type: 'cast', word: 'flamma', target_id: npc(w, 'wight') } as const;
  assert.equal(refused(play(w, lantern).world, flamma), 'not_present'); // no aim at a wight in the dark
  const r = act(w, flamma);
  assert.deepEqual(r.lines, ['narration.flamma', 'narration.burning.observed']); // the seen bier
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
  assert.equal(pool(w, 'hp'), Number(before) - 1);
  w = play(w, { type: 'flee' }).world;
  assert.equal(view(w).place.title.key, 'room.crypt_stair.title');
  assert.deepEqual(view(w).cues, SMOKE);
  w = go(w, 'down').world;
  assert.equal(view(w).combat, undefined);
  const kill = act(w, flamma);
  assert.deepEqual(kill.lines, ['narration.flamma', 'combat.npc_died']); // one kill line (M3)
  w = kill.world;
  const died =
    kill.decision.kind === 'accepted'
      ? kill.decision.events.find((e) => e.payload.type === 'entity_died')?.payload
      : undefined;
  assert.equal((died as { killer_id?: string } | undefined)?.killer_id, w.body);
  assert.equal(hp(w, 'wight'), 0);
  assert.deepEqual(view(w).levelling, { level: 2, experience: 40, next: 100, unspent: 0 });
  assert.equal(pools(w).ma, 0);
  assert.equal(refused(w, flamma), 'invalid_target'); // a dead wight is no aimed target (loka-x6t.109.2)
});

// Breaks (loka-y6yg.48): the bier going out is not told in the lit crypt, told twice, or told to a
// player who left or doused the lantern; Douse still works once the burn has ended.
test('magic 7b: the bier going out is told only while seen; then Douse is refused', () => {
  const out = (v: World) => {
    const r = wait(v, v.state.clock + 180);
    return { world: r.world, lines: r.lines.filter((k) => k.startsWith('narration.burning')) };
  };
  const ended = out(w);
  assert.deepEqual(ended.lines, ['narration.burning.expired']);
  assert.ok(!bier(ended.world).includes('burning'));
  assert.equal(why(use(ended.world, 'quench', 'bier', 'loft_bucket')), 'invalid_state');
  assert.deepEqual(out(go(w, 'up').world).lines, []);
  const c = structuredClone(w.cartridge) as any;
  delete c.statuses[ref('status', 'burning')].narration.observed; // the opt-in gates the expiry too
  assert.deepEqual(out({ ...w, cartridge: c }).lines, []);
  const dark = play(w, { type: 'douse', item_id: id(w, 'item', 'lantern') }).world;
  assert.deepEqual(out(dark).lines, []);
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
  assert.equal(why(use(w, 'quench', 'bier', 'oilcan')), 'invalid_target'); // water only
  const water = w.state.liquids?.[id(w, 'item', 'loft_bucket')];
  const r = use(w, 'quench', 'bier', 'loft_bucket');
  assert.deepEqual(r.lines, ['narration.quench']);
  w = r.world;
  assert.deepEqual(w.state.liquids?.[id(w, 'item', 'loft_bucket')], water);
  assert.deepEqual(
    activeStatuses(w, id(w, 'item', 'bier')).map((s) => s.status.key),
    ['spent'],
  );
  assert.equal(cues(w), undefined);
  assert.equal(why(use(w, 'quench', 'bier', 'loft_bucket')), 'invalid_state');
});

// Breaks: the step-8 load plus the yard's three items is too heavy, shock_on_wet fires without wet (or not at all), the stun does not cure wet and shocked,
// the stun or shock tick at the wrong rate, or warmth does not dry the golem (so the jar stuns),
// or (loka-kgd.176) a status landing on the seen golem tells no observed line.
test('magic 9: the golem yard; wet then the jar stuns (hp 17); the jar alone shocks (19)', () => {
  let y = go(go(go(w, 'up').world, 'west').world, 'west').world; // all of step 8's load in hand
  for (const k of ['rain_bucket', 'spark_jar', 'yard_torch']) y = take(y, k);
  const told = (w: World, k: string) => act(w, { type: 'drop', item_id: id(w, 'item', k) }).lines;
  // The drop's own line, then each status applied on the golem.
  const lines = (...s: string[]) => ['item.dropped', ...s.map((x) => `narration.${x}.applied`)];
  assert.deepEqual(told(y, 'rain_bucket'), lines('wet'));
  assert.deepEqual(told(drop(y, 'rain_bucket'), 'spark_jar'), lines('shocked', 'stunned'));
  assert.deepEqual(told(drop(y, 'rain_bucket'), 'yard_torch'), lines('warm'));
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

// Breaks (loka-kgd.176): an observed line told for a golem out of the room, a hidden golem, an
// item or golem whose status has no observed line (falling back to applied), or none for a seen
// item (loka-y6yg.48); the player's own line lost;
// a spell (not only a reaction) skips the seen check.
test('magic 9b: only a seen golem or item in the room gets an observed line', () => {
  let y = go(go(go(w, 'up').world, 'west').world, 'west').world;
  y = take(y, 'rain_bucket');
  const golem = npc(y, 'golem');
  const off = {
    ...y,
    state: { ...y.state, containers: { ...y.state.containers, [golem]: room(y, 'loft') } },
  };
  const hidden = (
    apply(
      y,
      applyStatus(y, golem, status('hidden'), 0, () => 'x'),
      false,
    ) as { world: World }
  ).world;
  for (const v of [off, hidden]) {
    const r = act(v, { type: 'drop', item_id: id(v, 'item', 'rain_bucket') });
    assert.deepEqual(statuses(r.world, 'golem'), v === hidden ? ['hidden', 'wet'] : ['wet']);
    assert.deepEqual(r.lines, ['item.dropped']); // the player's own line only
  }
  const said = (holder: string | string[], s: string) =>
    statusStep(
      y,
      { op: 'status.apply', status: status(s) },
      [holder].flat() as never[],
      body(y),
      0,
      { holders: new Map(), applied: new Set() },
      () => 'x',
      () => {},
      () => true,
    ).narration;
  assert.deepEqual(said(golem, 'wet'), [{ key: 'narration.wet.applied' }]);
  assert.deepEqual(said(golem, 'chilled'), []);
  // loka-y6yg.48: a seen item in the room tells it once for a pile; not a carried or absent one.
  const fire = [{ key: 'narration.burning.observed' }];
  assert.deepEqual(
    said([id(y, 'item', 'yard_torch'), id(y, 'item', 'spark_jar')], 'burning'),
    fire,
  );
  assert.deepEqual(said(id(y, 'item', 'rain_bucket'), 'burning'), []);
  assert.deepEqual(said(id(y, 'item', 'bier'), 'burning'), []);
  assert.deepEqual(said(id(y, 'item', 'yard_torch'), 'chilled'), []);
  const soaked = drop(y, 'rain_bucket'); // a seen golem's expiry stays silent
  assert.deepEqual(statuses(soaked, 'golem'), ['wet']);
  assert.deepEqual(
    wait(soaked, soaked.state.clock + 600).lines.filter((k) => k.includes('wet')),
    [],
  );
  assert.deepEqual(said(body(y), 'chilled'), [{ key: 'narration.chilled.applied' }]);
  // The spell route: ward retargeted at the golem tells its line only while the golem is seen.
  const warded = (v: World) => {
    const c = structuredClone(v.cartridge) as any;
    const ward = c.recipes[ref('recipe', 'ward')];
    ward.costs = []; // the earlier casts spent the ma
    ward.outcomes.success.sequence = [
      { op: 'status.apply', status: status('wet'), npc: { ...C, kind: 'npc', key: 'golem' } },
    ];
    const r = act({ ...v, cartridge: c }, { type: 'cast', word: 'ward' });
    assert.ok(statuses(r.world, 'golem').includes('wet'));
    return r.lines.includes('narration.wet.applied');
  };
  assert.equal(warded(y), true);
  assert.equal(warded(hidden), false);
});

// Breaks: the attic loses its lit roof (lists no one), its own ash, its lantern's lux step, its
// golem chain (the torch warms, the jar alone shocks), or its wight's Attack.
test('magic sandbox: the attic; every word and the fight without a light', () => {
  let a = perform(go(taught(), 'up').world, 'gather_attic_ash').world;
  assert.equal(pools(a).ash, 1);
  a = take(a, 'attic_lantern');
  a = cast(a, 'lux', id(a, 'item', 'attic_lantern')).world;
  assert.equal(fuelView(a, id(a, 'item', 'attic_lantern'))?.lit, true);
  for (const k of ['attic_bucket', 'attic_jar', 'attic_torch']) a = take(a, k);
  assert.deepEqual(statuses(drop(a, 'attic_torch'), 'attic_golem'), ['warm']);
  assert.deepEqual(statuses(drop(a, 'attic_jar'), 'attic_golem'), ['shocked']);
  a = drop(drop(a, 'attic_bucket'), 'attic_jar');
  assert.deepEqual(statuses(a, 'attic_golem'), ['stunned']);
  const hit = act(a, { type: 'attack', target_id: npc(a, 'attic_wight') });
  assert.equal(hit.decision.kind, 'accepted');
});
