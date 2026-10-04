import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { constants } from 'node:sqlite';
import { accounted } from './elapsed-store.ts';
import { openStory } from './authority.ts';
import { openGame } from './session.ts';
import { checkpoint, elapsedHost, receipts } from '../../../kernel/ts/test/elapsed_host.ts';
import type { GameSubscription, Intent } from '../../packages/game-view/session.ts';
import { INSTALLED, loadCartridge, newWorld } from '../../../kernel/ts/src/index.ts';
const LOOK: Intent = { action_key: 'look' as never, target_ids: [], input: {} };

// Breaks: multiplying safe inputs first rounds a representable quotient/residue, or drops the old target.
test('base1000 accounting preserves exact safe boundary quotients and rejects target overflow', () => {
  const row = { run_id: 'run', wall_ms: 0, remainder: 0, target: 0 };
  for (const [d, rate, target, remainder] of [
    [9007199254740991, 999, 8998192055486250, 9],
    [9007199254740991, 1000, 9007199254740991, 0],
    [1, 9007199254740991, 9007199254740, 991],
    [1000, 9007199254740991, 9007199254740991, 0],
  ])
    assert.deepEqual(accounted(row, d!, rate!, 0), { ...row, target, remainder });
  assert.throws(() => accounted({ ...row, target: 1 }, 1000, 9007199254740991, 0), /safe integer/);
  for (const [d, rate, wall] of [
    [-1, 50, 10000],
    [0, 0, 10000],
    [0, 50, NaN],
  ])
    assert.throws(() => accounted(row, d!, rate!, wall!), /invalid elapsed clock evidence/);
  assert.deepEqual(accounted({ ...row, target: 68400 }, 20, 50, 20), {
    ...row,
    wall_ms: 20,
    target: 68401,
  });
});

// Breaks: fraction-only saves create fake receipts or reopening loses the fractional account.
test('9ms and reopened 11ms commit one unit and preserve the durable fractional account', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-elapsed-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db'),
    a = elapsedHost(path);
  a.clock.wall = 10009;
  a.clock.mono = 9;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 10009, remainder: 450, target: 64800 });
  assert.equal(receipts(a.sql), 0);
  a.sql.close();
  const b = elapsedHost(path, { wall: 10009, mono: 9 });
  b.clock.wall = 10020;
  b.clock.mono = 20;
  assert.equal(b.game.pulse().kind, 'ready');
  assert.equal(b.game.view().view.time, 64801);
  assert.deepEqual(checkpoint(b.sql), { wall_ms: 10020, remainder: 0, target: 64801 });
  assert.equal(receipts(b.sql), 1);
  b.sql.close();
});

// Breaks: a backward wall anchor is never persisted, so a later forward gap is lost.
test('negative wall resume rebases without credit then credits the next 20ms', () => {
  const a = elapsedHost();
  a.clock.wall = 9000;
  assert.equal(a.game.pulse('resume').kind, 'ready');
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 9000, remainder: 0, target: 64800 });
  assert.equal(receipts(a.sql), 0);
  a.clock.wall = 9020;
  assert.equal(a.game.pulse('resume').kind, 'ready');
  assert.equal(a.game.view().view.time, 64801);
  a.sql.close();
});

