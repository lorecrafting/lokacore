// Showcase social step 14 (docs/showcase/hub-and-first-districts.md): the away recap of Tam's day on
// the Low Wardle green, through the real authority and Book. Weather oracle for the release context
// (authority/local-story/session.ts CONTEXT), independent of the kernel: for d in 1..7 the first 4
// bytes of `printf 'weather:<CONTEXT>:<d>' | shasum -a 256`, big-endian, mod 7 (clear 2, frost, rain,
// gale, heat, drought): 5, 1, 0, 5, 4, 3, 6, so day 6 alone is rain.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';

const bundle = compiled('cartridges/toolbox_showcase');
const pulse = (b: Book) => (b.game as unknown as { pulse(): { kind: string } }).pulse();
type Book = ReturnType<typeof book>;
// `ms` of open session time passes (an active pulse, so the away cap does not apply); pulses until
// time stops catching up.
function away(ms: number) {
  const b = book(bundle as never);
  b.go('south');
  for (const c of ['Reeve, open', /^Talk/, 'Take the letter to Wat']) b.tap(c);
  b.tap('Leave the conversation');
  b.tap('Leave');
  // The recap's "no deadline line" only means something with the letter quest running.
  const journal = b.game.view().view.journal;
  assert.deepEqual([journal[0]?.quest.key, journal[0]?.state], ['carry_letter', 'active']);
  b.clock.wall += ms;
  b.clock.mono += ms;
  for (let n = 0; pulse(b).kind === 'catching_up'; n++) assert.ok(n < 100, 'never settled');
  return b;
}

// Breaks: the showcase's recap threshold is missing (the lines log one by one), the recap counts
// Tam's moves on the rain day (he goes to the church then) or shows the deadline or Tam's goal.
test('three real hours away (07:00 day 1 to 13:00 day 7): one recap of Tam on the green', () => {
  const b = away(3 * 3600 * 1000);
  b.tap(`${LABEL.awayRecap}, show`);
  const shown = b.text();
  const at = shown.indexOf(LABEL.awayRecap);
  assert.ok(at > shown.findIndex((l) => l.startsWith('A trodden green'))); // the log's last entry
  // Arrivals at 11:00 on days 1 to 7 and leavings at 15:00 on days 1 to 6, less rainy day 6; then
  // the status line's weather, where the log ends.
  assert.deepEqual(shown.slice(at + 1, at + 4), [
    'Tam arrives. (6 times)',
    'Tam leaves. (5 times)',
    '☀︎ drought',
  ]);
});

// Breaks: the showcase authors a threshold of two real minutes or less, so a short absence collapses.
test('two real minutes away shows no recap', () => {
  assert.ok(
    !away(2 * 60 * 1000)
      .text()
      .includes(LABEL.awayRecap),
  );
});

// Breaks: opening a save drains a head start before the Book subscribes, so the Book misses it: a
// capped absence falls short of the threshold and Tam's lines are gone, so no recap ever shows.
test('a year closed and a real reopen: one recap of the capped day', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-recap-reopen-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle as never);
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'south' } });
  a.sql.close();
  const r = elapsedHost(path, { wall: 10000 + 365 * 86_400_000, mono: 0 }, bundle as never);
  const b = book(bundle as never, r);
  assert.equal(b.game.view().view.time, 25200); // opening settled nothing the Book would miss
  for (let n = 0; pulse(b).kind === 'catching_up'; n++) assert.ok(n < 100, 'never settled');
  assert.equal(b.game.view().view.time, 111600);
  assert.equal(b.text().filter((l) => l.startsWith(LABEL.awayRecap)).length, 1);
  b.tap(`${LABEL.awayRecap}, show`);
  const shown = b.text();
  const at = shown.indexOf(LABEL.awayRecap);
  assert.deepEqual(shown.slice(at + 1, at + 3), ['Tam arrives.', 'Tam leaves.']);
  r.sql.close();
});
