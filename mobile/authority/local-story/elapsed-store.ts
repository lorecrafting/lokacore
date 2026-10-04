import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
// Host evidence only: never part of the portable World/hash.
import type { Db } from './store.ts';
export type Checkpoint = { run_id: string; wall_ms: number; remainder: number; target: number };
const TABLE = `CREATE TABLE IF NOT EXISTS elapsed (one INTEGER PRIMARY KEY CHECK (one = 1),
  run_id TEXT NOT NULL, wall_ms INTEGER NOT NULL, remainder INTEGER NOT NULL,
  target INTEGER NOT NULL) STRICT`;
export const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;

export function readElapsed(db: Db, run: string, head: number): Checkpoint | undefined {
  const rows = elapsedRows(db);
  const row = rows.length === 1 ? rows[0] : undefined;
  if (
    !natural(head) ||
    validate('StoryRunId', run).length ||
    !row ||
    row.one !== 1 ||
    row.run_id !== run ||
    !natural(row.wall_ms) ||
    !natural(row.target) ||
    !natural(row.remainder) ||
    row.remainder >= 1000 ||
    row.target < head
  )
    return;
  const { one, ...checkpoint } = row;
  return checkpoint;
}
export function elapsedRows(db: Db): (Checkpoint & { one: number })[] {
  if (!db.getFirstSync('SELECT 1 FROM sqlite_master WHERE name = ?', 'elapsed')) return [];
  return db.getAllSync<Checkpoint & { one: number }>(`SELECT run_id,
    CASE WHEN typeof(one) = 'integer' THEN CAST(one AS REAL) END AS one,
    CASE WHEN typeof(wall_ms) = 'integer' THEN CAST(wall_ms AS REAL) END AS wall_ms,
    CASE WHEN typeof(remainder) = 'integer' THEN CAST(remainder AS REAL) END AS remainder,
    CASE WHEN typeof(target) = 'integer' THEN CAST(target AS REAL) END AS target FROM elapsed`);
}
export function writeElapsed(db: Db, row: Checkpoint) {
  db.execSync(TABLE);
  db.runSync(
    'INSERT OR REPLACE INTO elapsed VALUES (1, ?, ?, ?, ?)',
    row.run_id,
    row.wall_ms,
    row.remainder,
    row.target,
  );
}
export const sameCheckpoint = (a?: Checkpoint, b?: Checkpoint) =>
  a?.run_id === b?.run_id &&
  a?.wall_ms === b?.wall_ms &&
  a?.remainder === b?.remainder &&
  a?.target === b?.target;

/** Exact integer quotient/remainder without overflowing d * rate. */
export function accounted(old: Checkpoint, d: number, rate: number, wall_ms: number): Checkpoint {
  if (![d, rate, wall_ms].every(natural) || !rate)
    throw new Error('invalid elapsed clock evidence');
  const q = Math.floor(d / 1000),
    r = d % 1000;
  const a = Math.floor(rate / 1000),
    b = rate % 1000;
  const small = old.remainder + r * b;
  const whole = q * rate + r * a + Math.floor(small / 1000);
  const target = old.target + whole;
  if (![whole, target].every(natural)) throw new Error('elapsed target exceeds safe integer range');
  return { ...old, wall_ms, target, remainder: small % 1000 };
}

export function loadElapsed(db: Db, meta: { format: unknown; run_id: unknown }, head: number) {
  if (meta.format !== 'loka-save-v2') return;
  const row = readElapsed(db, meta.run_id as string, head);
  if (!row) throw new SyntaxError('malformed elapsed checkpoint');
  return row;
}

/** A closed transaction proved terminal host recovery, rather than an unknown COMMIT. */
export class ElapsedRecoveryError extends Error {
  readonly kind: 'save_corrupt' | 'stale_view';
  constructor(kind: 'save_corrupt' | 'stale_view', message: string) {
    super(message);
    this.kind = kind;
  }
}
export function changedRun(meta: { run_id?: string; pin?: unknown } | undefined, expected: string) {
  if (meta?.run_id === expected) return;
  const valid = meta?.pin && !validate('StoryRunId', meta.run_id).length;
  return new ElapsedRecoveryError(
    valid ? 'stale_view' : 'save_corrupt',
    valid ? 'save run replaced' : 'elapsed save identity malformed',
  );
}