// Breaks: one large advance skips recurring reschedules after the first departure.
test('a fixed 36hour horizon commits all four daily boundaries in order', () => {
  const a = elapsedHost();
  const seen: number[] = [];
  a.game.subscribe((u) => {
    if (u.kind === 'state') seen.push(u.projection.view.time);
  });
  a.clock.wall += 2592000;
  a.clock.mono = 2592000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.deepEqual([...new Set(seen)], [64800, 68400, 108000, 154800, 194400]);
  assert.equal(receipts(a.sql), 4);
  assert.equal(
    a.game.view().view.entities.some((e) => e.id === 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2'),
    true,
  );
  a.sql.close();
});

// Breaks: a turn drains unbounded work or later samples extend/starve the retained current input.
test('sixteen segments yield and one reserved input completes at its original finite horizon', () => {
  const a = elapsedHost(),
    updates: GameSubscription[] = [];
  a.game.subscribe((u) => updates.push(u));
  a.clock.wall += 15984000;
  a.clock.mono = 15984000;
  const press = { ...LOOK, target_ids: [], input: {}, view_freshness_token: a.game.view().token };
  const reply = a.game.invoke(press);
  assert.equal(reply.kind, 'catching_up');
  const id = a.game.pendingInvocation();
  assert.equal(a.game.view().view.time, 712800);
  assert.equal(receipts(a.sql), 16);
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 15994000, remainder: 0, target: 864000 });
  press.target_ids.push('dddddddd-0000-4000-8000-000000000001' as never);
  (press.input as any).direction = { nested: 'mutated' };
  a.clock.wall += 100000;
  a.clock.mono += 100000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.time, 864000);
  const completed = updates.filter((u) => u.kind === 'completion');
  assert.equal(completed.length, 1);
  assert.equal(completed[0]!.invocation_id, id);
  assert.equal(completed[0]!.before.view.time, 864000);
  assert.equal(completed[0]!.reply.kind, 'saved');
  assert.equal(a.game.pending(), false);
  assert.deepEqual(completed[0]!.intent.target_ids, []);
  assert.deepEqual(Object.keys(completed[0]!.intent.input), []);
  assert.equal(a.game.invoke(LOOK).kind, 'saved');
  a.game.pulse('drain');
  assert.equal(updates.filter((u) => u.kind === 'completion').length, 1);
  a.sql.close();
});

// Breaks: prerequisite elapsed revisions cause self-stale refusal instead of semantic presence revalidation.
test('a current choice crossing departure refuses presence while Leave still closes its continuation', () => {
  const a = elapsedHost();
  assert.equal(
    a.game.invoke({ action_key: 'lantern' as never, target_ids: [], input: {} }).kind,
    'saved',
  );
  assert.equal(
    a.game.invoke({
      action_key: 'take' as never,
      target_ids: ['6a70d262-b6ea-8b64-9809-ec7f79d1521e' as never],
      input: {},
    }).kind,
    'saved',
  );
  assert.equal(
    a.game.invoke({
      action_key: 'bram' as never,
      target_ids: ['ff864ad5-cd56-80c8-9392-dc88bdc28fd2' as never],
      input: {},
    }).kind,
    'saved',
  );
  const { view, token } = a.game.view();
  a.clock.wall += 72000;
  a.clock.mono += 72000;
  const reply = a.game.invoke({
    action_key: 'choose' as never,
    target_ids: [],
    input: { choice_id: 'carry' as never, continuation_id: view.choice!.continuation_id },
    view_freshness_token: token,
  });
  assert.equal(reply.kind, 'saved');
  assert.equal(
    reply.kind === 'saved' && reply.decision.kind === 'rejected' && reply.decision.error.code,
    'not_present',
  );
  assert.equal(a.game.view().view.choice?.closable, true);
  const close = a.game.invoke({
    action_key: 'close_choice' as never,
    target_ids: [],
    input: {},
    view_freshness_token: a.game.view().token,
  });
  assert.equal(
    close.kind === 'saved' && close.decision.kind === 'accepted' && close.decision.outcome,
    'choice_closed',
  );
  assert.equal(a.game.view().view.choice, undefined);
  a.sql.close();
});

// Breaks: a preexisting stale press reserves time, or a synchronous success also emits completion.
test('preexisting stale input does not account time and synchronous success emits no completion', () => {
  const a = elapsedHost(),
    updates: GameSubscription[] = [];
  a.game.subscribe((u) => updates.push(u));
  const stale = a.game.view().token;
  a.clock.wall += 20;
  a.clock.mono += 20;
  a.game.pulse();
  a.clock.wall += 20;
  a.clock.mono += 20;
  assert.equal(a.game.invoke({ ...LOOK, view_freshness_token: stale }).kind, 'stale_view');
  assert.equal(a.game.view().view.time, 64801);
  assert.equal(a.game.invoke(LOOK).kind, 'saved');
  assert.equal(
    updates.some((u) => u.kind === 'completion'),
    false,
  );
  a.sql.close();
});

