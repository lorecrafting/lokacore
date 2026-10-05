# Owner decision: fresh preproduction preview games, 2026-10-04

Context: the owner reported Bram leaving, being unable to find him, and repeated
“The page had changed; here it is again.” during room moves. The repeated stale message was
traced to live-clock revision churn, separately from NPC movement/visibility diagnosis.
[Book live action freshness](../system/book-ui.md#live-action-freshness) governs that UI repair.

Owner direction (paraphrased): while builds change quickly in preproduction, preview play may
start from a fresh game for each build. Returning to an earlier build's savepoint is unnecessary.

This clarifies [pre-production compatibility](owner-decision-preproduction-compatibility-2026-10-04.md).
Old preview saves require no continuity, migration, backup or compatibility adapter across builds.
Within the current build, durable save, retry and reopen correctness remain required, together
with safe mismatch refusal and explicit confirmed Start over. This direction authorizes fresh
preview games, not silent save deletion or changes to the running owner's preview.
