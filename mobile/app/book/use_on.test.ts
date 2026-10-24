// Toolbox row G4 Book half (docs/system/book-ui.md, Pick a second thing): a use pair is a Pick list
// row on its target's page ("Use an item…") and its tool's ("Use on…"), through the real
// authority and Book. Expected text is literal from cartridges/use_sampler/text.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';

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
type Book = ReturnType<typeof yard>;
const held = (b: Book, item: string) => {
  b.tap(/Contents/);
  b.tap(/^Inventory/);
  b.tap(new RegExp(item));
};
const here = (b: Book, thing: string) => b.tap(new RegExp(`^an? ${thing}, open$`, 'i'));
const rows = (b: Book) =>
  b.labels().slice(b.labels().indexOf(LABEL.useAnItem) + 1, b.labels().indexOf(LABEL.leave));
const id = (b: Book, name: string) =>
  [...b.game.view().view.entities, ...b.game.view().view.inventory].find((e) =>
    e.name.includes(name),
  )!.id;

// Breaks: the target's list offers a tool with no pair (the oilcan), sends the pair in tool-first
// order or with input, stays on the page after the pick, or logs no outcome line.
test('the cart offers Use an item… with the bucket; the pick quenches it and returns to World', () => {
  const b = yard();
  const sent: unknown[] = [];
  const invoke = b.game.invoke.bind(b.game);
  b.game.invoke = (i) => (sent.push(i), invoke(i));
  here(b, 'cart');
  b.tap(LABEL.useAnItem);
  assert.deepEqual(rows(b), ['A bucket, quench a cart']);
  b.tap('A bucket, quench a cart');
  const { action_key, target_ids, input } = sent[0] as never;
  assert.deepEqual(
    { action_key, target_ids, input },
    {
      action_key: 'quench',
      target_ids: [id(b, 'cart'), id(b, 'bucket')],
      input: {},
    },
  );
  assert.ok(b.labels().includes('standing, change position'), 'back on World');
  assert.equal(b.p.screen().log.at(-1), 'You pour water over it and the flames hiss out.');
  here(b, 'cart');
  assert.ok(!b.labels().includes(LABEL.useAnItem), 'the cart no longer burns');
});

// Breaks: a target lists every held tool, or a thing no use names still shows the option.
test('the winch lists the oilcan only; the torch has no Use an item…', () => {
  const b = yard();
  here(b, 'winch');
  b.tap(LABEL.useAnItem);
  assert.deepEqual(rows(b), ['An oilcan, oil a winch']);
  b.tap(LABEL.leave);
  here(b, 'torch');
  assert.ok(!b.labels().includes(LABEL.useAnItem), b.labels().join(' | '));
});

// Breaks: the tool's page keeps a per-pair card, or its list names the tool instead of the target.
test('the bucket offers Use on… with the cart and no per-pair card', () => {
  const b = yard();
  held(b, 'bucket');
  assert.ok(!b.labels().some((l) => l.startsWith('Quench')), b.labels().join(' | '));
  b.tap(LABEL.useOn);
  assert.ok(b.labels().includes('A cart, quench a cart'), b.labels().join(' | '));
});

/** The bucket's quench pair refused with `code` (a controlled view). */
function refused(b: Book, code: 'cooldown' | 'invalid_state') {
  const real = b.game.view.bind(b.game);
  b.game.view = () => {
    const r = real();
    const inventory = r.view.inventory.map((e) => ({
      ...e,
      actions: e.actions.map((a) =>
        a.action_key === 'quench' ? { ...a, available: false, reason: { code } } : a,
      ),
    }));
    return { ...r, view: { ...r.view, inventory } } as never;
  };
  assert.deepEqual(validate('GameView', b.game.view().view), []);
}

// Breaks: a use pair refused for a reason other than cooldown still draws a row (and its option),
// read as "not yet" (book-ui.md: any other refused use pair is no row).
test('a pair refused for another reason draws no option on either page', () => {
  const b = yard();
  refused(b, 'invalid_state');
  here(b, 'cart');
  assert.ok(!b.labels().includes(LABEL.useAnItem), b.labels().join(' | '));
  b.tap(LABEL.leave);
  held(b, 'bucket');
  assert.ok(!b.labels().includes(LABEL.useOn), b.labels().join(' | '));
});

// Breaks: an accepted pick whose receipt has no narration logs no line, or one without the
// recipe's label and the pair's names (book-ui.md: the use pair's fallback line).
test('a pick without narration logs the use line once', () => {
  const b = yard();
  const invoke = b.game.invoke.bind(b.game);
  b.game.invoke = (i) => {
    const r = invoke(i) as any;
    return r.kind === 'saved' && r.decision.kind === 'accepted'
      ? { ...r, decision: { ...r.decision, narration: [] } }
      : r;
  };
  here(b, 'cart');
  b.tap(LABEL.useAnItem);
  b.tap('A bucket, quench a cart');
  const line = 'You quench a cart with a bucket.';
  assert.equal(b.p.screen().log.at(-1), line);
  assert.equal(b.p.screen().log.filter((s: string) => s === line).length, 1);
});

// Breaks: a resting pair becomes a pressable row or loses its reason; Escape leaves the list open
// or drops focus instead of returning it to the option.
test('a resting pair is a `label: reason` row; Escape closes the list onto its option', () => {
  const b = yard();
  refused(b, 'cooldown');
  here(b, 'cart');
  const option = () => b.draw().find((n) => n.props.accessibilityLabel === LABEL.useAnItem);
  b.tap(LABEL.useAnItem);
  const focused: string[] = [];
  option().props.ref.current = { focus: () => focused.push('option') };
  assert.ok(b.text().includes('A bucket: not yet.'), JSON.stringify(b.text()));
  assert.deepEqual(rows(b), []);
  b.draw()
    .find((n) => n.props.onKeyDown)
    .props.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.deepEqual(focused, ['option']);
  assert.equal(option().props.accessibilityState.expanded, false);
  assert.ok(!b.text().includes('A bucket: not yet.'));
});
