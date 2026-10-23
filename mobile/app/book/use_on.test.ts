// Toolbox row G4 Book half (docs/system/book-ui.md, Item details): the held tool's page offers one
// card per use pair the GameView lists, through the real authority and Book. Expected text is
// literal from cartridges/use_sampler/text.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { buttonsOf } from './buttons.ts';

/** Holding the bucket and the oilcan, with the torch dropped (the cart catches fire). */
function yard() {
  const b = book(compiled('cartridges/use_sampler') as never);
  for (const k of ['bucket', 'oilcan', 'torch']) {
    b.tap(new RegExp(`${k}, open$`, 'i'));
    b.tap(/^Take/);
  }
  b.tap(/Contents/);
  b.tap(/^Inventory/);
  b.tap(/torch/);
  b.tap(/^Drop/);
  return b;
}
const page = (b: ReturnType<typeof yard>, item: string) => {
  b.tap(/Contents/);
  b.tap(/^Inventory/);
  b.tap(new RegExp(item));
};

// Breaks: the pair reads its tool as a destination ("Quench a bucket in a bucket"), names the
// tool instead of the target, is missing from the target's page or reads differently there
// (owner 2026-10-23: both pages), or presses ids other than the listed [target, tool] pair. Every
// listed pair is pressed, so this is the view-to-invocation check.
test('Quench a cart on the bucket and the cart, Oil a winch on the oilcan; each press is admitted', () => {
  const b = yard();
  const say = (k: string) => k;
  const v = b.game.view().view;
  const listed = v.inventory.flatMap((i) =>
    i.actions.filter((a) => a.action_key === 'quench' || a.action_key === 'oil'),
  );
  assert.deepEqual(
    buttonsOf(v, say, say)
      .filter((p) => p.action_key === 'quench' || p.action_key === 'oil')
      .map((p) => [p.action_key, p.target_ids, p.input, p.detail_id]),
    listed.flatMap((a) =>
      [a.target_ids![1], a.target_ids![0]].map((page) => [a.action_key, a.target_ids, {}, page]),
    ),
  );
  page(b, 'bucket');
  assert.ok(b.labels().includes('Quench a cart'), b.labels().join(' | '));
  b.tap('Leave');
  b.tap('Back to World');
  b.tap(/^a cart, open$/i);
  b.tap('Quench a cart');
  assert.equal(b.text()[0], 'A cart');
  assert.ok(b.text().includes('You pour water over it and the flames hiss out.'));
  assert.ok(!b.labels().some((l) => l.startsWith('Quench')), 'the cart no longer burns');
  b.tap('Leave');
  page(b, 'oilcan');
  assert.ok(b.labels().includes('Oil a winch'), b.labels().join(' | '));
  b.tap('Oil a winch');
  assert.ok(b.text().includes('You work oil into it.'));
});
