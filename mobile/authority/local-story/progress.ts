// Delayed delivery of the save's milestone reports to the progress platform (23 §§4-5; 03 §26).
import { encode } from '../../../kernel/ts/src/canonical.ts';
import type { MilestoneAcceptance, MilestoneReport } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { transaction, type Db } from './store.ts';

/** The platform's answer to one report for `account` (23 §5); rejects when it is unreachable. */
export type Submit = (report: MilestoneReport, account: string) => Promise<unknown>;

/**
 * Delivers up to `limit` pending reports, oldest first, each for the binding it was captured
 * under (23 §5: never rebound), and records the platform's answer before acknowledging it: an
 * accepted or rejected result as itself, a conflict as `needs_attention` (23 §4). Called by the
 * host when connected, outside any transaction; nothing is ever dropped, and a throw (offline, a
 * malformed answer) leaves the rest pending for the next call. An unknown acknowledgement commit
 * is resent, and the platform answers it again from its own record.
 */
export async function deliver(db: Db, submit: Submit, limit: number) {
  if (db.isInTransactionSync()) throw new Error('a transaction is open; outcome unknown');
  type Row = { report_id: string; binding: string; report: string };
  // ponytail: a guest's report (null binding) waits; claiming a run is explicit (23 §5), R12A.
  const rows = db.getAllSync<Row>(
    `SELECT report_id, binding, report FROM report WHERE disposition = 'pending'
     AND binding IS NOT NULL ORDER BY rowid LIMIT ?`,
    limit,
  );
  for (const r of rows) {
    const report = JSON.parse(r.report) as MilestoneReport;
    const a = (await submit(report, r.binding)) as MilestoneAcceptance;
    const fail = new Error(`not an acceptance of report ${r.report_id}`);
    if (validate('MilestoneAcceptance', a).length) throw fail;
    // The answer is about this report and account: all but the platform's own fields match.
    const { payload_digest, evidence_class, policy_revision, result, ...about } = a;
    const { report_id, release, milestone, outcome } = report;
    if (encode(about) !== encode({ report_id, account_id: r.binding, release, milestone, outcome }))
      throw fail;
    const disposition = result === 'accepted' || result === 'rejected' ? result : 'needs_attention';
    transaction(db, () =>
      db.runSync(
        'UPDATE report SET disposition = ?, acceptance = ? WHERE report_id = ?',
        disposition,
        encode(a as never),
        r.report_id,
      ),
    );
  }
}
