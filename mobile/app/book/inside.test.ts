// An open container's contents on their own page (book-ui.md Item details and Take/Drop; loka-mo0p).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { book, bundle } from './__tests__/polish-book.test.ts';
import { routes } from '../stories/routes.ts';
import { LABEL } from './labels.ts';
import { pagesAfter } from './model.ts';

const showcase = bundle('toolbox_showcase_hash');
// The Farm Yard's seed sack, opened: one turnip seed inside.
const openSack = () => {
  const h = book(showcase);
  for (const step of [...routes['item-too-heavy']!, 'Open a seed sack'])
    typeof step === 'function' ? step(h as never) : h.tap(step as string);
  return h;
};

// Breaks: the item page lists the contents itself again, Look inside opens nothing, a row opens
// no item page, the item's Leave skips the list, or Close lands anywhere but the sack's page.
test('Look inside opens the contents page; Leave returns to it, Close to the item page', () => {
  const h = openSack();
  const sack = h.stack.at(-1)!;
  assert.ok(!h.text().includes(LABEL.inside), 'the item page draws no Inside list');
  h.tap(LABEL.lookInside);
  assert.deepEqual(h.stack.at(-1), { kind: 'inside', id: (sack as { id: string }).id });
  assert.ok(h.text().includes(LABEL.inside));
  h.tap('A turnip seed, open');
  assert.equal(h.stack.at(-1)!.kind, 'thing');
  h.tap(LABEL.leave);
  assert.equal(h.stack.at(-1)!.kind, 'inside');
  h.tap(LABEL.close);
  assert.deepEqual(h.stack.at(-1), sack);
  h.unmount();
  h.sql.close();
});

// Breaks: an emptied open container hides Look inside, or its page draws a bare title.
test('an empty open container still looks inside, and says there is nothing', () => {
  const h = openSack();
  h.tap(LABEL.lookInside);
  h.tap('A turnip seed, open');
  h.tap('Take a turnip seed');
  h.tap('seed sack, open');
  h.tap(LABEL.lookInside);
  assert.ok(h.text().includes(LABEL.nothingInside));
  h.unmount();
  h.sql.close();
});

// Breaks: the contents page outlives its closed lid or the room, as other details do not.
test('a closed lid or a room change clears the contents page', () => {
  const h = openSack();
  h.tap(LABEL.lookInside);
  const stack = h.stack;
  const view = h.p.screen().view;
  const id = (stack.at(-1) as { id: string }).id;
  const closed = structuredClone(view);
  const sack = closed.entities.find((e) => e.id === id)!;
  Object.assign(sack, { state: 'closed', contents: [] });
  assert.deepEqual(pagesAfter(stack, view, closed), stack.slice(0, -1));
  assert.deepEqual(pagesAfter(stack, view, view), stack);
  const moved = structuredClone(view);
  moved.place = { ...moved.place, id: 'elsewhere' };
  assert.deepEqual(pagesAfter(stack, view, moved), []);
  h.unmount();
  h.sql.close();
});
