// Container lids (loka-x6t.121; docs/showcase/economy-law-district.md, homestead-district.md): the
// sack, crates and chests start closed, so Open comes before Take or Put.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { fresh, go, id, play, refused, take } from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-0000000005e1';
const walk = (w: World, ...ds: string[]) => ds.reduce((x, d) => go(x, d).world, w);
const valid = (w: World) => (assert.deepEqual(validate('GameView', gameView(w)), []), w);

// Breaks: the sack losing its tie (seed visible or takeable while closed), a keyless tie listing
// Unlock, Put skipping the lid, the open state not persisting across rooms.
test('homestead sandbox: the seed sack starts tied, opens once, stays open and refuses behind its tie', () => {
  const sack = (x: World) =>
    gameView(valid(x)).entities.find((e) => e.id === id(x, 'item', 'sack'))!;
  const keys = (x: World) => sack(x).actions.map((a) => String(a.action_key));
  const closed = walk(fresh(WORLD), 'north', 'west', 'south');
  assert.equal(sack(closed).state, 'closed');
  assert.equal(sack(closed).contents, undefined);
  assert.deepEqual(
    keys(closed)
      .filter((k) => ['open', 'take', 'close', 'unlock'].includes(k))
      .sort(),
    ['open', 'take'],
  );
  assert.equal(
    refused(closed, { type: 'take', item_id: id(closed, 'item', 'seed_01') }),
    'not_present',
  );
  assert.equal(refused(closed, { type: 'take', item_id: id(closed, 'item', 'sack') }), 'too_heavy');
  const held = take(closed, 'holding_apple');
  assert.equal(
    refused(held, {
      type: 'put',
      item_id: id(held, 'item', 'holding_apple'),
      container_id: id(held, 'item', 'sack'),
    }),
    'exit_closed',
  );
  const open = walk(
    play(closed, { type: 'open', target_id: id(closed, 'item', 'sack') }).world,
    'north',
    'south',
  );
  assert.equal(sack(open).state, 'open');
  assert.deepEqual(
    sack(open).contents?.map((c) => [c.id, c.container_id]),
    [[id(open, 'item', 'seed_01'), id(open, 'item', 'sack')]],
  );
  assert.ok(keys(open).includes('close'));
});

// Breaks: a lid missing on a chest or crate (contents shown before Open). The shelf restock from
// the closed storeroom crate is pinned by economy 5 above, which never opens it.
test('economy yard: the crate and the hoard chest start closed, hiding what is in them', () => {
  const y = walk(fresh(WORLD), 'down', 'down');
  const shown = (k: string) => gameView(y).entities.find((e) => e.id === id(y, 'item', k))!;
  for (const k of ['yard_crate', 'hoard_chest']) {
    assert.equal(shown(k).state, 'closed', k);
    assert.equal(shown(k).contents, undefined, k);
  }
  // the sealed storeroom crate is out of reach: its lid is read from the compiled cartridge
  assert.equal(y.cartridge.barriers!['toolbox_showcase@0.0.1:barrier/crate_lid'].initial, 'closed');
});
