// The local session's Start over on node:sqlite, with a COMMIT whose acknowledgement is lost.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { localSession, openGame } from './session.ts';
import { elapsedHost, checkpoint, receipts } from './__tests__/elapsed-host.test.ts';
import type { Db } from './store.ts';

type P = (string | number | null)[];

// Breaks (review F-1): a retry of a pending Start over that fails for a real reason still tells the
// player "start over not confirmed" (the stale code wins over the message in SaveError).
test('a pending start over whose retry fails shows that error, not "not confirmed"', () => {
  const sql = new DatabaseSync(':memory:');
  let stage = 0; // 1: the next COMMIT fails with an unknown outcome; 2: every read fails; 3: every write fails
  const guard = <T>(s: string, run: () => T): T => {
    if (stage === 3 && !s.startsWith('SELECT')) throw new Error('disk I/O error');
    if (stage === 2 && s.startsWith('SELECT')) throw new Error('read failed');
    if (stage === 1 && s === 'COMMIT') {
      stage = 2;
      throw new Error('COMMIT outcome unknown'); // not committed
    }
    return run();
  };
  const db: Db = {
    execSync: (s) => void guard(s, () => sql.exec(s)),
    isInTransactionSync: () => sql.isTransaction,
    runSync: (s, ...p: P) => guard(s, () => sql.prepare(s).run(...p)),
    getFirstSync: <T>(s: string, ...p: P) =>
      guard(s, () => sql.prepare(s).get(...p) ?? null) as T | null,
    getAllSync: <T>(s: string, ...p: P) => guard(s, () => sql.prepare(s).all(...p)) as T[],
  };
  const c = localSession(
    () => db,
    () => {},
    read('protocol/fixtures/containers_cartridge_items_hash.json') as never,
    {
      newId: randomUUID,
      kernel_version: `loka-kernel@${'0'.repeat(40)}`,
    },
  );
  stage = 1;
  c.startOver();
  assert.equal(c.failed()?.code, 'start_over_pending');
  stage = 3; // the retry meets a real error
  c.startOver();
  assert.deepEqual([c.failed()?.message, c.failed()?.code], ['disk I/O error', undefined]);
});

// Breaks: a different identified action during catch-up consumes the retained action's result or drops it.
test('catch-up conflicts preserve the original attempt and matching retries keep its identity', () => {
  const a = elapsedHost();
  const look = { action_key: 'look' as never, target_ids: [], input: {} };
  a.clock.wall += 15984000;
  a.clock.mono += 15984000;
  assert.equal(a.game.invoke(look).kind, 'catching_up');
  const id = a.game.pendingInvocation();
  assert.equal(
    a.game.invoke({ action_key: 'lantern' as never, target_ids: [], input: {} }).kind,
    'conflict',
  );
  assert.equal(a.game.pendingInvocation(), id);
  assert.equal(a.game.view().view.time, 712800);
  assert.equal(receipts(a.sql), 16);
  assert.equal(a.game.invoke({ ...look, view_freshness_token: a.game.view().token }).kind, 'saved');
  assert.equal(a.game.view().view.time, 864000);
  assert.equal(
    a.sql.prepare('SELECT count(*) AS n FROM receipt WHERE invocation_id = ?').get(id!)!.n,
    1,
  );
  assert.equal(a.game.invoke(look).kind, 'saved');
  a.sql.close();
});

// Breaks: snapshotting unvalidated/cyclic input throws, or invalid input accounts time before admission.
test('invalid and cyclic shared input refuses before snapshot or elapsed sampling', () => {
  const a = elapsedHost();
  const cyclic: any = {};
  cyclic.direction = cyclic;
  a.clock.wall += 20;
  a.clock.mono += 20;
  for (const press of [
    null,
    { action_key: 'look', target_ids: [], input: cyclic },
    { action_key: 'look', target_ids: [], input: { direction: 7 } },
    {
      action_key: 'look',
      target_ids: Array(9).fill('dddddddd-0000-4000-8000-000000000001'),
      input: {},
    },
  ])
    assert.equal(a.game.invoke(press as never).kind, 'invalid');
  assert.equal(a.game.pending(), false);
  assert.equal(receipts(a.sql), 0);
  assert.deepEqual(checkpoint(a.sql), { wall_ms: 10000, remainder: 0, target: 64800 });
  a.sql.close();
});

// Breaks: closed missing-column checkpoint evidence remains pending or cannot recover by explicit Start over.
test('missing elapsed columns after unknown metadata or gameplay commit block and permit explicit recovery', () => {
  for (const [mode, wall, mono] of [
    ['metadata', 9000, 0],
    ['gameplay', 82000, 72000],
  ] as const) {
    const a = elapsedHost();
    a.clock.wall = wall;
    a.clock.mono = mono;
    a.fault.kind = 'lost';
    a.fault.armed = true;
    assert.equal(a.game.pulse(mode === 'metadata' ? 'resume' : 'active').kind, 'pending');
    a.fault.reads = false;
    a.sql.exec('ALTER TABLE elapsed DROP COLUMN target');
    const status = a.game.pulse();
    assert.equal(status.kind === 'error' && status.reason, 'save_corrupt');
    assert.equal(a.game.view().view.time, 64800);
    assert.equal(
      a.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'save_corrupt',
    );
    assert.equal(a.game.newGame().kind, 'replaced');
    assert.equal(openGame(a.db, a.bundle, a.host).view().view.time, 64800);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: wall, remainder: 0, target: 64800 });
    assert.equal(receipts(a.sql), 0);
    a.sql.close();
  }
});

