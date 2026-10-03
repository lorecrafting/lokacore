// The local session's Start over on node:sqlite, with a COMMIT whose acknowledgement is lost.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { localSession } from './session.ts';
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
    read('protocol/fixtures/cartridge_items_hash.json') as never,
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
