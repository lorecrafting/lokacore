// Aimed spells in the Book (loka-x6t.109.5, book-ui.md Word bar): a Cast a spell… list on each
// target's page, a Cast on… list per spell on Character, and one under each live foe's line.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// The showcase with flamma and lux known from the start, the game starting in a lit crypt beside the wight (8 hp,
// one flamma kills it) and the lantern, with `ash` ash for lux. `den` starts in the goblin den
// instead, with flamma's wight-only policy negated so each goblin offers it.
function cartridge(ash = 0, den = false, luxCooldown = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-cast-pick-'));
  const source = new URL('../../../cartridges/toolbox_showcase', import.meta.url);
  const edit = (file: string, change: (json: any) => void) => {
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    change(json);
    writeFileSync(join(dir, file), JSON.stringify(json));
  };
  try {
    cpSync(fileURLToPath(source), dir, { recursive: true });
    edit('facts.json', (j) => {
      j.facts.known_here = { ...j.facts.lux_known, value_type: { type: 'bool', default: true } };
    });
    for (const spell of ['flamma', 'lux'])
      edit(`recipes/${spell}.json`, (j) => (j.target.learned = 'known_here'));
    edit('cartridge.json', (j) => (j.entry = den ? 'chief_den' : 'crypt'));
    if (den)
      edit('recipes/flamma.json', (j) => (j.policy.root = { op: 'not', item: j.policy.root }));
    if (luxCooldown) edit('recipes/lux.json', (j) => (j.cooldown = luxCooldown));
    edit('resources.json', (j) => (j.resources.ash.start = ash));
    edit('rooms/crypt.json', (j) => delete j.dark_description);
    edit('items/lantern.json', (j) => (j.location.room = 'crypt'));
    return compiled(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

const FLAMMA = 'You speak flamma and a bolt of fire leaps from your hand and burns the wight.';

// Breaks: the aimed spell drawn as a generic card or a chip, or a pick that names no target.
test("the wight's Cast a spell… lists Flamma alone; the pick opens the fight", (t) => {
  const b = book(cartridge() as never);
  t.after(() => b.sql.close());
  b.tap('Say to the room');
  assert.ok(!b.labels().some((l) => /flamma|lux/i.test(l)), 'no aimed spell chip');
  b.tap('wight, open');
  assert.ok(!b.labels().some((l) => /^Flamma/.test(l)), 'no card before the list opens');
  b.tap('Cast a spell…');
  assert.deepEqual(
    b.labels().filter((l) => / on /.test(l)),
    ['Flamma, cast flamma on a wight'],
  );
  const sent: any[] = [];
  const invoke = b.game.invoke.bind(b.game);
  b.game.invoke = (...a: any[]) => (sent.push(a[0]), invoke(...(a as [any])));
  b.tap('Flamma, cast flamma on a wight');
  const wight = b.game.view().view.combat!.opponent_id;
  assert.deepEqual([sent[0].action_key, sent[0].target_ids], ['flamma', [wight]]);
  assert.ok(b.p.screen().combatLog.includes(FLAMMA));
});

// Breaks: a foe line with no list, a fight cast that turns to World or logs on World (book-ui.md,
// Live combat response), another target's spell on the foe line, or a dead foe that keeps its list.
test('a foe line casts on the Combat page, into its log, until the foe dies', (t) => {
  const b = book(cartridge(1) as never);
  t.after(() => b.sql.close());
  b.tap('lantern, open');
  b.tap('Take the lantern'); // lux is offered on the held lantern, never on the foe line
  b.tap('wight, open');
  b.tap('Attack a wight');
  assert.ok(!b.labels().includes('Lux, cast on…'), "only the foe's own spells on its line");
  b.tap('Cast a spell…');
  b.tap('Flamma, cast flamma on a wight'); // the wight lives: the fight goes on
  assert.ok(b.game.view().view.combat && b.text().includes('Combat'), 'still the Combat page');
  assert.ok(b.p.screen().combatLog.includes(FLAMMA));
  assert.ok(!b.p.screen().log.includes(FLAMMA));
  b.tap('Cast a spell…');
  b.tap('Flamma, cast flamma on a wight');
  assert.ok(b.labels().includes('Back to World'), 'the closed fight keeps its page');
  assert.ok(!b.labels().includes('Cast a spell…'), 'the dead wight has no list');
});

// Breaks: no Cast on… on Character, a pick that stays on Character or loses its line, a refused
// row without its reason, or a Spells-section line for an aimed spell.
test("Character's Cast on… lists a spell's targets; the pick turns to World with its line", (t) => {
  const b = book(cartridge(1) as never);
  t.after(() => b.sql.close());
  b.tap('lantern, open');
  b.tap('Take the lantern');
  const character = () => (b.tap(/opens Contents/), b.tap('Character, open'));
  character();
  assert.ok(!b.text().some((l) => /, cast:/.test(l)), 'no Spells-section line');
  b.tap('Lux, cast on…');
  b.tap('The lantern, cast lux on the lantern');
  assert.ok(b.labels().includes('The crypt, look'), 'back on World');
  assert.ok(b.text().includes('You speak lux and the ash flares.'));
  character();
  b.tap('Lux, cast on…');
  assert.ok(b.text().includes('The lantern: need 1 ash'), b.text().join(' | '));
  b.tap(/opens Contents/);
  b.tap('Inventory, open');
  b.tap(/lantern/);
  b.tap('Cast a spell…');
  assert.ok(b.text().includes('Lux: need 1 ash'), b.text().join(' | '));
});

// Breaks: one list per foe line each with its own open state, so two lists open at once
// (book-ui.md Pick list: one list open at a time).
test("opening a second foe's Cast a spell… closes the first", (t) => {
  const b = book(cartridge(0, true) as never);
  t.after(() => b.sql.close());
  b.tap('two goblins, open');
  b.tap(/^Attack/);
  const options = () => b.draw().filter((n) => n.props?.accessibilityLabel === 'Cast a spell…');
  assert.equal(options().length, 2, b.labels().join(' | '));
  options()[0].props.onPress();
  options()[1].props.onPress();
  const rows = b.labels().filter((l) => l === 'Flamma, cast flamma on a goblin');
  assert.equal(rows.length, 1, b.labels().join(' | '));
});

// Breaks: a resting aimed spell drawn twice on its target's page, as a refusal note and as its row.
test('a resting spell is its Cast a spell… row alone, no refusal note', (t) => {
  const b = book(cartridge(2, false, 600) as never);
  t.after(() => b.sql.close());
  b.tap('lantern, open');
  b.tap('Take the lantern');
  const lantern = () => (b.tap(/opens Contents/), b.tap('Inventory, open'), b.tap(/lantern/));
  lantern();
  b.tap('Cast a spell…');
  b.tap('Lux, cast lux on the lantern');
  lantern();
  b.tap('Cast a spell…');
  assert.deepEqual(
    b.text().filter((l) => l.startsWith('Lux:')),
    ['Lux: not yet'],
    b.text().join(' | '),
  );
});