// Breaks: a v2 explicit authority advance adopts a head beyond its checkpoint target; a missing v2 row is upgraded silently.
test('trusted explicit v2 advance raises its durable target and missing checkpoints refuse', () => {
  const a = elapsedHost();
  const loaded = loadCartridge(
    new TextEncoder().encode(
      `{"cartridge":${a.bundle.canonical},"content_hash":"${a.bundle.sha256}"}`,
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const fresh = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const story = openStory(a.db, [{ content_hash: a.bundle.sha256, fresh }], {
    ...a.host,
    time: undefined,
  });
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  assert.equal(
    story.elapsed({ expected_run_id: story.runId(), from: 64800, until: 64801 }).kind,
    'saved',
  );
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 10000, remainder: 0, target: 64801 });
  a.sql.exec('DELETE FROM elapsed');
  assert.throws(
    () => openGame(a.db, a.bundle, a.host),
    (e: any) => e.cause.kind === 'save_corrupt',
  );
  a.sql.close();
});

// Breaks: missing clocks silently freeze an opted-in managed session or initialize an invented anchor.
test('an elapsed managed session without clocks fails with a typed refusal', () => {
  const a = elapsedHost();
  assert.throws(
    () => openGame(a.db, a.bundle, { ...a.host, time: undefined }),
    (e: any) => e.cause.kind === 'elapsed_clock_missing',
  );
  a.sql.close();
});

// Breaks: resume bases a new horizon on the lagging head and erases already-accounted debt.
test('resume extends durable target debt rather than a lagging head', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-elapsed-debt-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db'),
    a = elapsedHost(path);
  a.sql.exec('UPDATE head SET clock = 68390; UPDATE elapsed SET target = 68400');
  a.sql.close();
  const b = elapsedHost(path, { wall: 10020, mono: 20 });
  assert.deepEqual(checkpoint(b.sql), { wall_ms: 10020, remainder: 0, target: 68401 });
  assert.equal(b.game.view().view.time, 68401);
  assert.equal(receipts(b.sql), 2);
  b.sql.close();
});

// Breaks: terminal corrupt metadata remains pending forever, accepts input, or resets automatically.
test('unexpected closed checkpoint evidence blocks play as corrupt until confirmed Start over', () => {
  const a = elapsedHost();
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.clock.wall = 9000;
  assert.equal(a.game.pulse('resume').kind, 'pending');
  assert.equal(a.game.invoke(LOOK).kind, 'pending');
  const completions: GameSubscription[] = [];
  a.game.subscribe((u) => {
    if (u.kind === 'completion') completions.push(u);
  });
  a.fault.reads = false;
  a.sql.exec('UPDATE elapsed SET remainder = 1000');
  const status = a.game.pulse('resume');
  assert.equal(status.kind === 'error' && status.reason, 'save_corrupt');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].kind === 'completion' && completions[0].reply.kind, 'save_corrupt');
  assert.equal(a.game.invoke(LOOK).kind, 'save_corrupt');
  assert.equal(a.game.view().view.time, 64800);
  assert.equal(receipts(a.sql), 0);
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 9000, remainder: 1000, target: 64800 });
  a.game.pulse();
  assert.equal(receipts(a.sql), 0);
  assert.equal(a.game.newGame().kind, 'replaced');
  const recovered = openGame(a.db, a.bundle, a.host);
  assert.equal(recovered.view().view.time, 64800);
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 9000, remainder: 0, target: 64800 });
  a.sql.close();
});

// Breaks: an unknown old account overwrites a valid replacement save or calls its old receipt a corruption.
test('a valid durable replacement invalidates an old fenced clock and input without writes', () => {
  const a = elapsedHost();
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.clock.wall = 9000;
  assert.equal(a.game.pulse('resume').kind, 'pending');
  a.fault.reads = false;
  const other = openGame(a.db, a.bundle, a.host);
  assert.equal(other.newGame().kind, 'replaced');
  openGame(a.db, a.bundle, a.host);
  assert.equal(a.game.pulse().kind, 'replaced');
  assert.equal(a.game.invoke(LOOK).kind, 'stale_view');
  assert.equal(a.game.newGame().kind, 'stale_view');
  assert.equal(receipts(a.sql), 0);
  assert.equal(
    a.sql.prepare('SELECT run_id FROM save').get()!.run_id,
    'aaaaaaaa-0000-4000-8000-000000000004',
  );
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 9000, remainder: 0, target: 64800 });
  a.sql.close();
});