// Breaks: an old corrupt-save recovery offer erases a replacement, or treats a changed malformed header as its original save.
test('corrupt elapsed recovery binds valid, malformed, and absent original headers without erasing a replacement', () => {
  for (const original of ['valid', 'malformed', 'format', 'absent']) {
    const a = elapsedHost();
    a.sql.exec('ALTER TABLE elapsed DROP COLUMN target');
    if (original === 'malformed') a.sql.exec("UPDATE save SET run_id = 'bad-run-1'");
    if (original === 'format') a.sql.exec("UPDATE save SET format = 'broken-format'");
    if (original === 'absent') a.sql.exec('DELETE FROM save');
    const refusal = () => {
      let cause: any;
      assert.throws(
        () => openGame(a.db, a.bundle, a.host),
        (e: any) => {
          cause = e.cause;
          return cause.kind === 'save_corrupt';
        },
      );
      return cause;
    };
    const old = refusal();
    a.game.pulse('resume');
    if (original === 'malformed') {
      a.sql.exec("UPDATE save SET run_id = 'bad-run-2'");
      assert.equal(old.newGame().kind, 'save_corrupt');
      assert.equal(a.sql.prepare('SELECT run_id FROM save').get()!.run_id, 'bad-run-2');
    }
    assert.equal(refusal().newGame().kind, 'replaced');
    const replacement = openGame(a.db, a.bundle, a.host);
    assert.equal(
      replacement.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'saved',
    );
    a.fault.reads = true;
    assert.equal(old.newGame().kind, 'pending');
    a.fault.reads = false;
    assert.equal(old.newGame().kind, 'stale_view');
    assert.equal(a.game.newGame().kind, 'stale_view');
    assert.equal(
      a.sql.prepare('SELECT run_id FROM save').get()!.run_id,
      'aaaaaaaa-0000-4000-8000-000000000004',
    );
    assert.equal(receipts(a.sql), 1);
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 10000, remainder: 0, target: 64800 });
    a.sql.close();
  }
});

// Breaks: loaded elapsed recovery accepts arbitrary same-run format drift and overwrites a newer or malformed save.
test('loaded elapsed recovery refuses newer and malformed same-run formats without writes', () => {
  for (const [format, kind] of [
    ['loka-save-v3', 'unsupported_save_format'],
    ['broken-format', 'save_corrupt'],
    ['loka-save-v1', 'save_corrupt'],
  ]) {
    const a = elapsedHost();
    assert.equal(
      a.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'saved',
    );
    a.sql.prepare('UPDATE save SET format = ?').run(format!);
    assert.equal(a.game.newGame().kind, kind);
    assert.deepEqual(
      { ...a.sql.prepare('SELECT format, run_id FROM save').get() },
      { format, run_id: 'aaaaaaaa-0000-4000-8000-000000000002' },
    );
    assert.deepEqual(
      { ...a.sql.prepare('SELECT revision, clock FROM head').get() },
      { revision: 1, clock: 64800 },
    );
    assert.deepEqual(checkpoint(a.sql), { wall_ms: 10000, remainder: 0, target: 64800 });
    assert.equal(receipts(a.sql), 1);
    if (format === 'loka-save-v3') {
      const c = localSession(
        () => a.db,
        () => assert.fail('must not remove a readable save'),
        a.bundle,
        a.host,
      );
      assert.equal(c.failed()?.kind, 'unsupported_save_format');
      assert.equal(c.failed()?.startOver, false);
    }
    a.sql.close();
  }
});

// Breaks: a changed malformed header with valid different run/pin is classified as a valid replacement.
test('changed refused elapsed header classifies malformed before differing valid run and preserves newer formats', () => {
  const a = elapsedHost();
  a.sql.exec('ALTER TABLE elapsed DROP COLUMN target');
  let old: any;
  assert.throws(
    () => openGame(a.db, a.bundle, a.host),
    (e: any) => {
      old = e.cause;
      return old.kind === 'save_corrupt';
    },
  );
  a.sql.exec(
    "UPDATE save SET format = 'broken-format', run_id = 'bbbbbbbb-0000-4000-8000-000000000001'",
  );
  assert.equal(old.newGame().kind, 'save_corrupt');
  assert.deepEqual(
    { ...a.sql.prepare('SELECT format, run_id FROM save').get() },
    { format: 'broken-format', run_id: 'bbbbbbbb-0000-4000-8000-000000000001' },
  );
  a.sql.exec("UPDATE save SET format = 'loka-save-v3'");
  assert.equal(old.newGame().kind, 'unsupported_save_format');
  assert.equal(a.sql.prepare('SELECT format FROM save').get()!.format, 'loka-save-v3');
  assert.deepEqual(
    { ...a.sql.prepare('SELECT revision, clock FROM head').get() },
    { revision: 0, clock: 64800 },
  );
  assert.equal(receipts(a.sql), 0);
  a.sql.close();
});
