// The empty-section notes and the quest hint show exactly when their list or field is empty or set.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from './__tests__/polish-book.test.ts';

const { CarryingPage, MapPage, holding } = await import('./sections.tsx'); // after the harness's .tsx hooks
const { JournalPage } = await import('./journal.tsx');
const g = globalThis as Record<symbol, unknown>;
g[Symbol.for('loka-book-test-state')] = (v: unknown) => [v, () => {}];
g[Symbol.for('loka-book-test-effect')] = () => {};
const text = (el: any) => words(nodes(el));
const say = (k: string) => k;
const none = () => {};

// Breaks: the empty note shows beside held items, or is missing when nothing is held.
test('Inventory says it carries nothing only when no item is held', () => {
  const page = (items: object[]) =>
    text(CarryingPage({ items, text: say, open: none, world: none } as any));
  assert.ok(page([]).includes('You are carrying nothing.'));
  assert.equal(page([{ id: 'a', name: 'lamp' }]).includes('carrying nothing'), false);
});

// Breaks: a second egg of one kind is drawn as its own row, or the kind's row loses one of them
// (the count is the only thing keeping a grouped member reachable, so a wrong count loses an item).
test('Inventory draws one counted row per kind of held item', () => {
  const egg = (id: string) => ({
    id,
    name: 'an egg',
    words: { bare: 'egg', article: 'an', plural: 'eggs' },
  });
  const rows = (items: any[]) => holding(items, say).map((h: any) => [h.item.id, h.count]);
  // Three eggs and one lamp: the lamp keeps its own row, counted once.
  assert.deepEqual(rows([egg('a'), egg('b'), egg('c'), { id: 'l', name: 'lamp' }]), [
    ['a', 3],
    ['l', 1],
  ]);
  // No plural words: two items of one name stay two rows, since their state may differ.
  assert.deepEqual(
    rows([
      { id: 'x', name: 'torch' },
      { id: 'y', name: 'torch' },
    ]),
    [
      ['x', 1],
      ['y', 1],
    ],
  );
});

// Breaks: the no-exit note shows beside a known exit, or is missing in a room with none.
test('Map says no way out is known only when the room has no exit', () => {
  const page = (exits: object[]) =>
    text(
      MapPage({
        view: { exits, place: { title: { key: 'Room' } } },
        text: say,
        world: none,
      } as any),
    );
  assert.ok(page([]).includes('No way out is known.'));
  assert.equal(page([{ direction: 'north', available: true }]).includes('No way out'), false);
});

// Breaks: a quest without a hint still draws a Hint line, or a set hint is dropped.
test('Journal draws a Hint line only for a quest that has one', () => {
  const quest = (hint?: string) => ({
    quest: { cartridge_id: 'c', cartridge_version: 1, key: 'q' },
    title: 'Quest',
    state: 'active',
    hint,
  });
  const page = (hint?: string) =>
    text(
      JournalPage({
        view: { journal: [quest(hint)], topics: [] },
        text: say,
        world: none,
        chronicle: () => [],
      } as any),
    );
  assert.ok(page('Ask Bram').includes('Hint: Ask Bram'));
  assert.equal(page().includes('Hint'), false);
});
