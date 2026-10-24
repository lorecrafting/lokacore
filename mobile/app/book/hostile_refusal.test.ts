// Book hostile refusal (loka-x6t.33, docs/system/book-ui.md): a hostile NPC's page shows its
// cartridge refusal line, or the Book's fallback, in place of Talk, Ask about and the shelf, through
// the real authority and Book. Expected text is literal from the samplers' text.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';
import { lineText } from './words.ts';

const showcase = compiled('cartridges/toolbox_showcase');
// Nell's page on the Low Wardle green, after calling the Reeve a cheat (standing 0 to -2) or not.
function nell(cheat: boolean) {
  const b = book(showcase as never);
  b.map();
  b.tap('Go south');
  if (cheat) {
    for (const c of ['Reeve, open', /^Talk/, 'Call him a cheat']) b.tap(c);
    b.tap(LABEL.leaveConversation);
    b.tap(LABEL.leave);
  }
  b.tap('Nell, open');
  return [b.text(), b.labels()] as const;
}

// Breaks: the page ignores hostility (the shelf with its raw "invalid state" reasons stays; the
// kernel refuses Talk), shows the fallback over the authored line, or marks Nell hostile at standing 0; the shelf
// shows raw reason codes.
test('Nell at standing -2 shows her refusal line, no Talk or Trade; at 0 she trades', () => {
  const [shown, labels] = nell(true);
  assert.ok(shown.includes('Nell turns her back on you.'), JSON.stringify(shown));
  assert.ok(!shown.some((l) => /invalid state|Buy \d|Nothing to do here/.test(l)));
  assert.ok(!labels.some((l) => l.startsWith('Talk')), JSON.stringify(labels));
  assert.ok(!labels.includes(LABEL.trade), JSON.stringify(labels));
  assert.ok(labels.includes(LABEL.leave));
  const [calm, calmLabels] = nell(false);
  assert.ok(!calm.includes('Nell turns her back on you.'));
  assert.ok(calmLabels.includes(LABEL.trade), JSON.stringify(calmLabels));
  assert.ok(calmLabels.some((l) => l.startsWith('Talk')));
});

// Breaks: a buy leaves the buy page, its line shows on the page or misses the room log, the purse does not
// redraw, Sell does not open the sell page, or a refused buy shows its raw code ("not owned"), not a word (Nell's one cob, bought);
// a sale leaves the sell page, does not redraw the purse, or keeps the sold row.
test('a buy keeps the buy page: its line, the new purse, the row refused in words', () => {
  const b = book(showcase as never);
  b.map();
  b.tap('Go south');
  for (const c of ['Nell, open', LABEL.trade]) b.tap(c);
  const purse = (t: string[]) => t.find((l) => /^You have \d+p\.$/.test(l));
  const before = purse(b.text());
  b.tap('Cob of bread — 4p');
  const shown = b.text();
  assert.equal(shown[0], 'Nell, the baker can sell you…', JSON.stringify(shown));
  assert.ok(shown.includes('Cob of bread — 4p: sold out'), JSON.stringify(shown));
  assert.ok(before && purse(shown) && purse(shown) !== before, JSON.stringify([before, shown]));
  assert.ok(!shown.some((l) => l.startsWith('You buy')), 'the own buy is quiet on the buy page');
  const bought = b.p.screen().log.filter((l) => lineText(l) === 'You buy a cob of bread.');
  assert.equal(bought.length, 1, 'the buy line lands in the room log once, naming the item');
  b.tap(LABEL.sell); // the sell page lists the bought cob with its price (owner pick mvlynyikyw57)
  assert.equal(b.text()[0], 'Nell, the baker will buy…', JSON.stringify(b.text()));
  assert.ok(b.labels().includes('Cob of bread — 1p'), JSON.stringify(b.labels()));
  const held = purse(b.text());
  b.tap('Cob of bread — 1p'); // a sale keeps the sell page, redraws the purse, drops the row (owner 2026-10-23)
  const sold = b.text();
  assert.equal(sold[0], 'Nell, the baker will buy…', JSON.stringify(sold));
  assert.ok(held && purse(sold) && purse(sold) !== held, JSON.stringify([held, sold]));
  assert.ok(!b.labels().includes('Cob of bread — 1p'), JSON.stringify(b.labels()));
  b.tap(LABEL.leave);
  assert.equal(b.text()[0], 'Nell, the baker can sell you…');
  b.tap(LABEL.leave);
  assert.equal(b.text()[0], 'Nell, the baker');
});

// Breaks: a talk that turns its NPC hostile (Bess, insulted) shows the refusal Note over the open
// conversation.
test('an insult mid-talk keeps the conversation page, no refusal Note', () => {
  const b = book(showcase as never);
  for (const s of ['Go south', 'Go south']) {
    b.map();
    b.tap(s);
  }
  for (const c of [/^Bess/, /^Talk/, 'Insult the village']) b.tap(c);
  const shown = b.text();
  assert.ok(shown.includes('Bess scowls and turns to her next customer, as she will every time.'));
  assert.ok(
    !shown.includes('Bess turns to her barrel and does not look up.'),
    JSON.stringify(shown),
  );
});

// Breaks (loka-x6t.21): a multi-choice showcase talk draws an authored Leave beside the foot's own.
test('a multi-choice talk has no authored Leave; the foot Leave the conversation ends it', () => {
  const b = book(showcase as never);
  for (const s of ['Go south', 'Go south']) {
    b.map();
    b.tap(s);
  }
  for (const c of [/^Bess/, /^Talk/]) b.tap(c);
  const labels = b.labels();
  assert.ok(labels.includes('Insult the village'), JSON.stringify(labels));
  assert.equal(labels.filter((l) => /^(Leave|Close)\b/.test(l)).join(), LABEL.leaveConversation);
  b.tap(LABEL.leaveConversation);
  assert.equal(b.labels().includes('Insult the village'), false);
});