// Breaks: v2 row bounds/run/head corruption is used as elapsed evidence or repaired by another initialization.
test('malformed v2 checkpoints and heads refuse without rewriting their progress', () => {
  for (const change of [
    'ALTER TABLE elapsed DROP COLUMN target',
    'UPDATE elapsed SET remainder = 1000',
    'UPDATE elapsed SET target = 64799',
    "UPDATE elapsed SET run_id = 'bbbbbbbb-0000-4000-8000-000000000001'",
    'UPDATE elapsed SET wall_ms = 9007199254740992',
    'UPDATE head SET clock = -1',
    'UPDATE head SET revision = -1',
    'UPDATE head SET clock = 9007199254740992',
    'UPDATE head SET revision = 9007199254740992',
    'PRAGMA ignore_check_constraints = ON; UPDATE elapsed SET one = 2',
    'PRAGMA ignore_check_constraints = ON; UPDATE elapsed SET one = 9007199254740992',
  ]) {
    const a = elapsedHost();
    a.sql.exec(change);
    assert.throws(
      () => openGame(a.db, a.bundle, a.host),
      (e: any) => e.cause.kind === 'save_corrupt',
    );
    assert.equal(receipts(a.sql), 0);
    a.sql.close();
  }
});

// Breaks: a same-pin v1 upgrade credits an unobserved earlier gap or uses an invented old anchor.
test('a managed v1 upgrade starts its durable account at the actual opening clocks', () => {
  const a = elapsedHost();
  a.sql.exec("UPDATE save SET format = 'loka-save-v1'; DROP TABLE elapsed");
  a.clock.wall = 500000;
  a.clock.mono = 1234;
  const upgraded = openGame(a.db, a.bundle, a.host);
  assert.equal(upgraded.view().view.time, 64800);
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 500000, remainder: 0, target: 64800 });
  assert.equal(receipts(a.sql), 0);
  a.sql.close();
});

// Breaks: positive unknown-COMMIT reconciliation adopts malformed elapsed evidence or stays pending forever.
test('a committed unknown elapsed segment with corrupt checkpoint completes its input as blocked', () => {
  const a = elapsedHost(),
    updates: GameSubscription[] = [];
  a.game.subscribe((u) => updates.push(u));
  a.clock.wall += 72000;
  a.clock.mono += 72000;
  a.fault.kind = 'lost';
  a.fault.armed = true;
  assert.equal(a.game.invoke(LOOK).kind, 'pending');
  assert.equal(receipts(a.sql), 1);
  a.fault.reads = false;
  a.sql.exec('UPDATE elapsed SET remainder = 1000');
  const status = a.game.pulse();
  assert.equal(status.kind === 'error' && status.reason, 'save_corrupt');
  assert.equal(a.game.view().view.time, 64800);
  assert.equal(receipts(a.sql), 1);
  const completed = updates.filter((u) => u.kind === 'completion');
  assert.equal(completed.length, 1);
  assert.equal(completed[0]!.reply.kind, 'save_corrupt');
  a.sql.close();
});

// Breaks: a positive segment's unknown fence reads an old receipt or writes into a real replacement run.
test('a valid replacement during unknown positive elapsed invalidates the old pending input', () => {
  const a = elapsedHost();
  a.clock.wall += 72000;
  a.clock.mono += 72000;
  a.fault.kind = 'lost';
  a.fault.armed = true;
  assert.equal(a.game.invoke(LOOK).kind, 'pending');
  a.fault.reads = false;
  const other = openGame(a.db, a.bundle, a.host);
  assert.equal(other.newGame().kind, 'replaced');
  openGame(a.db, a.bundle, a.host);
  assert.equal(a.game.pulse().kind, 'replaced');
  assert.equal(a.game.invoke(LOOK).kind, 'stale_view');
  assert.equal(a.game.newGame().kind, 'stale_view');
  assert.equal(receipts(a.sql), 0);
  assert.equal(
    a.sql.prepare('SELECT run_id FROM save').get()!.run_id,
    'aaaaaaaa-0000-4000-8000-000000000004',
  );
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 82000, remainder: 0, target: 64800 });
  a.sql.close();
});

