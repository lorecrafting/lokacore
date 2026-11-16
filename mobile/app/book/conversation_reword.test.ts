// An open conversation re-words its lines when the author's words change (author preview, E5;
// loka-wfrgk.19): the page keeps its place and its choice, only the words move.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { bind, tagged } from '../author/prose_rules.ts';
import { book, bundle } from './__tests__/polish-book.test.ts';
import { worded } from './words.ts';

const KEY = 'dialogue.bram_offer.prompt';
const FILLED = 'Bram squints at you. "Bring my lantern?"';

// Old Bram's open conversation over a text lookup the test overlays, as panel.tsx's `played` does:
// overlay first, a `~` tagged.
function talking(t: TestContext, preview: boolean) {
  const overlay: Record<string, string> = { [KEY]: '~' };
  const seen = new Map<string, string>();
  if (preview) {
    worded.note = (words, key) => bind(seen, words, key);
    worded.made = new Map();
  }
  t.after(() => ((worded.note = undefined), (worded.made = undefined)));
  const h = book(bundle('containers_sampler_v010_hash'));
  t.after(() => (h.unmount(), h.sql.close()));
  const text = h.game.text;
  h.game.text = (key: string) => tagged(key, overlay[key] ?? text(key)!);
  h.tap('Old Bram');
  h.tap('Talk to Old Bram');
  const at = () => ({
    choice: h.game.view().view.choice?.continuation_id,
    labels: h.labels(),
    lines: h.text().length,
  });
  return { h, overlay, seen, at };
}

// Breaks: the conversation keeps the words it was composed with (a DetailLine is a string), so a
// saved edit shows only after Leave and Talk again; or the re-worded line is not registered, so
// Enter on it finds no key; or re-wording moves the page or drops the choice.
test('an edited line in an open conversation shows its new words in place', (t) => {
  const { h, overlay, seen, at } = talking(t, true);
  const placeholder = tagged(KEY, '~');
  assert.ok(h.text().includes(placeholder));
  const before = at();
  assert.ok(before.choice);
  overlay[KEY] = FILLED;
  assert.ok(h.text().includes(FILLED));
  assert.ok(!h.text().includes(placeholder));
  assert.equal(seen.get(FILLED), KEY);
  assert.deepEqual(at(), before);
});

// Breaks: Cmd-Z puts the old words back in the overlay but the page keeps the edit's.
test('Cmd-Z puts the old words back in an open conversation', (t) => {
  const { h, overlay } = talking(t, true);
  overlay[KEY] = FILLED;
  assert.ok(h.text().includes(FILLED));
  overlay[KEY] = '~';
  assert.ok(h.text().includes(tagged(KEY, '~')));
  assert.ok(!h.text().includes(FILLED));
});

// Breaks: a player build (no author preview, `worded.made` unset) re-composes its lines.
test('a player build keeps the words a line was spoken with', (t) => {
  const { h, overlay } = talking(t, false);
  overlay[KEY] = FILLED;
  assert.ok(h.text().includes(tagged(KEY, '~')));
  assert.ok(!h.text().includes(FILLED));
});
