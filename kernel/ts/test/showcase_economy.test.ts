// size: allow 566, the Undercroft walk (steps 1 to 10) and its branches continue one world and share its helpers
// The showcase economy and law district walked step by step (docs/showcase/economy-law-district.md,
// guided loop steps 1 to 10). Each numbered test continues the world the one before it left; a
// branch starts from a saved step. Fresh world at 07:00 (25200), pennies 10.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { key } from '../src/foundation/compose.ts';
import { decode } from '../src/foundation/canonical.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import {
  detail,
  fact,
  fresh,
  go,
  HOUR,
  id,
  labels,
  npc,
  play,
  pool,
  refused,
  room,
  talk,
  choose,
  take,
  wait,
  where,
} from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-0000000005e1';
const R = (kind: string, k: string) => ({
  cartridge_id: 'toolbox_showcase',
  cartridge_version: '0.0.1',
  kind,
  key: k,
});
const use = (w: World, provider: string, service: string, quoted_price: number) => ({
  type: 'use_service',
  provider_id: npc(w, provider),
  service: R('service', service),
  quoted_price,
});
const trade = (w: World, type: string, item: string, quoted_price: number, who = 'chandler') => ({
  type,
  item_id: id(w, 'item', item),
  provider_id: npc(w, who),
  quoted_price,
});
const walk = (w: World, ...ds: string[]) => ds.reduce((x, d) => go(x, d).world, w);
const pennies = (w: World) => pool(w, 'pennies');
const purse = (w: World, who: string) => level(w, npc(w, who), resourceRef(w, 'pennies'));
const valid = (w: World) => (assert.deepEqual(validate('GameView', gameView(w)), []), w);
const offer = (w: World, action: string) => {
  let found: { available: boolean; reason?: object } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === action ? (found = v) : v));
  assert.ok(found, `${action} offered`);
  return found;
};
const reason = (k: string) => ({ code: 'invalid_state', message: { key: k } });
const exit = (w: World, direction: string) =>
  gameView(w).exits.find((e) => e.direction === direction)!;
const candles = (w: World, holder: string) =>
  [1, 2, 3, 4, 5].map((n) => `candle_0${n}`).filter((c) => where(w, id(w, 'item', c)) === holder);
const price = (w: World, who = 'chandler', item = 'candle_01') =>
  gameView(w)
    .entities.find((e) => e.id === npc(w, who))!
    .shop!.find((s) => s.item_id === id(w, 'item', item))!.buy!.price;
const ores = (w: World, holder: string) =>
  [1, 2, 3, 4].map((n) => `ore_0${n}`).filter((o) => where(w, id(w, 'item', o)) === holder);
const door = (w: World) =>
  w.state.barriers?.[key({ kind: 'barrier', barrier: R('barrier', 'strongroom_door') })];
// The world with fact `name` forged to `value` (owns_strongroom false: the chest's locks, checked
// from inside).
const forge = (w: World, name: string, value: boolean): World => ({
  ...w,
  state: {
    ...w.state,
    facts: Object.fromEntries(
      Object.entries(w.state.facts ?? {}).map(([k, v]) => [
        k,
        (decode(k) as { fact: { key: string } }).fact.key === name ? value : v,
      ]),
    ),
  },
});

// The event kinds of an accepted command.
const kinds = (r: ReturnType<typeof play>) =>
  r.decision.kind === 'accepted' ? r.decision.events.map((e) => e.payload.type) : [];
const lift = (w: World, item: string) => play(w, { type: 'take', item_id: id(w, 'item', item) });
// The world with one NPC's attributes forged to `value`.
const alert = (w: World, who: string, value: number): World => {
  const e = w.entities[npc(w, who)] as any;
  const attributes = e.attributes.map((a: object) => ({ ...a, value }));
  return { ...w, entities: { ...w.entities, [npc(w, who)]: { ...e, attributes } as never } };
};

let w: World;
let T: number; // the commission's clock (step 4)
let ordered: World; // step 4's end, the order pending
let five: World; // step 5's end, in the market: step 9 branches here
let H: number; // the hide's clock (step 6)
let six: World; // step 6's end, the purse held
let seven: World; // step 7's end: step 10 branches here

