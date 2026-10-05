import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';
const c = read('protocol/fixtures/missing_child_v018_hash.json').value;
const shop = c.npcs['ashmere_missing_child@0.0.18:npc/peg'].shop;
const command = {
  type: 'buy',
  actor_id: '11111111-2222-4333-8444-555555555555',
  provider_id: '22222222-2222-4333-8444-555555555555',
  item_id: '33333333-2222-4333-8444-555555555555',
  quoted_price: 3,
};
// Breaks: incomplete identities, quote/funding or empty/oversized offers pass the wire boundary.
test('shop contracts reject missing fields and malformed positive prices', () => {
  for (const [name, valid] of [
    ['CommandPayload', command],
    ['Shop', shop],
    ['ShopOffer', shop.offers[0]],
  ] as const) {
    assert.deepEqual(validate(name, valid), []);
    for (const field of Object.keys(valid)) {
      const bad = { ...valid };
      delete bad[field];
      assert.ok(validate(name, bad).length, `${name}.${field}`);
    }
  }
  for (const price of [0, 2147483648]) {
    assert.ok(validate('CommandPayload', { ...command, quoted_price: price }).length);
    assert.ok(validate('ActionInput', { quoted_price: price }).length);
    assert.ok(validate('ShopOffer', { ...shop.offers[0], buy: price }).length);
    assert.ok(validate('ShopOffer', { ...shop.offers[0], sell: price }).length);
  }
  for (const offers of [[], Array(33).fill(shop.offers[0])])
    assert.ok(validate('Shop', { ...shop, offers }).length);
});
