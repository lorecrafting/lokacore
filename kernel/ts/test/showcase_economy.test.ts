// The showcase economy and law district walked step by step (docs/showcase/economy-law-district.md,
// guided loop steps 1 to 5 and 8; the theft steps come with the law slice). Each test continues the
// world the one before it left. Fresh world at 07:00 (25200), pennies 10.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { key } from '../src/foundation/compose.ts';
import { decode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import {
  detail,
  fact,
  fresh,
  go,
  HOUR,
  id,
  npc,
  play,
  pool,
  refused,
  room,
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
// The world with owns_strongroom forged false: the chest's locks, checked from inside.
const disown = (w: World): World => ({
  ...w,
  state: {
    ...w.state,
    facts: Object.fromEntries(
      Object.entries(w.state.facts ?? {}).map(([k, v]) => [
        k,
        (decode(k) as { fact: { key: string } }).fact.key === 'owns_strongroom' ? false : v,
      ]),
    ),
  },
});

let w: World;
let T: number; // the commission's clock (step 4)
let ordered: World; // step 4's end, the order pending

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
  assert.deepEqual(candles(w, chandler), ['candle_01', 'candle_03']); // the shop picks candle_02
  assert.deepEqual(candles(w, w.body), ['candle_02']);
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
  assert.deepEqual(candles(w, chandler), ['candle_01', 'candle_03', 'candle_05']);
  assert.deepEqual(candles(w, crate), ['candle_04']);
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
  assert.deepEqual(candles(w, crate), ['candle_04']);
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

// Breaks: the price table read other than buy[held - 1] (one held 5; four held 1), or the
// chandler not buying her candles back.
test('economy prices: one held reads 5; sold back to four, 1', () => {
  let p = walk(ordered, 'south');
  p = play(p, trade(p, 'buy', 'candle_01', 3)).world;
  assert.equal(price(p), 5);
  assert.equal(candles(p, p.body).length, 2);
  p = play(p, trade(p, 'sell', 'candle_01', 1)).world; // the offer's id; the shop picks which
  assert.equal(price(p), 3);
  p = wait(p, T + HOUR).world; // the shelf refills her to three
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
  s = walk(take(s, 'strongroom_key'), 'west');
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
  assert.equal(refused(disown(s), put), 'permission_denied');
  s = play(s, put).world;
  assert.equal(where(s, key_), chest);
  assert.equal(refused(disown(s), { type: 'take', item_id: key_ }), 'permission_denied');
  s = take(s, 'strongroom_key');
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

// Breaks: the yard shelf's table (one held 3), its hour, its cap of 1, or its crate.
test('economy yard: the one-candle shelf sells at 3 and refills at 08:00', () => {
  let y = walk(fresh(WORLD), 'down', 'down');
  const seller = npc(y, 'yard_chandler');
  const held = (x: World) =>
    ['yard_candle_01', 'yard_candle_02'].filter((c) => where(x, id(x, 'item', c)) === seller);
  assert.equal(price(y, 'yard_chandler', 'yard_candle_01'), 3);
  y = play(y, trade(y, 'buy', 'yard_candle_01', 3, 'yard_chandler')).world;
  assert.equal(pennies(y), 7);
  assert.deepEqual(held(y), []);
  assert.deepEqual(held(wait(y, 28799).world), []);
  y = wait(y, 28800).world;
  assert.deepEqual(held(y), ['yard_candle_02']);
  assert.equal(price(y, 'yard_chandler', 'yard_candle_01'), 3);
  y = play(y, trade(y, 'sell', 'yard_candle_01', 1, 'yard_chandler')).world;
  assert.deepEqual(held(wait(y, 32400).world), ['yard_candle_01', 'yard_candle_02']);
  valid(y);
});
