# PM decision: Codex model routing during local chapter work — 2026-10-05

The owner asked whether implementation should use a lower model now that the
chapter is planned, and requested an audit of model and role use with the local
worktree workflow. This is the PM's execution choice, not an owner quote or a
change to Claude Code's historical Sonnet/Opus policy. Apply it to new Codex
agents; do not restart an active slice solely to change its model.

| Work | Codex default | Escalate when |
|---|---|---|
| Mechanical lookup, small copy/content or docs edit with a fixed brief | Luna medium | The task exposes a spec conflict or cross-layer behavior: Sol medium. |
| Substantial slice implementation, tests and fix rounds | Sol medium | Broad kernel, protocol, save or cross-layer work: Sol high. |
| PM brief adoption and integration judgment | Sol medium | Conflicting decisions or a hard architecture tradeoff: Sol xhigh; Astra only if still unresolved and consequential. |
| Fresh independent implementation review | Sol high | Save/reconciliation, protocol, portable foundation or a difficult exact-head review: Sol xhigh. Keep the required separate second opinion for those boundaries. |
| Gate's riskiest-code audit or `runtime/proposal.ts` change | Astra high | Follow the existing gate/proposal rule. Scoped fix rechecks normally use Sol high. |

Role independence and the review count come from the [workflow](../WORKFLOW.md)
and [one-reviewer default](owner-decision-one-reviewer-default-2026-10-04.md),
not from model size. An authored brief narrows exploration but does not make
save, receipt, or protocol implementation mechanical. The B2 Chandler's Debt
implementation needed four real review findings closed by independent SQLite
red controls; A3 Green finale spans bound input, story-point and save evidence.
These are Sol implementation jobs even after planning. Luna is for genuinely
bounded edits, never a blanket default for all chapter code.

Every new Codex subagent prompt states its model and reasoning effort explicitly.
Record the chosen tier and any escalation in the slice handoff; do not pretend
the model setting is a quality verdict. Compare elapsed time, tokens when
observable, check results and fix rounds after three completed slices, then
adjust the routing. The existing `docs/dev-evidence.jsonl` ends at older PRs
and cannot establish a cost or quality delta for this chapter. API list prices
are not a measurement of this Codex session's quota use.
