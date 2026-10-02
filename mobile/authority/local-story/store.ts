// The local Story save in SQLite (07 §9; 03 §§14-15; ADR-072; 10 §§31-32): the current state as
// rows, the head (revision, clock, RNG), the save's identity and pin, and the command receipts.
// The row schema is the implementation's (ADR-072: "the per-row schema is an R2+ design task").
// Every write is one transaction opened and committed here, never by a driver helper (mobile
// lessons).
import { encode, type Json } from '../../../kernel/ts/src/canonical.ts';
import { target } from '../../../kernel/ts/src/compose.ts';
import type { DecisionResult, StoryPointReport } from '../../../kernel/ts/src/contracts.gen.ts';
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
CREATE TABLE IF NOT EXISTS observation (record TEXT NOT NULL) STRICT;
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

/** The identity's receipt scope and replay ids are UUIDs (03 §14), its binding a string or null. */
const whole = (m: Record<string, Json>) =>
  [m.lineage_id, m.run_id].every((v) => !validate('StoryRunId', v).length) &&
  (typeof m.binding === 'string' || m.binding === null);

/**
 * The saved world, revision and identity; with no save, `fresh` saved whole at revision 0 under
 * the identity `first()` allocates. Undefined when the head, a row or the identity does not parse
 * or lacks a field play relies on: the head's numbers, the receipt scope and replay ids (03 §14),
 * the binding (null: a guest) (OFF-07). A corrupt save is reported, never replaced by `fresh`.
 */
export function load(db: Db, fresh: World, first: () => Meta) {
  // Inside one, a read would take this handle's own uncommitted rows as saved (03 §15).
  if (db.isInTransactionSync()) throw new Error('a transaction is open; outcome unknown');
  // Classified before any table is created: empty only when no table holds progress (the trace
  // is derived); a missing head or identity beside surviving rows or receipts is corrupt.
  const table = (t: string) => db.getFirstSync('SELECT 1 FROM sqlite_master WHERE name = ?', t);
  const any = (t: string) => !!table(t) && !!db.getFirstSync(`SELECT 1 FROM ${t} LIMIT 1`);
  const [head, save] = ['head', 'save'].map(any);
  if (!head && !save && !['state_row', 'receipt'].some(any)) {
    const meta = first();
    const saved = replace(db, fresh, meta);
    if (!saved) throw new Error('outcome of the first save unknown; reopen the story');
    return { world: fresh, revision: 0, meta };
  }
  // Half a save (rows or receipts without their table too): never taken for a new one, unwritten.
  if (!head || !save || !['state_row', 'receipt'].every(table)) return undefined;
  db.execSync(SCHEMA); // a whole save: adds only a derived table it lacks (trace, report, observation)
  // ponytail: a corrupt receipt page fails here, at open, only on the path to its first row.
  db.getFirstSync('SELECT * FROM receipt LIMIT 1'); // the table, not its index
  type Head = { revision?: number; clock?: number; rng?: string };
  const h = db.getFirstSync<Head>('SELECT * FROM head')!; // any columns: a damaged one is corrupt
  const m = db.getFirstSync<Record<string, Json>>('SELECT * FROM save')!;
  // Only sections with rows, so a world that never wrote one keeps its state hash (decision.ts).
  const state: Record<string, Record<string, unknown>> = { containers: {} };
  type Row = { section: string; key: string; value: string };
  if (typeof h.revision !== 'number' || typeof h.clock !== 'number' || !whole(m)) return undefined;
  try {
    for (const r of db.getAllSync<Row>('SELECT section, key, value FROM state_row'))
      (state[r.section] ??= {})[r.key] = JSON.parse(r.value);
    const rng = JSON.parse(h.rng!);
    const [parent, seed, pin] = [m.parent, m.seed, m.pin].map((v) => JSON.parse(v as string));
    if ([rng, seed].some((r) => validate('RngState', r).length)) return undefined; // no RNG state
    const world = { ...fresh, state: { ...state, clock: h.clock, rng } as World['state'] };
    return { world, revision: h.revision, meta: { ...m, parent, seed, pin } as Meta };
  } catch (e) {
    if (e instanceof SyntaxError) return undefined;
    throw e;
  }
}

// ponytail: SQLite's own messages for SQLITE_NOTADB and SQLITE_CORRUPT, as node:sqlite reports
// them; expo-sqlite's wording is checked on the phone (S6b), its error codes if it differs.
/**
 * True when SQLite reports the file is not a database or a page of it corrupt (OFF-07); not its
 * "malformed JSON", a damaged value in an intact file.
 */
export const corrupt = (e: unknown) => /file is not a database|malformed(?! JSON)/.test(String(e));

/**
 * Makes the save `fresh` at revision 0 under the identity `meta`, with no receipts, in one
 * transaction (a first save or a new game; one save per story), as `transaction` reports. The
 * identity and head tables are recreated, whatever shape a corrupt save left them in; reports stay
 * (23 §11), unless their table or its index is corrupt: that throws as `corrupt` (OFF-07).
 */
export function replace(db: Db, fresh: World, meta: Meta): boolean {
  return transaction(db, () => {
    db.execSync(`DROP TABLE IF EXISTS save; DROP TABLE IF EXISTS head; ${SCHEMA}`);
    // integrity_check, not quick_check: quick_check misses a malformed index record.
    const check = db.getAllSync<{ integrity_check: string }>('PRAGMA integrity_check(report)');
    if (check.length !== 1 || check[0]!.integrity_check !== 'ok')
      throw new Error(`report table malformed: ${JSON.stringify(check)}`);
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

/**
 * The save row's format and pin, read before anything else (no table is created): none with no
 * save row; pin undefined when it does not parse.
 */
export function identityOf(db: Db) {
  if (!db.getFirstSync("SELECT 1 FROM sqlite_master WHERE name = 'save'")) return undefined;
  const m = db.getFirstSync<{ format: string; run_id?: string; pin: string }>('SELECT * FROM save'); // any columns
  if (!m) return undefined;
  let pin: Meta['pin'] | undefined;
  try {
    pin = JSON.parse(m.pin);
  } catch {}
  return { format: m.format, run_id: m.run_id, pin };
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
 * A story point report captured with its gameplay commit (23 §§4-5; 03 §26): the payload, the
 * originating lineage and its run's account/profile binding (null: a guest). A
 * host record outside `state_row`, so never in the canonical state, and kept by a new game
 * (23 §11).
 */
export type Captured = { report: StoryPointReport; lineage_id: string; binding: string | null };

/**
 * Commits one decision in one transaction (03 §15): for an accepted one the rows its delta
 * wrote, the revision, clock and RNG of `next`, and its pending story point reports; always the
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
export function rollback(db: Db): boolean {
  try {
    db.execSync('ROLLBACK');
  } catch {}
  try {
    return !db.isInTransactionSync();
  } catch {
    return false; // a broken connection: unknown
  }
}
