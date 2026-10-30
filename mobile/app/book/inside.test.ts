// An open container's contents on their own page (book-ui.md Item details and Take/Drop; loka-mo0p).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { book, bundle } from './__tests__/polish-book.test.ts';
import { routes } from '../stories/routes.ts';
import { LABEL } from './labels.ts';
import { pagesAfter } from './model.ts';
import { restoredItemPages } from './item-pages.ts';

// after the harness registers its .tsx loader
const { resultPages } = await import('./updates.ts');
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
  const opened = h.p.screen().detail((sack as { id: string }).id)[0]!;
  assert.ok(h.text().includes(opened));
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
  assert.ok(h.text().includes(opened), 'the item page visit outlives its Inside page');
  h.tap(LABEL.leave);
  assert.deepEqual(h.stack, []);
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

// Breaks: a corpse Take that leaves items behind drops the Inside page the player took from.
test('a corpse Take with items left returns to its Inside page', () => {
  const corpse = { id: 'c', name: 'corpse', contents: [] };
  const view = {
    place: { id: 'p' },
    entities: [corpse, { id: 'tooth', name: 'tooth', container_id: 'c' }],
    inventory: [{ id: 'ear', name: 'ear' }],
  };
  const stack = [
    { kind: 'thing', id: 'c' },
    { kind: 'inside', id: 'c' },
    { kind: 'thing', id: 'ear' },
  ] as const;
  const screen = { returnWorld: false, returnDetail: 'c', view } as never;
  assert.deepEqual(resultPages([...stack], screen), stack.slice(0, 2));
});

// Breaks: a cold reopen of a Read routes a person's held book through an Inside page they never draw.
test('a restored Read goes through a container Inside page, never a person', () => {
  const read = [{ action_key: 'read' }];
  const view = (kind: string) => ({
    entities: [
      { id: 'h', kind, contents: [] },
      { id: 'b', container_id: 'h', actions: read },
    ],
    inventory: [],
  });
  const pages = (kind: string) =>
    restoredItemPages(view(kind) as never, (id) => (id === 'b' ? ['text'] : []));
  assert.deepEqual(pages('npc'), [
    { kind: 'carrying' },
    { kind: 'thing', id: 'h' },
    { kind: 'thing', id: 'b' },
  ]);
  assert.deepEqual(pages('item').slice(1, 3), [
    { kind: 'thing', id: 'h' },
    { kind: 'inside', id: 'h' },
  ]);
});
