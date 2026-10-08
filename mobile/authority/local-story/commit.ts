// One decision's commit: its changed rows, head, story point reports and receipt in one transaction.
import { encode, type Json } from '../../../kernel/ts/src/foundation/canonical.ts';
import { target } from '../../../kernel/ts/src/foundation/compose.ts';
import type { DecisionResult, StoryPointReport } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { row } from '../../../kernel/ts/src/runtime/world.ts';
import type { Checkpoint } from './elapsed-store.ts';
import { HEAD, UPSERT, persistElapsed, transaction, type Db, type Receipt } from './store.ts';

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
  elapsed?: Checkpoint,
): boolean {
  return transaction(db, () => {
    if (elapsed) persistElapsed(db, elapsed);
    for (const c of reports)
      db.runSync(
        "INSERT INTO report (report_id, lineage_id, binding, report, disposition) VALUES (?, ?, ?, ?, 'pending')",
        c.report.report_id,
        c.lineage_id,
        c.binding,
        encode(c.report as never),
      );
    if (decision.kind === 'accepted') writeDelta(db, next, decision, r.revision);
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

// The head and exactly the state rows the accepted delta wrote (a retired quest's row deleted).
function writeDelta(
  db: Db,
  next: World,
  decision: Extract<DecisionResult, { kind: 'accepted' }>,
  revision: number,
) {
  db.runSync(HEAD, revision, next.state.clock, encode(next.state.rng as Json));
  for (const op of decision.delta.ops) {
    const [section, key] = row(target(op)) ?? [];
    if (op.op === 'quest.retire')
      db.runSync('DELETE FROM state_row WHERE section=? AND key=?', section!, key!);
    else if (section) db.runSync(UPSERT, section, key!, encode(next.state[section]![key!] as Json));
  }
}