// Breaks: the hub's down exit, the signpost, the six exits, or the door not locked without a key.
test('economy 1: down, read the signpost, south is the locked door', () => {
  w = go(fresh(WORLD), 'down').world;
  assert.equal(pennies(w), 10);
  const r = play(w, { type: 'read', target_id: detail(w, 'sign_law') });
  assert.deepEqual(r.lines, ['readable.sign_law']);
  assert.deepEqual(
    gameView(w)
      .exits.map((e) => e.direction)
      .sort(),
    ['down', 'east', 'north', 'south', 'up', 'west'],
  );
  assert.equal(exit(w, 'south').door!.state, 'locked');
  assert.deepEqual(exit(w, 'south').door!.actions, []);
  assert.equal(refused(w, { type: 'move', direction: 'south' }), 'exit_locked');
  valid(w);
});

// Breaks: the deposit's amount or fee, the vault or clerk A not credited, the key's get lock, or
// the strongroom's price.
test('economy 2: deposit at clerk A; the key and the strongroom refused', () => {
  w = go(w, 'east').world;
  w = play(w, use(w, 'clerk_a', 'deposit_a', 1)).world;
  assert.equal(pennies(w), 4);
  assert.equal(fact(w, 'savings'), 5);
  assert.equal(purse(w, 'vault'), 25);
  assert.equal(purse(w, 'clerk_a'), 1);
  assert.equal(
    refused(w, { type: 'take', item_id: id(w, 'item', 'strongroom_key') }),
    'permission_denied',
  );
  assert.equal(refused(w, use(w, 'clerk_a', 'buy_strongroom', 5)), 'insufficient_resource');
  valid(w);
});

// Breaks: the withdraw's amount or fee, the second counter not sharing the account, an empty
// account paying out, the shelf price table (three held 2, two held 3), or a stale quote accepted.
test('economy 3: withdraw at clerk B twice; buy a candle; the stale quote refused', () => {
  w = walk(w, 'west', 'north'); // clerk B's counter in the market: the same account
  w = play(w, use(w, 'clerk_b', 'withdraw_b', 1)).world;
  assert.equal(pennies(w), 8);
  assert.equal(fact(w, 'savings'), 0);
  assert.equal(purse(w, 'vault'), 20);
  assert.equal(purse(w, 'clerk_b'), 1);
  assert.equal(refused(w, use(w, 'clerk_b', 'withdraw_b', 1)), 'invalid_state');
  assert.deepEqual(offer(w, 'withdraw').reason, reason('service.no_funds'));
  assert.equal(pennies(w), 8);
  const chandler = npc(w, 'chandler');
  assert.deepEqual(candles(w, chandler), ['candle_01', 'candle_02', 'candle_03']);
  assert.equal(price(w), 2);
  w = play(w, trade(w, 'buy', 'candle_01', 2)).world;
  assert.equal(pennies(w), 6);
  const [bought, ...extra] = candles(w, w.body); // the shop picks which instance
  assert.deepEqual(extra, []);
  assert.deepEqual(
    candles(w, chandler),
    ['candle_01', 'candle_02', 'candle_03'].filter((c) => c !== bought),
  );
  assert.equal(price(w), 3);
  assert.equal(refused(w, trade(w, 'buy', 'candle_01', 2)), 'invalid_state');
  valid(w);
});

// Breaks: the commission's price or escrow (two ore into forge_back, the others left), the order
// fact, a claim before ready_after, or a second order while one is pending.
test('economy 4: take two ore, commission the knife, claim and commission refused', () => {
  w = go(w, 'north').world;
  w = take(take(w, 'ore_01'), 'ore_02');
  T = w.state.clock;
  w = play(w, use(w, 'smith', 'forge_commission', 3)).world;
  assert.equal(pennies(w), 3);
  assert.equal(purse(w, 'smith'), 3);
  assert.equal(fact(w, 'ordered_knife'), true);
  assert.deepEqual(ores(w, room(w, 'forge_back')), ['ore_01', 'ore_02']);
  assert.deepEqual(ores(w, w.body), []);
  assert.deepEqual(ores(w, room(w, 'forge_stall')), ['ore_03', 'ore_04']);
  assert.equal(refused(w, use(w, 'smith', 'forge_claim', 1)), 'invalid_state');
  assert.deepEqual(offer(w, 'claim').reason, reason('service.not_ready'));
  assert.equal(refused(w, use(w, 'smith', 'forge_commission', 3)), 'invalid_state');
  ordered = w;
  valid(w);
});

