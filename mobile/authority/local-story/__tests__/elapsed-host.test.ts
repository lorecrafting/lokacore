// Controlled host clocks and real rollback-journal SQLite for elapsed integration regressions.
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { encode } from '../../../../kernel/ts/src/foundation/canonical.ts';
import { read } from '../../../../kernel/ts/test/read.ts';
import { openGame } from '../session.ts';
import type { Db } from '../store.ts';

export function elapsedBundle() {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  c.manifest.requires.kernel_api.at_least = '1.1';
  c.calendar.start = 64800;
  for (const recipe of Object.values(c.recipes) as any[]) delete recipe.duration;
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}

export function sqliteHost(
  path = ':memory:',
  clock = { wall: 10000, mono: 0 },
  kernel_version = `loka-kernel@${'0'.repeat(40)}`,
) {
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA page_size = 512');
  const fault = { kind: '' as '' | 'failed' | 'lost', armed: false, reads: false, inserted: false };
  const readFault = () => {
    if (fault.reads) sql.prepare('SELECT * FROM unavailable_elapsed_reads').get();
  };
  const db: Db = {
    execSync(q) {
      const before = sql.isTransaction;
      try {
        sql.exec(q);
      } catch (e) {
        if (fault.armed && before) {
          fault.armed = false;
          fault.reads = true;
        }
        throw e;
      }
      if (fault.armed && fault.kind === 'lost' && before && !sql.isTransaction) {
        fault.armed = false;
        fault.reads = true;
        throw new Error('lost COMMIT acknowledgement');
      }
    },
    runSync(q, ...p) {
      if (fault.armed && fault.kind === 'failed' && !fault.inserted) {
        fault.inserted = true;
        sql.exec('INSERT INTO child VALUES (1)'); // real deferred constraint: COMMIT fails
      }
      return sql.prepare(q).run(...p);
    },
    getFirstSync<T>(q: string, ...p: (string | number | null)[]) {
      readFault();
      return (sql.prepare(q).get(...p) ?? null) as T | null;
    },
    getAllSync<T>(q: string, ...p: (string | number | null)[]) {
      readFault();
      return sql.prepare(q).all(...p) as T[];
    },
    isInTransactionSync: () => sql.isTransaction,
  };
  let n = 0;
  const host = {
    kernel_version,
    newId: () => `aaaaaaaa-0000-4000-8000-${(++n).toString().padStart(12, '0')}`,
    time: { wall: () => clock.wall, monotonic: () => clock.mono },
  };
  return { sql, db, host, clock, fault };
}

export function elapsedHost(
  path = ':memory:',
  clock = { wall: 10000, mono: 0 },
  bundle = elapsedBundle(),
  kernel_version = `loka-kernel@${'0'.repeat(40)}`,
) {
  const p = sqliteHost(path, clock, kernel_version);
  return { ...p, bundle, game: openGame(p.db, bundle, p.host) };
}

export const checkpoint = (sql: DatabaseSync) => ({
  ...sql.prepare('SELECT wall_ms, remainder, target FROM elapsed').get(),
});
export const receipts = (sql: DatabaseSync) =>
  sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
