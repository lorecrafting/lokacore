// Book live region (loka-x6t.43): a screen reader hears each new batch of World, combat and refused
// lines once, politely, and never the history a page or a reopen draws again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { game, view } from './__tests__/combat-book.test.ts';
import { book, words } from './__tests__/polish-book.test.ts';
import { presenter } from './presenter.ts';

const showcase = compiled('cartridges/toolbox_showcase');
const live = (b: ReturnType<typeof book>) => {
  const region = b.draw().find((n) => n.props?.['aria-live']);
  assert.ok(region, 'no live region');
  return [region.props['aria-live'], words(region)];
};

// Breaks: no region, an assertive one, a press not read, or an earlier press read again.
test("the Book reads each press's new line politely", () => {
  const b = book(showcase as never);
  assert.deepEqual(live(b), ['polite', '']);
  b.tap('ware, say');
  assert.deepEqual(live(b), ['polite', 'You say "ware".']);
  b.tap('begone, say');
  assert.deepEqual(live(b), ['polite', 'You say "begone".']);
});

// Breaks: the restored log read at open, a redraw counted as a new batch, a repeat not read again, the trim at 200 lines losing a
// line, a refused line read without its reason, combat lines left out, or a room or encounter change
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
  s.combatLog.push(...Array(201).fill('-'));
  said();
  s.log.push({ kind: 'refused', reason: 'closed', text: 'The way north is closed.' });
  s.combatLog.push('The marsh rat bites.');
  assert.equal(said().text, 'closed, The way north is closed. The marsh rat bites.');
  current = view();
  s.combatLog.length = 0;
  s.combatLog.push('A marsh rat attacks.');
  assert.equal(said().text, 'A marsh rat attacks.');
  current = { ...view({ combat: undefined }), place: { ...current.place, id: 'yard' } };
  s.log.length = 0;
  s.log.push('The yard is wet.', { text: 'A crow lands.', event: true });
  assert.equal(said().text, 'The yard is wet. A crow lands.');
});