// Breaks: the shelf job's hour (08:00, not 07:59), its count or cap, the moved candle, the price
// after the refill, the claim's ready_after boundary (T+3599 or T+3600), its price, or the knife.
test('economy 5: at 08:00 the shelf refills and the knife is ready', () => {
  assert.equal(T + HOUR, 28800);
  const chandler = npc(w, 'chandler');
  const crate = id(w, 'item', 'crate');
  const early = wait(w, T + HOUR - 1).world;
  assert.deepEqual(candles(early, crate), ['candle_04', 'candle_05']);
  assert.equal(refused(early, use(early, 'smith', 'forge_claim', 1)), 'invalid_state');
  assert.deepEqual(offer(early, 'claim').reason, reason('service.not_ready'));
  w = wait(w, T + HOUR).world;
  const left = candles(w, crate); // one of the two moved; the shop picks which
  assert.equal(left.length, 1);
  assert.deepEqual(
    candles(w, chandler),
    candles(early, chandler)
      .concat(candles(early, crate).filter((c) => c !== left[0]))
      .sort(),
  );
  w = play(w, use(w, 'smith', 'forge_claim', 1)).world;
  assert.equal(pennies(w), 2);
  assert.equal(purse(w, 'smith'), 4);
  assert.equal(where(w, id(w, 'item', 'smith_knife')), w.body);
  assert.equal(fact(w, 'ordered_knife'), false);
  // One knife per world: a second order after the claim has nothing to make.
  w = take(take(w, 'ore_03'), 'ore_04');
  assert.equal(refused(w, use(w, 'smith', 'forge_commission', 3)), 'not_found');
  assert.deepEqual(offer(w, 'commission').reason, {
    code: 'not_found',
    message: { key: 'service.no_output' },
  });
  // The next hour's job finds her at the cap of 3 and moves nothing.
  w = wait(w, T + 2 * HOUR).world;
  assert.deepEqual(candles(w, crate), left);
  w = go(w, 'south').world;
  assert.equal(price(w), 2);
  valid(w);
});

// Breaks: cancel refunding the ore to other than the player, keeping the order fact, its fee, or
// releasing the knife.
test('economy 5 branch: cancel before T+3600 returns both ore', () => {
  const c = play(wait(ordered, T + HOUR - 1).world, use(ordered, 'smith', 'forge_cancel', 1)).world;
  assert.equal(pennies(c), 2);
  assert.deepEqual(ores(c, c.body), ['ore_01', 'ore_02']);
  assert.equal(where(c, id(c, 'item', 'smith_knife')), room(c, 'forge_back'));
  assert.equal(fact(c, 'ordered_knife'), false);
  valid(c);
});

// Breaks: the hide's place or check, the hidden status or its label, stealth practice, a bystander
// at alertness 1 seeing through stealth 1, or the unseen lift writing more than the stolen fact.
test('economy 6: hide in the alley, lift the merchant purse unseen', () => {
  five = w;
  w = walk(w, 'south', 'west');
  H = w.state.clock;
  const h = play(w, { type: 'perform', action: 'hide' });
  const hid = ['check_passed', 'fact_changed', 'custom_event', 'action_completed'];
  assert.deepEqual(kinds(h), [...hid, 'status_applied']); // a reaction listens (magic's shock_on_wet)
  assert.equal(fact(h.world, 'uses_stealth'), 1);
  w = walk(h.world, 'east', 'north');
  assert.deepEqual(labels(w), ['condition.hidden']);
  const purse_ = id(w, 'item', 'merchant_purse');
  // Breaks: alertness 2 not piercing stealth 1 (the chandler is why the plan sets her to 1).
  assert.deepEqual(lift(alert(w, 'chandler', 2), 'merchant_purse').lines, ['theft.seen']);
  const t = lift(w, 'merchant_purse');
  assert.deepEqual(t.lines, ['theft.unseen']);
  assert.deepEqual(kinds(t), ['item_acquired', 'fact_changed']);
  w = t.world;
  assert.deepEqual(
    [where(w, purse_), fact(w, 'stolen', purse_), fact(w, 'wanted')],
    [w.body, true, undefined],
  );
  assert.equal(engaged(w, w.body), undefined);
  six = w;
  valid(w);
});