// Breaks: callers mutate a held intent, or a different retry consumes its finite reservation.
test('a private reservation rejects another intent and retains its original bounded input', () => {
  const a = elapsedHost();
  const c = loadCartridge(
    new TextEncoder().encode(
      `{"cartridge":${a.bundle.canonical},"content_hash":"${a.bundle.sha256}"}`,
    ),
    INSTALLED,
  );
  if (!c.ok) throw new Error('test cartridge did not load');
  const story = openStory(
    a.db,
    [
      {
        content_hash: a.bundle.sha256,
        fresh: newWorld(
          c.cartridge as never,
          '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
          [1, 2, 3, 4] as never,
        ),
      },
    ],
    a.host,
  );
  if (story.kind !== 'open') throw new Error('test story did not open');
  const press = {
    ...LOOK,
    target_ids: [],
    invocation_id: 'cccccccc-0000-4000-8000-000000000001',
    actor_id: story.world().character,
    view_freshness_token: story.token(),
  };
  const retry = { ...press, target_ids: [], input: {} };
  a.clock.wall += 15984000;
  a.clock.mono += 15984000;
  assert.equal(story.invoke(press).kind, 'catching_up');
  press.target_ids.push('dddddddd-0000-4000-8000-000000000001' as never);
  assert.equal(story.invoke({ ...retry, action_key: 'wait' }).kind, 'conflict');
  const result = story.invoke(retry);
  assert.equal(result.kind, 'saved');
  assert.equal(result.kind === 'saved' && (result.decision as any).kind, 'accepted');
  assert.equal(story.world().state.clock, 864000);
  a.sql.close();
});

// Breaks: terminal upgrade recovery without a prior checkpoint replaces a save while SQLite refuses transaction closure.
test('terminal v1 upgrade recovery waits for real SQLite rollback closure before Start over', () => {
  const a = elapsedHost();
  a.sql.exec("UPDATE save SET format = 'loka-save-v1'; DROP TABLE elapsed");
  const loaded = loadCartridge(
    new TextEncoder().encode(
      `{"cartridge":${a.bundle.canonical},"content_hash":"${a.bundle.sha256}"}`,
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const fresh = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  a.fault.kind = 'lost';
  a.fault.armed = true;
  const story = openStory(a.db, [{ content_hash: a.bundle.sha256, fresh }], a.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  assert.equal(story.clockStatus().kind, 'pending');
  a.fault.reads = false;
  a.sql.exec('ALTER TABLE elapsed DROP COLUMN target');
  assert.throws(
    () => story.pulse('resume', story.runId()),
    (e: any) => e.kind === 'save_corrupt',
  );
  a.sql.exec('BEGIN; UPDATE head SET clock = 64801');
  a.sql.setAuthorizer((action, operation) =>
    action === constants.SQLITE_TRANSACTION && operation === 'ROLLBACK'
      ? constants.SQLITE_DENY
      : constants.SQLITE_OK,
  );
  assert.equal(story.newGame().kind, 'pending');
  assert.equal(a.sql.isTransaction, true);
  assert.equal(story.world().state.clock, 64800);
  assert.equal(
    a.sql.prepare('SELECT run_id FROM save').get()!.run_id,
    'aaaaaaaa-0000-4000-8000-000000000002',
  );
  assert.equal(receipts(a.sql), 0);
  a.sql.setAuthorizer(null);
  a.sql.exec('ROLLBACK');
  assert.equal(story.newGame().kind, 'replaced');
  assert.equal(
    a.sql.prepare('SELECT run_id FROM save').get()!.run_id,
    'aaaaaaaa-0000-4000-8000-000000000004',
  );
  a.sql.close();
});
