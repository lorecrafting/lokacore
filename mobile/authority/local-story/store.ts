// The local Story save in SQLite (07 §9; 03 §§14-15; ADR-072; 10 §§31-32): the current state as
// rows, the head (revision, clock, RNG), the save's identity and pin, and the command receipts.
// The row schema is the implementation's (ADR-072: "the per-row schema is an R2+ design task").
// Every write is one transaction opened and committed here, never by a driver helper (mobile
// lessons).
import { encode, type Json } from '../../../kernel/ts/src/canonical.ts';
import { target } from '../../../kernel/ts/src/compose.ts';
import type { DecisionResult, MilestoneReport } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
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
  commit_state TEXT, record TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS save (one INTEGER PRIMARY KEY CHECK (one = 1), format TEXT NOT NULL,
  lineage_id TEXT NOT NULL, run_id TEXT NOT NULL, parent TEXT NOT NULL, seed TEXT NOT NULL,
  pin TEXT NOT NULL, binding TEXT) STRICT;
CREATE TABLE IF NOT EXISTS report (report_id TEXT PRIMARY KEY, lineage_id TEXT NOT NULL,
  binding TEXT, report TEXT NOT NULL, disposition TEXT NOT NULL CHECK (disposition IN
  ('pending', 'accepted', 'rejected', 'needs_attention')), acceptance TEXT,
  tried INTEGER NOT NULL DEFAULT 0) STRICT;`;

/**
 * The save's identity (10 §§31-32; 07 §9): its lineage and run, its causal parent (null: every
 * save here is a new game), the run's initial RNG (ADR-075 seed), the release it pins and the
 * account/profile the run is bound to when it starts, never rebound (23 §§4-5, §11; null: a guest).
 */
export type Meta = {
  readonly format: string;
  readonly lineage_id: string;
  readonly run_id: string;
  readonly parent: Json;
  readonly seed: Json;
  readonly pin: { readonly content_hash: string } & Record<string, Json>;
  readonly binding: string | null;
};

const UPSERT = 'INSERT OR REPLACE INTO state_row VALUES (?, ?, ?)';
const HEAD = 'INSERT OR REPLACE INTO head VALUES (1, ?, ?, ?)';

/**
 * The saved world, revision and identity; with no save, `fresh` saved whole at revision 0 under
 * the identity `first()` allocates. Undefined when the head, a row or the identity does not parse
 * (OFF-07): a corrupt save is reported, never replaced by `fresh`.
 */
export function load(db: Db, fresh: World, first: () => Meta) {
  // Inside one, a read would take this handle's own uncommitted rows as saved (03 §15).
  if (db.isInTransactionSync()) throw new Error('a transaction is open; outcome unknown');
  db.execSync(SCHEMA);
  type Head = { revision: number; clock: number; rng: string };
  const head = db.getFirstSync<Head>('SELECT revision, clock, rng FROM head');
  const m = db.getFirstSync<Record<string, string>>('SELECT * FROM save');
  // Empty only when no table holds progress (the trace is derived): a missing head or identity
  // beside surviving rows or receipts is corrupt.
  const any = (t: string) => !!db.getFirstSync(`SELECT 1 FROM ${t} LIMIT 1`);
  if (!head && !m && !['state_row', 'receipt'].some(any)) {
    const meta = first();
    const saved = replace(db, fresh, meta);
    if (!saved) throw new Error('outcome of the first save unknown; reopen the story');
    return { world: fresh, revision: 0, meta };
  }
  if (!head || !m) return undefined; // half a save: never taken for a new one
  // Only sections with rows, so a world that never wrote one keeps its state hash (decision.ts).
  const state: Record<string, Record<string, unknown>> = { containers: {} };
  type Row = { section: string; key: string; value: string };
  try {
    for (const r of db.getAllSync<Row>('SELECT section, key, value FROM state_row'))
      (state[r.section] ??= {})[r.key] = JSON.parse(r.value);
    const rng = JSON.parse(head.rng);
    if (validate('RngState', rng).length) return undefined; // parses, but no RNG state
    const [parent, seed, pin] = [m.parent, m.seed, m.pin].map((v) => JSON.parse(v!));
    const world = { ...fresh, state: { ...state, clock: head.clock, rng } as World['state'] };
    return { world, revision: head.revision, meta: { ...m, parent, seed, pin } as Meta };
  } catch (e) {
    if (e instanceof SyntaxError) return undefined;
    throw e;
  }
}

/**
 * Makes the save `fresh` at revision 0 under the identity `meta`, with no receipts, in one
 * transaction (a first save or a new game; one save per story), as `transaction` reports.
 */
export function replace(db: Db, fresh: World, meta: Meta): boolean {
  return transaction(db, () => {
    const { clock, rng, ...sections } = fresh.state;
    db.runSync(HEAD, 0, clock, encode(rng as Json));
    db.runSync('DELETE FROM state_row');
    for (const [section, rows] of Object.entries(sections))
      for (const [key, value] of Object.entries(rows))
        db.runSync(UPSERT, section, key, encode(value));
    const { format, lineage_id, run_id, parent, seed, pin, binding } = meta;
    const json = [parent, seed, pin].map((v) => encode(v as Json));
    db.runSync(
      'INSERT OR REPLACE INTO save VALUES (1, ?, ?, ?, ?, ?, ?, ?)',
      format,
      lineage_id,
      run_id,
      ...json,
      binding,
    );
    db.runSync('DELETE FROM receipt');
  });
}

/** The pinned release of a save that does not load, if its identity row still parses. */
export function pinOf(db: Db): Meta['pin'] | undefined {
  try {
    return JSON.parse(db.getFirstSync<{ pin: string }>('SELECT pin FROM save')!.pin);
  } catch {
    return undefined;
  }
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
 * A milestone report captured with its gameplay commit (23 §§4-5; 03 §26): the payload, the
 * originating lineage and its run's account/profile binding (null: a guest). A
 * host record outside `state_row`, so never in the canonical state, and kept by a new game
 * (23 §11).
 */
export type Captured = { report: MilestoneReport; lineage_id: string; binding: string | null };

/**
 * Commits one decision in one transaction (03 §15): for an accepted one the rows its delta
 * wrote, the revision, clock and RNG of `next`, and its pending milestone reports; always the
 * receipt. Throws, with nothing written, on a definite failure; false when the outcome is
 * unknown (`transaction`; then `reconcile`). The caller adopts `next` only after this returns
 * true.
 */
export function commit(
  db: Db,
  next: World,
  decision: DecisionResult,
  r: Receipt,
  reports: Captured[],
): boolean {
  return transaction(db, () => {
    for (const c of reports)
      db.runSync(
        "INSERT INTO report (report_id, lineage_id, binding, report, disposition) VALUES (?, ?, ?, ?, 'pending')",
        c.report.report_id,
        c.lineage_id,
        c.binding,
        encode(c.report as never),
      );
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
 * `read()` (a receipt, the run id) once the outcome of a failed COMMIT is settled (03 §15), or a
 * throw while it is not. After ROLLBACK leaves the one connection outside a transaction, the
 * attempt can no longer commit, so what `read` misses is a confirmed non-commit; inside one, a
 * read would see the attempt's own uncommitted writes.
 */
export function reconcile<T>(db: Db, read: () => T): T {
  if (!rollback(db)) throw new Error('transaction still open; outcome unknown');
  return read();
}

/**
 * Runs `writes` and COMMIT in one transaction: true once committed; throws, rolled back, when a
 * write fails; false, after trying ROLLBACK, when COMMIT itself fails (not proof of rollback,
 * 03 §15) or when a failed write's ROLLBACK leaves the transaction open (its uncommitted rows
 * would read as saved). Either false is settled by `reconcile` before the next decision.
 */
export function transaction(db: Db, writes: () => void): boolean {
  // A failed trace or delivery write, or an unknown gameplay COMMIT before a delivery write, can
  // leave one open here: rolled back, as reconcile would (a delivery's acknowledgement is resent).
  if (db.isInTransactionSync()) db.execSync('ROLLBACK');
  db.execSync('BEGIN IMMEDIATE');
  try {
    writes();
  } catch (e) {
    // SQLite may already have rolled back (SQLITE_FULL); the original error is the one to raise.
    if (rollback(db)) throw e;
    return false;
  }
  try {
    db.execSync('COMMIT');
    return true;
  } catch {
    rollback(db); // a COMMIT that failed with the transaction open leaves it open
    return false;
  }
}

/** Tries ROLLBACK; true only when the connection answers that no transaction is open after it. */
function rollback(db: Db): boolean {
  try {
    db.execSync('ROLLBACK');
  } catch {}
  try {
    return !db.isInTransactionSync();
  } catch {
    return false; // a broken connection: unknown
  }
}