// Breaks: the fence's stolen offer or price, his get lock, the clean beeswax sold to him, or the
// chandler's buy-back of either candle.
test('economy 7: sell the purse to the fence; the clean beeswax goes back to the chandler', () => {
  w = walk(w, 'south', 'west');
  const purse_ = id(w, 'item', 'merchant_purse');
  w = play(w, trade(w, 'sell', 'merchant_purse', 3, 'fence')).world;
  assert.deepEqual([pennies(w), purse(w, 'fence'), where(w, purse_)], [5, 3, npc(w, 'fence')]);
  assert.equal(fact(w, 'stolen', purse_), true);
  assert.equal(refused(w, { type: 'take', item_id: purse_ }), 'permission_denied');
  w = walk(w, 'east', 'north');
  w = play(w, trade(w, 'buy', 'beeswax_candle', 2)).world;
  assert.equal(pennies(w), 3);
  w = walk(w, 'south', 'west');
  assert.equal(refused(w, trade(w, 'sell', 'beeswax_candle', 2, 'fence')), 'invalid_state');
  w = walk(w, 'east', 'north');
  w = play(w, trade(w, 'sell', 'beeswax_candle', 1)).world;
  w = play(w, trade(w, 'sell', 'candle_01', 1)).world;
  assert.equal(pennies(w), 5);
  assert.equal(candles(w, npc(w, 'chandler')).length, 4);
  assert.equal(price(w), 1);
  seven = w;
  valid(w);
});

// Breaks: the fence's get lock missing (red control: without it the purse sells twice).
test('economy 7 control: without the fence lock the purse sells twice', () => {
  const fence = npc(six, 'fence');
  const e = six.entities[fence] as { locks?: object };
  const open: World = {
    ...six,
    entities: { ...six.entities, [fence]: { ...e, locks: undefined } as never },
  };
  let r = walk(open, 'south', 'west');
  r = play(r, trade(r, 'sell', 'merchant_purse', 3, 'fence')).world;
  r = play(take(r, 'merchant_purse'), trade(r, 'sell', 'merchant_purse', 3, 'fence')).world;
  assert.deepEqual([pennies(r), purse(r, 'fence')], [8, 0]);
});

// The world with the player's pennies forged to `value`.
const coin = (w: World, value: number): World => {
  const at = key({ kind: 'resource', resource: resourceRef(w, 'pennies'), entity_id: w.body });
  const resources = { ...w.state.resources, [at]: { ...w.state.resources![at]!, value } };
  return { ...w, state: { ...w.state, resources } };
};
const shut = (w: World, direction: string) => exit(w, direction).door?.state;
const jailerChoices = (w: World) => gameView(w).choice?.choices;
let jail: World; // step 9's arrest: in the cell, 2 pennies, wanted

