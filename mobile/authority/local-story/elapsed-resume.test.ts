import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkpoint, elapsedHost, receipts } from './__tests__/elapsed-host.test.ts';
import type { GameSubscription, Intent } from '../../packages/game-view/session.ts';
const LOOK: Intent = { action_key: 'look' as never, target_ids: [], input: {} };

// Breaks: reconciling an older fractional candidate consumes resume, so frozen Mono loses absence.
// Invalid/stale preflight must not consume the armed evidence either.
test('resumed wall survives fractional reconciliation and invalid/stale preflight before a new input', () => {
  const a = elapsedHost();
  try {
    const stale = a.game.view().token;
    assert.equal(a.game.invoke(LOOK).kind, 'saved');
    a.clock.wall = 10001;
    a.clock.mono = 1;
    a.fault.kind = 'lost';
    a.fault.armed = true;
    assert.equal(a.game.pulse().kind, 'pending');
    assert.equal(a.game.pulse('pause').kind, 'pending');
    a.clock.wall = 11001;
    assert.equal(a.game.pulse('resume').kind, 'pending');
    a.fault.reads = false;
    a.clock.wall = NaN; // Sampling this controlled evidence would fail, even for zero credit.
    assert.equal(a.game.invoke({ ...LOOK, view_freshness_token: stale }).kind, 'stale_view');
    assert.equal(a.game.invoke({ ...LOOK, target_ids: [0] as never }).kind, 'invalid');
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 10001, remainder: 50, target: 64800 });
    assert.equal(receipts(a.sql), 1);
    a.clock.wall = 11001;
    assert.equal(a.game.invoke(LOOK).kind, 'saved');
    assert.equal(a.game.view().view.time, 64850);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 11001, remainder: 50, target: 64850 });
    assert.equal(receipts(a.sql), 3);
  } finally {
    a.sql.close();
  }
});

// Breaks: a failed prerequisite candidate freezes A to its old horizon, or prerequisite drain
// and the new seventeen-boundary horizon share an unbounded turn.
test('a new reservation waits for its actual resumed horizon and yields after sixteen boundaries', () => {
  const a = elapsedHost();
  try {
    a.sql.exec(
      'PRAGMA foreign_keys = ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
    );
    a.clock.wall = 10001;
    a.clock.mono = 1;
    a.fault.kind = 'failed';
    a.fault.armed = true;
    assert.equal(a.game.pulse().kind, 'pending');
    a.clock.wall = 15994001;
    assert.equal(a.game.pulse('resume').kind, 'pending');
    a.fault.reads = false;
    const reply = a.game.invoke(LOOK);
    assert.equal(reply.kind, 'catching_up');
    const id = a.game.pendingInvocation();
    assert.equal(a.game.view().view.time, 64800);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 10001, remainder: 50, target: 64800 });
    assert.equal(receipts(a.sql), 0);
    assert.equal(a.game.pulse().kind, 'catching_up');
    assert.equal(a.game.pendingInvocation(), id);
    assert.equal(a.game.view().view.time, 712800);
    assert.equal(receipts(a.sql), 16);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 15994001, remainder: 50, target: 864000 });
    assert.equal(a.game.pulse('drain').kind, 'ready');
    assert.equal(a.game.view().view.time, 864000);
    assert.equal(a.game.pending(), false);
  } finally {
    a.sql.close();
  }
});

// Breaks: the pending-A shortcut drops a resume request, extends A, or returns A's result as B.
test('resume remains armed after fixed A completes and another intent cannot steal its result', () => {
  const a = elapsedHost(),
    updates: GameSubscription[] = [];
  a.game.subscribe((u) => updates.push(u));
  try {
    a.clock.wall += 15984000;
    a.clock.mono = 15984000;
    assert.equal(a.game.invoke(LOOK).kind, 'catching_up');
    const id = a.game.pendingInvocation();
    a.clock.wall += 1000; // JS was inactive: Mono remains at its old value.
    assert.equal(a.game.invoke({ ...LOOK, action_key: 'rest' as never }).kind, 'conflict');
    assert.equal(a.game.pendingInvocation(), id);
    assert.equal(a.game.pulse('resume').kind, 'ready');
    assert.equal(a.game.view().view.time, 864000);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 15994000, remainder: 0, target: 864000 });
    const terminal = updates.filter((u) => u.kind === 'completion');
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0].invocation_id, id);
    assert.equal(terminal[0].intent.action_key, 'look');
    assert.equal(terminal[0].before.view.time, 864000);
    assert.equal(a.game.pulse().kind, 'ready');
    assert.equal(a.game.view().view.time, 864050);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 15995000, remainder: 0, target: 864050 });
    assert.equal(updates.filter((u) => u.kind === 'completion').length, 1);
  } finally {
    a.sql.close();
  }
});
