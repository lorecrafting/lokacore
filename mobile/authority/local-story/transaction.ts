// One connection's closed-transaction confirmation boundary.
import type { Db } from './store.ts';

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