// Breaks: the seen lift's line or events, the reaction setting wanted, the guard's arrest (an
// encounter instead, or none, or one fired at the lift itself), the charge shutting the door, the
// broke dialogue's gate or its work-off clearing wanted or paying a penny, or the door not opening.
test('economy 9: from step 5, a seen lift; the guard arrests on the next entry; broke, work it off', () => {
  let s = five;
  assert.equal(
    refused(s, { type: 'talk', target_id: npc(s, 'clerk_a') }),
    'unsupported_capability',
  );
  const t = lift(s, 'merchant_purse');
  assert.deepEqual(t.lines, ['theft.seen']);
  assert.deepEqual(kinds(t).slice(-2), ['custom_event', 'fact_changed']);
  s = t.world;
  assert.equal(fact(s, 'wanted'), true);
  assert.equal(where(s, s.body), room(s, 'market_row')); // seen in his room: no arrest yet
  const guard = npc(s, 'guard');
  assert.equal(describeEntity(s, s.character, guard, 'room_line'), 'npc.guard.room_wanted');
  const back = go(walk(s, 'south'), 'north');
  assert.deepEqual(back.lines, ['npc.guard.arrest', 'trial.charge']);
  s = back.world;
  assert.equal(where(s, s.body), room(s, 'cell'));
  assert.equal(engaged(s, s.body), undefined);
  assert.deepEqual([shut(s, 'west'), shut(s, 'down')], ['closed', 'closed']);
  assert.equal(pennies(s), 2);
  jail = s;
  const talked = talk(s, 'jailer');
  assert.equal(talked.opened, 'jailer_broke');
  assert.deepEqual(jailerChoices(talked.world), [
    {
      available: false,
      choice_id: 'pay',
      label: 'dialogue.jailer.pay',
      reason: {
        code: 'insufficient_resource',
        message: { key: 'resource.short', bindings: { resource: 'pennies', amount: 3 } },
      },
    },
    { available: true, choice_id: 'work_off', label: 'dialogue.jailer.work_off' },
  ]);
  const [continuation_id] = pending(talked.world, s.character)!;
  const pay = { type: 'choose', choice_id: 'pay', continuation_id };
  assert.equal(refused(talked.world, pay), 'insufficient_resource');
  const worked = choose(talked.world, 'work_off');
  assert.deepEqual(worked.lines, ['narration.jailer.work_off']);
  s = worked.world;
  assert.deepEqual([pennies(s), fact(s, 'wanted'), purse(s, 'jailer')], [2, false, 0]);
  const market = go(play(s, { type: 'open', direction: 'west' }).world, 'west');
  assert.ok(!market.lines.includes('npc.guard.arrest'));
  s = market.world;
  assert.equal(where(s, s.body), room(s, 'market_row'));
  assert.equal(describeEntity(s, s.character, guard, 'room_line'), 'npc.guard.room');
  valid(s);
  const re = go(walk(forge(s, 'wanted', true), 'south'), 'north').world;
  assert.deepEqual([where(re, re.body), shut(re, 'west')], [room(re, 'cell'), 'closed']); // the open door shut again
});

// Breaks: the broke dialogue's pennies bound off by one (work-off offered with the fine in hand),
// or paying leaves wanted set, skips the transfer or leaves the door shut.
test('economy 9 boundary: with exactly the 3-penny fine the jailer only takes payment', () => {
  const talked = talk(coin(jail, 3), 'jailer');
  assert.equal(talked.opened, 'jailer_talk');
  assert.deepEqual(jailerChoices(talked.world), [
    { available: true, choice_id: 'pay', label: 'dialogue.jailer.pay' },
  ]);
  const s = choose(talked.world, 'pay').world;
  assert.deepEqual([pennies(s), fact(s, 'wanted'), purse(s, 'jailer')], [0, false, 3]);
  assert.equal(
    where(go(play(s, { type: 'open', direction: 'west' }).world, 'west').world, s.body),
    room(s, 'market_row'),
  );
});

// Breaks: the force recipe or the grate's opens_when, the drain's way out, the escape clearing
// wanted, the clerk's fine (gate, price, reset), or the charge not shutting the grate again on
// the second arrest.
test('economy 9 escape: force the grate, leave by the drain still wanted; the guard arrests again', () => {
  const f = play(jail, { type: 'perform', action: 'force_grate' });
  assert.deepEqual(f.lines, ['grate.forced']);
  let s = go(play(f.world, { type: 'open', direction: 'down' }).world, 'down').world;
  assert.equal(where(s, s.body), room(s, 'drain'));
  s = go(s, 'south').world;
  assert.equal(fact(s, 'wanted'), true);
  // The counting house's fine clears it too (clerk A held step 2's fee).
  const fined = choose(talk(coin(s, 3), 'clerk_a').world, 'pay').world;
  assert.deepEqual([pennies(fined), fact(fined, 'wanted'), purse(fined, 'clerk_a')], [0, false, 4]);
  s = go(s, 'west').world;
  const again = go(s, 'north');
  assert.deepEqual(again.lines, ['npc.guard.arrest', 'trial.charge']);
  s = again.world;
  assert.equal(where(s, s.body), room(s, 'cell'));
  assert.equal(shut(s, 'down'), 'closed');
});

