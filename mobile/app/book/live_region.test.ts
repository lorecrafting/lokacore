// Book live region (loka-x6t.43): a screen reader hears each new batch of World, combat and refused
// lines once, politely, and never the history a page or a reopen draws again.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { GameView } from '../../packages/game-view/session.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { game, view } from './__tests__/combat-book.test.ts';
import { book, words } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';
import { presenter } from './presenter.ts';

const showcase = compiled('cartridges/toolbox_showcase');
const live = (b: ReturnType<typeof book>) => {
  const heard = b.draw().find((n) => n.type?.name === 'Heard');
  assert.ok(heard, 'no live region');
  const region = heard.type(heard.props);
  return [region.props['aria-live'], words(region)];
};
const say = (b: ReturnType<typeof book>, word: string) => {
  b.tap(LABEL.sayToRoom);
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onChangeText(word);
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onSubmitEditing();
};

// Breaks: no region, an assertive one, a press not read, or an earlier press read again.
test("the Book reads each press's new line politely", () => {
  const b = book(showcase as never);
  assert.deepEqual(live(b), ['polite', '']);
  say(b, 'ware');
  assert.deepEqual(live(b), ['polite', 'You say, "Ware."']);
  say(b, 'begone');
  assert.deepEqual(live(b), ['polite', 'You say, "Begone."']);
});

// Breaks: the restored log read at open, a redraw counted as a new batch, a repeat not read again, the trim at 200 lines losing a
// line, a refused line read without its reason, combat lines read twice, or a room or encounter change
// (which empties its log) hiding the new log's first lines.
test('each batch holds only the lines new since the last screen', () => {
  let current: GameView = view({ combat: undefined });
  const p = presenter({
    ...game(current),
    view: () => ({ view: current, token: 'view:1' }),
    lastNarration: () => ({ command_id: 'before', lines: [{ key: 'combat.result' }] }) as never,
  });
  const s = p.screen();
  assert.deepEqual([s.log, s.said.text], [['The marsh rat falls.'], '']);
  const said = () => p.screen().said;
  s.log.push('The bell rings.');
  const first = said();
  assert.equal(first.text, 'The bell rings.');
  assert.deepEqual(said(), first);
  s.log.push('The bell rings.');
  assert.equal(said().text, 'The bell rings.');
  assert.notEqual(said().key, first.key);
  s.log.push(...Array(200).fill('-'), 'A door creaks.');
  s.combatLog.push(...Array(201).fill('-')); // never read: the room log is the one source
  assert.equal(said().text, [...Array(200).fill('-'), 'A door creaks.'].join(' '));
  s.log.push({ kind: 'refused', reason: 'closed', text: 'The way north is closed.' });
  // A combat line lands in both logs (Line placement) and is read once.
  for (const l of [s.log, s.combatLog]) l.push('The marsh rat bites.');
  assert.equal(said().text, 'closed, The way north is closed. The marsh rat bites.');
  current = view();
  s.combatLog.length = 0;
  for (const l of [s.log, s.combatLog]) l.push('A marsh rat attacks.');
  assert.equal(said().text, 'A marsh rat attacks.');
  current = { ...view({ combat: undefined }), place: { ...current.place, id: 'yard' } };
  s.log.length = 0;
  s.log.push('The yard is wet.', { text: 'A crow lands.', event: true });
  assert.equal(said().text, 'The yard is wet. A crow lands.');
});

// Breaks (loka-x6t.124): an own buy merged into "(2 times)" adds no log line, so the second buy on
// the chandler's page is never read; quiet is visual only. The showcase's two tallow candles have
// their own shorts, so they never merge; this copy gives both the same one.
test('two equal buys on a shop page are each read in full', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-shared-short-'));
  const item = join(dir, 'items/candle_02.json');
  cpSync(fileURLToPath(new URL('../../../cartridges/toolbox_showcase', import.meta.url)), dir, {
    recursive: true,
  });
  writeFileSync(item, readFileSync(item, 'utf8').replace('candle_02.short', 'candle_03.short'));
  const b = book(compiled(dir) as never);
  rmSync(dir, { recursive: true });
  for (const c of ['Go down', 'Go north']) (b.map(), b.tap(c));
  for (const c of ['chandler, open', LABEL.trade]) b.tap(c);
  const batches = [0, 1].map(() => {
    b.tap(/tallow candle, \d+p\. Buy for /);
    assert.deepEqual(live(b), ['polite', 'You buy a tallow candle.']);
    return b.draw().find((n) => n.type?.name === 'Heard')!.props.said.key;
  });
  assert.notEqual(batches[0], batches[1], 'the second buy is a new batch, so it is read again');
});
