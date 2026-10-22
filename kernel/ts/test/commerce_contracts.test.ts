import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'prices_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
// Compiled-form shop with only required fields: the loop below deletes every key.
const shop = {
  resource: ref('resource', 'pennies'),
  offers: [{ item: ref('item', 'fish_a'), buy: 5, sell: 1 }],
  bought: 'shop.bought',
  sold: 'shop.sold',
};
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
      const bad: Record<string, unknown> = { ...valid };
      delete bad[field];
      assert.ok(validate(name, bad).length, `${name}.${field}`);
    }
  }
  for (const price of [0, 2147483648]) {
    assert.ok(validate('CommandPayload', { ...command, quoted_price: price }).length);
    // Row kgd.70: a barter quotes 0 through the shared input; buy refuses it in CommandPayload.
    assert.ok(validate('ActionInput', { quoted_price: price || -1 }).length);
    assert.ok(validate('ShopOffer', { ...shop.offers[0], buy: price }).length);
    assert.ok(validate('ShopOffer', { ...shop.offers[0], sell: price }).length);
  }
  for (const offers of [[], Array(33).fill(shop.offers[0])])
    assert.ok(validate('Shop', { ...shop, offers }).length);
});
