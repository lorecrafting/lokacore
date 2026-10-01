// Delayed delivery of the save's milestone reports to the progress platform (23 §§4-5; 03 §26).
import { encode, hash } from '../../../kernel/ts/src/canonical.ts';
import type { MilestoneAcceptance, MilestoneReport } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { reconcile, transaction, type Db } from './store.ts';

/** The platform's answer to one report for `account` (23 §5); rejects when it is unreachable. */
export type Submit = (report: MilestoneReport, account: string) => Promise<unknown>;

/**
 * Delivers up to `limit` pending reports, least tried first, each for its run's binding (23 §5:
 * never rebound), and records the platform's answer before acknowledging it: accepted or rejected
 * as itself; a conflict, or an acceptance of another payload (its digest is not this report's), as
 * `needs_attention` (23 §4). Called by the host when connected; a transaction left open (an unknown
 * COMMIT) is settled first. Nothing is ever dropped: a rejection (offline, a malformed answer)
 * leaves the rest pending for the next call, which tries the failed report last. An unknown
 * acknowledgement stops the batch; the report is resent and the platform answers from its record.
 */
export async function deliver(db: Db, submit: Submit, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError(`batch limit ${limit}`);
  const settle = () => reconcile(db, () => undefined); // throws while one is still open
  settle();
  type Row = { report_id: string; binding: string; report: string };
  // ponytail: a guest's report (null binding) waits; claiming a run is explicit (23 §5), R12A.
  const rows = db.getAllSync<Row>(
    `SELECT report_id, binding, report FROM report WHERE disposition = 'pending'
     AND binding IS NOT NULL ORDER BY tried, rowid LIMIT ?`,
    limit,
  );
  for (const r of rows) {
    const report = JSON.parse(r.report) as MilestoneReport;
    let a: MilestoneAcceptance;
    try {
      a = answer(await submit(report, r.binding), report, r.binding);
    } catch (e) {
      const tried = 'UPDATE report SET tried = tried + 1 WHERE report_id = ?';
      transaction(db, () => db.runSync(tried, r.report_id));
      throw e;
    }
    const { result } = a;
    const mine = a.payload_digest === hash(report as never);
    const disposition =
      mine && (result === 'accepted' || result === 'rejected') ? result : 'needs_attention';
    const ack = 'UPDATE report SET disposition = ?, acceptance = ? WHERE report_id = ?';
    if (!transaction(db, () => db.runSync(ack, disposition, encode(a as never), r.report_id)))
      return settle();
  }
}

/** `a` if it is a MilestoneAcceptance of `report` for `account`; throws otherwise. */
function answer(a: unknown, report: MilestoneReport, account: string) {
  const fail = new Error(`not an acceptance of report ${report.report_id}`);
  if (validate('MilestoneAcceptance', a).length) throw fail;
  const { payload_digest, evidence_class, policy_revision, result, ...about } =
    a as MilestoneAcceptance;
  const { report_id, release, milestone, outcome } = report;
  if (encode(about) !== encode({ report_id, account_id: account, release, milestone, outcome }))
    throw fail;
  return a as MilestoneAcceptance;
}
