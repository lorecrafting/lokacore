// The local Story save in SQLite (07 §9; 03 §§14-15; ADR-072): the current state as rows, the
// head (revision, clock, RNG) and the command receipts. The row schema is the implementation's
// (ADR-072: "the per-row schema is an R2+ design task"). Every write is one transaction opened
// and committed here, never by a driver helper (mobile lessons).
import { encode, type Json } from '../../../kernel/ts/src/canonical.ts';
import { target } from '../../../kernel/ts/src/compose.ts';
import type { DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { row } from '../../../kernel/ts/src/world.ts';

/** expo-sqlite's synchronous database methods, the only ones used; one handle per process. */
export type Db = {
  execSync(sql: string): void;
  runSync(sql: string, ...params: (string | number | null)[]): unknown;
  getFirstSync<T>(sql: string, ...params: (string | number | null)[]): T | null;
  getAllSync<T>(sql: string, ...params: (string | number | null)[]): T[];
  isInTransactionSync(): boolean;
};

/** A command receipt (03 §14): the original intent, resolved command and stable response. */
export type Receipt = {
  readonly scope: string;
  readonly invocation_id: string;
  readonly command_id: string;
  readonly actor_id: string;
  readonly intent_digest_version: string;
  readonly intent_digest: string;
  readonly command: Json; // null for a rejection before a Command existed
  readonly revision: number; // unchanged for a rejection
  readonly response: Json;
};

// ponytail: no created_at, origin_authority_id or separate semantic/result digests yet (the
// stored command and response carry them); add each with its first reader (sync, S5).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS head (one INTEGER PRIMARY KEY CHECK (one = 1),
  revision INTEGER NOT NULL, clock INTEGER NOT NULL, rng TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS state_row (section TEXT NOT NULL, key TEXT NOT NULL,
  value TEXT NOT NULL, PRIMARY KEY (section, key)) STRICT, WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS receipt (scope TEXT NOT NULL, invocation_id TEXT NOT NULL,
  command_id TEXT NOT NULL, actor_id TEXT NOT NULL, intent_digest_version TEXT NOT NULL,
  intent_digest TEXT NOT NULL, command TEXT NOT NULL, revision INTEGER NOT NULL,
  response TEXT NOT NULL, PRIMARY KEY (scope, invocation_id), UNIQUE (scope, command_id)) STRICT;
CREATE TABLE IF NOT EXISTS trace (ordinal INTEGER NOT NULL, command_id TEXT,
  commit_state TEXT, record TEXT NOT NULL) STRICT;`;

const UPSERT = 'INSERT OR REPLACE INTO state_row VALUES (?, ?, ?)';
const HEAD = 'INSERT OR REPLACE INTO head VALUES (1, ?, ?, ?)';

/** The saved world and revision, or `fresh` saved whole at revision 0 when there is none. */
export function load(db: Db, fresh: World): { world: World; revision: number } {
  // Inside one, a read would take this handle's own uncommitted rows as saved (03 §15).
  if (db.isInTransactionSync()) throw new Error('a transaction is open; outcome unknown');
  db.execSync(SCHEMA);
  type Head = { revision: number; clock: number; rng: string };
  const head = db.getFirstSync<Head>('SELECT revision, clock, rng FROM head');
  if (!head) {
    const { clock, rng, ...sections } = fresh.state;
    const saved = transaction(db, () => {
      db.runSync(HEAD, 0, clock, encode(rng as Json));
      for (const [section, rows] of Object.entries(sections))
        for (const [key, value] of Object.entries(rows))
          db.runSync(UPSERT, section, key, encode(value));
    });
    if (!saved) throw new Error('outcome of the first save unknown; reopen the story');
    return { world: fresh, revision: 0 };
  }
  // Only sections with rows, so a world that never wrote one keeps its state hash (decision.ts).
  const state: Record<string, Record<string, unknown>> = { containers: {} };
  type Row = { section: string; key: string; value: string };
  for (const r of db.getAllSync<Row>('SELECT section, key, value FROM state_row'))
    (state[r.section] ??= {})[r.key] = JSON.parse(r.value);
  const rng = JSON.parse(head.rng);
  const world = { ...fresh, state: { ...state, clock: head.clock, rng } as World['state'] };
  return { world, revision: head.revision };
}

/** The receipt of `invocation_id` in `scope`, if one was committed. */
export function receipt(db: Db, scope: string, invocation_id: string): Receipt | undefined {
  const r = db.getFirstSync<Record<string, string | number>>(
    'SELECT * FROM receipt WHERE scope = ? AND invocation_id = ?',
    scope,
    invocation_id,
  );
  return r
    ? ({
        ...r,
        command: JSON.parse(r.command as string),
        response: JSON.parse(r.response as string),
      } as Receipt)
    : undefined;
}

/**
 * Commits one decision in one transaction (03 §15): for an accepted one the rows its delta
 * wrote, the revision, clock and RNG of `next`; always the receipt. Throws, with nothing written,
 * on a definite failure; false when COMMIT itself failed, whose outcome is unknown (reconcile).
 * The caller adopts `next` only after this returns true.
 */
export function commit(db: Db, next: World, decision: DecisionResult, r: Receipt): boolean {
  return transaction(db, () => {
    if (decision.kind === 'accepted') {
      db.runSync(HEAD, r.revision, next.state.clock, encode(next.state.rng as Json));
      for (const op of decision.delta.ops) {
        const [section, key] = row(target(op)) ?? [];
        if (section) db.runSync(UPSERT, section, key!, encode(next.state[section]![key!] as Json));
      }
    }
    db.runSync(
      'INSERT INTO receipt VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      r.scope,
      r.invocation_id,
      r.command_id,
      r.actor_id,
      r.intent_digest_version,
      r.intent_digest,
      encode(r.command),
      r.revision,
      encode(r.response),
    );
  });
}

/**
 * The receipt of `invocation_id` once the outcome of a failed COMMIT is settled (03 §15), or a
 * throw while it is not. After ROLLBACK leaves the one connection outside a transaction, the
 * attempt can no longer commit, so a missing receipt is a confirmed non-commit; inside one, a
 * read would see the attempt's own uncommitted receipt.
 */
export function reconcile(db: Db, scope: string, invocation_id: string): Receipt | undefined {
  try {
    db.execSync('ROLLBACK');
  } catch {} // none open: SQLite ended it, committed or not
  if (db.isInTransactionSync()) throw new Error('transaction still open; outcome unknown');
  return receipt(db, scope, invocation_id);
}

/**
 * Runs `writes` and COMMIT in one transaction: true once committed; throws, rolled back, when a
 * write fails; false when COMMIT itself fails, since that is not proof of rollback (03 §15), after
 * trying ROLLBACK so no transaction stays open.
 */
export function transaction(db: Db, writes: () => void): boolean {
  db.execSync('BEGIN IMMEDIATE');
  try {
    writes();
  } catch (e) {
    // SQLite may already have rolled back (SQLITE_FULL); the original error is the one to raise.
    try {
      db.execSync('ROLLBACK');
    } catch {}
    throw e;
  }
  try {
    db.execSync('COMMIT');
    return true;
  } catch {
    try {
      db.execSync('ROLLBACK'); // a COMMIT that failed with the transaction open leaves it open
    } catch {}
    return false;
  }
}
