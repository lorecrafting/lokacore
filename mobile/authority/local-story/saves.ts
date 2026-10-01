// Bookmarks and recovery checkpoints (10 §31; 07 §9): immutable canonical copies of the whole
// state, each with its sha256, in the save's one database beside the head, so taking one and
// restoring one are each one transaction. ADR-072 point 5 allows a full checkpoint only for
// export or backup: a bookmark the player asks for and the recovery copy taken before a restore
// are backups; none is ever taken on the action path or on a timer.
import { encode, type Json } from '../../../kernel/ts/src/canonical.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { sha256Hex, utf8 } from '../../../kernel/ts/src/sha256.ts';
import { transaction, writeState, type Db, type Meta } from './store.ts';

export type Kind = 'bookmark' | 'recovery';
/** A snapshot's content: the whole state at `revision` of the run it was taken in. */
export type Snapshot = {
  readonly lineage_id: string;
  readonly run_id: string;
  readonly revision: number;
  readonly state: World['state'];
};

export const bytesOf = (s: Snapshot) => encode(s as never);
const sha = (bytes: string) => sha256Hex(utf8(bytes));
const ROW = 'SELECT bytes, sha256 FROM snapshot WHERE kind = ? AND slot = ?';
const RECOVERY_CAP = 3; // 10 §31: bounded recovery checkpoints under a documented quota

export const occupied = (db: Db, slot: number) =>
  !!db.getFirstSync("SELECT 1 FROM snapshot WHERE kind = 'bookmark' AND slot = ?", slot);

/** Writes bookmark `slot` in one transaction, as `transaction` reports. */
export const writeBookmark = (db: Db, slot: number, label: string, bytes: string) =>
  transaction(db, () => {
    const q = 'INSERT OR REPLACE INTO snapshot VALUES (?, ?, ?, ?, ?)';
    db.runSync(q, 'bookmark', slot, label, bytes, sha(bytes));
  });

/** Snapshot `kind` `slot`: its content, or why there is none to restore. */
function read(db: Db, kind: Kind, slot: number): Snapshot | 'save_corrupt' | 'missing' {
  const r = db.getFirstSync<{ bytes: string; sha256: string }>(ROW, kind, slot);
  if (!r) return 'missing';
  return sha(r.bytes) === r.sha256 ? (JSON.parse(r.bytes) as Snapshot) : 'save_corrupt';
}

/** The snapshots whose bytes verify (OFF-07: offered to the player; none is adopted here). */
export function verifying(db: Db) {
  type Row = { kind: Kind; slot: number; label: string | null };
  const all = db.getAllSync<Row>('SELECT kind, slot, label FROM snapshot ORDER BY kind, slot');
  return all.filter((r) => typeof read(db, r.kind, r.slot) === 'object');
}

/**
 * Makes snapshot `kind` `slot` the head, as the new run `ids` (format, lineage, run, pin) forked
 * from the snapshot's run at its revision (10 §31), in one transaction that first keeps `checkpoint` (the head being left)
 * as the newest recovery checkpoint and then evicts the oldest beyond the cap, so the copy just
 * taken is never the one evicted. 'save_corrupt' or 'missing' with nothing written; otherwise as
 * `transaction` reports.
 */
export function restoreFrom(
  db: Db,
  kind: Kind,
  slot: number,
  ids: Meta,
  checkpoint?: string,
): boolean | 'save_corrupt' | 'missing' {
  try {
    return transaction(db, () => {
      const snap = read(db, kind, slot);
      if (typeof snap === 'string') throw snap; // rolled back, then returned below
      if (checkpoint) keep(db, checkpoint);
      writeState(db, snap.revision, snap.state);
      const { lineage_id, run_id, revision } = snap;
      db.runSync(
        'INSERT OR REPLACE INTO save VALUES (1, ?, ?, ?, ?, ?, ?)',
        ids.format,
        ids.lineage_id,
        ids.run_id,
        encode({ lineage_id, run_id, revision }),
        encode(snap.state.rng as Json),
        encode(ids.pin),
      );
    });
  } catch (e) {
    if (e === 'save_corrupt' || e === 'missing') return e;
    throw e;
  }
}

/** Keeps `checkpoint` as the newest recovery checkpoint, then evicts the oldest beyond the cap. */
function keep(db: Db, checkpoint: string) {
  db.runSync(
    `INSERT INTO snapshot SELECT 'recovery', coalesce(max(slot), 0) + 1, NULL, ?, ?
        FROM snapshot WHERE kind = 'recovery'`,
    checkpoint,
    sha(checkpoint),
  );
  db.runSync(
    `DELETE FROM snapshot WHERE kind = 'recovery'
        AND slot <= (SELECT max(slot) FROM snapshot WHERE kind = 'recovery') - ?`,
    RECOVERY_CAP,
  );
}
