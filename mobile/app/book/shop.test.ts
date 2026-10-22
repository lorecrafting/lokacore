import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buttonsOf, group } from './model.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
const showcase = compiled('cartridges/toolbox_showcase');
// Breaks: Book sends a price-free/identity-free purchase, or promises Sell for stock the actor lacks.
// Expected values: npcs/nell.json offers one item, bread, buy 4 (sell 1, but Tam holds no bread).
test('Nell detail binds exact available item, merchant and quote', () => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, showcase as never);
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'south' } } as never);
  const v = a.game.view().view;
  const nell = v.entities.find((e) => e.shop)!.id;
  const text = JSON.parse(showcase.canonical).text;
  const buttons = buttonsOf(
    v,
    (k) => k,
    (k) => text[k],
  );
  const offers = group(buttons as never)
    .on(nell)
    .filter((b) => ['buy', 'sell'].includes(b.action_key));
  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0].target_ids, [
    nell,
    v.entities.find((e) => e.id === nell)!.shop![0].item_id,
  ]);
  assert.deepEqual(offers[0].input, { quoted_price: 4 });
  assert.equal(offers[0].label, 'Buy a cob of bread — 4p');
  assert.equal(offers[0].action_key, 'buy');
});
