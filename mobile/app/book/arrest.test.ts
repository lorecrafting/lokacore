// Book arrest (toolbox row 35, docs/system/mechanics.md "Arrest and trial"): an arrest is an
// accepted move whose place is not the exit's destination; the World page turns to the cell and
// its log carries the move's narration, through the real authority and Book. Expected text is
// literal from cartridges/trial_sampler/text.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';

// Breaks: the move's narration is dropped with the old room's log when the place is not the
// exit's destination, the square's log survives onto the cell page, or its two records joined on
// one line (pass-1 UO), or a reopen keeping only the last record, also when the saved narration
// cannot be read back and the reply's own narration is shown.
for (const failed of [false, true])
  test(`a wanted walk north lands on the cell page with the arrest and charge lines${failed ? ' (no read-back)' : ''}`, () => {
    const trial = compiled('cartridges/trial_sampler') as never;
    const b = book(trial);
    b.go('east'); // the footer opens the shut cell door
    assert.ok(b.text().includes('You open the barred cell door.'), JSON.stringify(b.text())); // a square line to lose
    for (const c of ['the crier, open', /^Talk/, 'Confess to the theft']) b.tap(c);
    b.tap(LABEL.leaveConversation);
    b.tap(LABEL.leave);
    if (failed) b.failNarration();
    b.go('north');
    const shown = b.text();
    assert.equal(shown[0], 'Cell');
    const arm = shown.indexOf(
      'The guard takes your arm at the market gate and walks you to the cell.',
    );
    assert.ok(arm >= 0, JSON.stringify(shown)); // pass-1 UO: one log line per narration record
    assert.equal(
      shown[arm + 1],
      'The sergeant reads the charge aloud: wanted in the square. Pay the fine or sit.',
    );
    assert.ok(!shown.includes('You open the barred cell door.'), JSON.stringify(shown));
    const reopened = book(trial, { sql: b.sql, clock: b.clock } as never).text(); // a cold open
    const at = reopened.indexOf(shown[arm]);
    assert.ok(at >= 0, JSON.stringify(reopened));
    assert.deepEqual(
      reopened.slice(at, at + 2),
      shown.slice(arm, arm + 2),
      JSON.stringify(reopened),
    );
  });
