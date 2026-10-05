# Owner decision: one independent reviewer by default — 2026-10-04

The owner asked whether mechanics PRs could proceed without reviews to save tokens and
time, then accepted the PM's recommendation: “Okay lets go with your suggestion and
directly modify the workflow.md”. The recommendation was one fresh independent review
per mechanics PR, with a second opinion only for save, protocol, foundation and gate
risks. This record supersedes the routine second Sol review selected in
[autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md)
and the older everyday cross-vendor default; it does not remove independent review.

[The delivery workflow](../WORKFLOW.md) now requires a separate second opinion
when a change alters save/reconciliation behavior, protocol or portable foundation
contracts, `kernel/ts/src/runtime/proposal.ts`, or closes a milestone gate. The PM may
add one for a concrete risk raised by the first review. Small content, copy and docs
PRs receive a short review. Prefer a second vendor when available. Tests, red controls
where applicable, exact-head CI,
review dispositions and merge-commit rules remain in force.