// Breaks: hidden ending before hide + 3600 or outliving it, its tick narrating, the bystanders
// not seeing an unhidden lift, the beeswax in the set's price, or the fence's beeswax price.
test('economy 10: from step 7, hidden ends at hide + 3600; the beeswax lift is seen', () => {
  assert.deepEqual(labels(wait(seven, H + HOUR - 1).world), ['condition.hidden']);
  const r = wait(seven, H + HOUR);
  assert.deepEqual(labels(r.world), []);
  assert.deepEqual(
    r.lines.filter((l) => l.startsWith('narration.hidden')),
    ['narration.hidden.expired'],
  );
  const wax = id(r.world, 'item', 'beeswax_candle');
  let s = r.world;
  const t = lift(s, 'beeswax_candle');
  assert.deepEqual(t.lines, ['theft.seen']);
  s = t.world;
  assert.deepEqual(
    [fact(s, 'wanted'), fact(s, 'stolen', wax), where(s, wax)],
    [true, true, s.body],
  );
  assert.equal(price(s), 1);
  s = play(walk(s, 'south', 'west'), trade(s, 'sell', 'beeswax_candle', 2, 'fence')).world;
  assert.deepEqual([pennies(s), purse(s, 'fence')], [7, 1]);
  valid(s);
});

// Breaks: the yard's hide, its purse, the watchman's sight, hostility, wanted line or blow, or the
// fence paying more than his 6.
test('economy yard theft: lift the yard purse hidden and seen; the fence pays out 6 once', () => {
  let y = walk(fresh(WORLD), 'down', 'down');
  const seen = lift(y, 'yard_purse');
  assert.deepEqual(seen.lines, ['theft.seen']);
  const back = go(go(seen.world, 'up').world, 'down').world; // wanted: the guard's twin engages
  const watchman = npc(back, 'watchman');
  assert.equal(engaged(back, back.body)?.row.npc_id, watchman);
  assert.equal(
    describeEntity(back, back.character, watchman, 'room_line'),
    'npc.watchman.room_wanted',
  );
  const round = wait(back, back.state.clock + 150).events;
  assert.equal(
    round.find((e) => e.type === 'attack_result' && e.attacker_id === watchman)?.hit,
    false,
  );
  y = play(y, { type: 'perform', action: 'yard_hide' }).world;
  assert.deepEqual(labels(y), ['condition.hidden']);
  const t = lift(y, 'yard_purse');
  assert.deepEqual([t.lines, fact(t.world, 'wanted')], [['theft.unseen'], undefined]);
  y = walk(t.world, 'up', 'west');
  y = play(y, trade(y, 'sell', 'yard_purse', 3, 'fence')).world;
  y = walk(lift(walk(y, 'east', 'north'), 'merchant_purse').world, 'south', 'west');
  y = play(y, trade(y, 'sell', 'merchant_purse', 3, 'fence')).world;
  assert.deepEqual([pennies(y), purse(y, 'fence')], [16, 0]);
  y = walk(lift(walk(y, 'east', 'north'), 'beeswax_candle').world, 'south', 'west');
  assert.equal(refused(y, trade(y, 'sell', 'beeswax_candle', 2, 'fence')), 'insufficient_resource');
  valid(y);
});

// Breaks: the price table read other than buy[held - 1] (one held 5; four held 1), or the
// chandler not buying her candles back, or the shelf moving more than one candle an hour.
test('economy prices: one held reads 5; sold back to four, 1', () => {
  let p = walk(ordered, 'south');
  p = play(p, trade(p, 'buy', 'candle_01', 3)).world;
  assert.equal(price(p), 5);
  assert.equal(candles(p, p.body).length, 2);
  p = wait(p, T + HOUR).world; // one candle an hour: one held becomes two
  assert.equal(price(p), 3);
  p = play(p, trade(p, 'sell', 'candle_01', 1)).world; // the offer's id; the shop picks which
  assert.equal(price(p), 2);
  p = play(p, trade(p, 'sell', 'candle_01', 1)).world;
  assert.equal(candles(p, npc(p, 'chandler')).length, 4);
  assert.equal(price(p), 1);
});

