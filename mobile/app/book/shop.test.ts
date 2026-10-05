import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buttonsOf, group } from './model.ts';
import { readFileSync } from 'node:fs';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
const pin = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v018_hash.json', import.meta.url),
    'utf8',
  ),
);
// Breaks: Book sends a price-free/identity-free purchase, or promises Sell for stock the actor lacks.
test('Peg detail binds exact available item, merchant and quote', () => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin);
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'north' } } as never);
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'west' } } as never);
  const v = a.game.view().view;
  const peg = v.entities.find((e) => e.shop)!.id;
  const buttons = buttonsOf(
    v,
    (k) => k,
    (k) => pin.value.text[k],
  );
  const offers = group(buttons as never)
    .on(peg)
    .filter((b) => ['buy', 'sell'].includes(b.action_key));
  assert.equal(offers.length, 4);
  assert.deepEqual(offers[0].target_ids, [
    peg,
    v.entities.find((e) => e.id === peg)!.shop![0].item_id,
  ]);
  assert.deepEqual(offers[0].input, { quoted_price: 3 });
  assert.equal(offers[0].label, 'Buy a torch — 3p');
  assert.ok(offers.every((b) => b.action_key === 'buy'));
});
