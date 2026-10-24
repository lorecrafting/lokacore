// The quiet line rule (book-ui.md Line placement): the player's own buy, sale, take or put goes to
// the room log only, and an equal one just after it merges into "(N times)", read again in full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logLines, quietOf, type Logs } from './logs.ts';
import { lineText } from './words.ts';

const bought = (item: string) => [
  { key: 'commerce.bought', bindings: { item }, participants: { actor: 'pc' } },
];
const fresh = () => ({ log: [], combatLog: [], details: new Map(), visits: 1 }) as unknown as Logs;
const press = (s: Logs, lines: ReturnType<typeof bought>, target: unknown, page: string[] = []) =>
  logLines(
    s,
    [`You buy ${lines[0]!.bindings.item}.`],
    page,
    quietOf(s, lines as never, target, 'shop'),
  );

test('two equal quiet buys merge into one line, read again in full; the page keeps neither', () => {
  const s = fresh();
  const page: string[] = [];
  press(s, bought('candle'), ['candle'], page);
  press(s, bought('candle'), ['candle'], page);
  assert.deepEqual(s.log.map(lineText), ['You buy candle. (2 times)']);
  assert.deepEqual(s.merged, ['You buy candle.']);
  assert.deepEqual(page, []);
});

test('a different item, target or visit, or a line between, does not merge', () => {
  const s = fresh();
  press(s, bought('candle'), ['candle']);
  press(s, bought('tallow'), ['candle']); // other bindings
  press(s, bought('tallow'), ['tallow']); // other target
  s.visits = 2;
  press(s, bought('tallow'), ['tallow']); // a new page visit
  s.log.push('Maud arrives.');
  press(s, bought('tallow'), ['tallow']); // a line between
  assert.deepEqual(s.log.map(lineText), [
    'You buy candle.',
    'You buy tallow.',
    'You buy tallow.',
    'You buy tallow.',
    'Maud arrives.',
    'You buy tallow.',
  ]);
  assert.equal(s.merged, undefined);
});

test('a loud line stays in place, and a take on the item own page is not quiet', () => {
  const s = fresh();
  const page: string[] = [];
  const said = [{ key: 'dialogue.bram.prompt', bindings: {}, participants: { actor: 'pc' } }];
  assert.equal(quietOf(s, said as never, ['bram']), undefined);
  const take = [{ key: 'item.taken', bindings: {}, participants: { actor: 'pc' } }];
  assert.equal(quietOf(s, take as never, ['ear'], 'ear'), undefined);
  assert.ok(quietOf(s, take as never, ['ear'], 'corpse'));
  logLines(s, ['Bram nods.'], page, undefined);
  assert.deepEqual([s.log, page], [['Bram nods.'], ['Bram nods.']]);
});