// Breaks: the strongroom's price or entitlement, the key's get lock, the door's key, the enter
// lock, the chest's put and get locks, or locking the door from inside.
test('economy 8: buy the strongroom, unlock, enter, use the chest, lock behind', () => {
  let s = walk(fresh(WORLD), 'down', 'east');
  s = play(s, use(s, 'clerk_a', 'buy_strongroom', 5)).world;
  assert.equal(pennies(s), 5);
  assert.equal(fact(s, 'owns_strongroom'), true);
  s = walk(take(s, 'strongroom_key'), 'west', 'north', 'north');
  s = walk(take(s, 'ore_03'), 'south', 'south'); // no lock of its own: only the chest's get guards it
  assert.deepEqual(
    exit(s, 'south').door!.actions.map((a) => [a.action_key, a.available]),
    [['unlock', true]],
  );
  s = play(s, { type: 'unlock', direction: 'south' }).world;
  s = play(s, { type: 'open', direction: 'south' }).world;
  s = go(s, 'south').world;
  assert.equal(where(s, s.body), room(s, 'strongroom'));
  const chest = id(s, 'item', 'strongroom_chest');
  const key_ = id(s, 'item', 'strongroom_key');
  const put = { type: 'put', item_id: key_, container_id: chest };
  assert.equal(refused(forge(s, 'owns_strongroom', false), put), 'permission_denied');
  s = play(s, put).world;
  assert.equal(where(s, key_), chest);
  const ore = id(s, 'item', 'ore_03');
  s = play(s, { type: 'put', item_id: ore, container_id: chest }).world;
  assert.equal(
    refused(forge(s, 'owns_strongroom', false), { type: 'take', item_id: ore }),
    'permission_denied',
  );
  s = take(take(s, 'ore_03'), 'strongroom_key');
  s = play(s, { type: 'close', direction: 'north' }).world;
  s = play(s, { type: 'lock', direction: 'north' }).world;
  assert.equal(door(s), 'locked');
  valid(s);
});

// Breaks: the key or the door opening without the purchase, or the enter lock missing behind an
// open door.
test('economy 8 branch: without the purchase the key, the door and the room refuse', () => {
  const n = walk(fresh(WORLD), 'down');
  assert.equal(
    refused(go(n, 'east').world, { type: 'take', item_id: id(n, 'item', 'strongroom_key') }),
    'permission_denied',
  );
  assert.equal(refused(n, { type: 'move', direction: 'south' }), 'exit_locked');
  const forced = {
    ...n,
    state: {
      ...n.state,
      barriers: {
        [key({ kind: 'barrier', barrier: R('barrier', 'strongroom_door') })]: 'open' as const,
      },
    },
  };
  assert.equal(refused(forced, { type: 'move', direction: 'south' }), 'permission_denied');
});

// Breaks: the yard shelf's table (one held 3, two held 2), its hour, its cap of 1, its crate, or the crate's lock.
test('economy yard: the one-candle shelf sells at 3 and refills at 08:00', () => {
  let y = walk(fresh(WORLD), 'down', 'down');
  const seller = npc(y, 'yard_chandler');
  const held = (x: World) =>
    ['yard_candle_01', 'yard_candle_02'].filter((c) => where(x, id(x, 'item', c)) === seller);
  assert.equal(price(y, 'yard_chandler', 'yard_candle_01'), 3);
  assert.equal(
    refused(y, { type: 'take', item_id: id(y, 'item', 'yard_candle_02') }),
    'permission_denied',
  );
  y = play(y, trade(y, 'buy', 'yard_candle_01', 3, 'yard_chandler')).world;
  assert.equal(pennies(y), 7);
  assert.deepEqual(held(y), []);
  assert.deepEqual(held(wait(y, 28799).world), []);
  y = wait(y, 28800).world;
  assert.deepEqual(held(y), ['yard_candle_02']);
  assert.equal(price(y, 'yard_chandler', 'yard_candle_01'), 3);
  y = play(y, trade(y, 'sell', 'yard_candle_01', 1, 'yard_chandler')).world;
  assert.equal(price(y, 'yard_chandler', 'yard_candle_01'), 2);
  assert.deepEqual(held(wait(y, 32400).world), ['yard_candle_01', 'yard_candle_02']);
  valid(y);
});
