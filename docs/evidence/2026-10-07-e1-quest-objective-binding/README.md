# E1 resolved quest objective witness checkpoint

Clean source `f8a89719c8f8a7e83dcbf54465803604ecc2d8fe`, check digest
`78e365620991ab644e4d03d7530ef9b5c755281ff9ee5b9a796b393c98aa8583`,
and the fixed v042 candidate bind a quest definition and objective only when
an accepted command changes that exact instance from unresolved to resolved.
For a current-state objective, its root and required `all` children are
witnessed; other branch children, active and failed quests stay pending.

The focused real SQLite suite passed 8/8, including a new Maud route case that
requires all five rat predicates at the committed resolution. Omitting the last
objective child left the prior seven tests green and failed the new case.
TypeScript typecheck and the docs check passed. The clean-head recorder exited
**2, pending**: all 18 isolated SQLite cases passed with semantic replay. Open
quest paths fell from 47 to 14, and **395 authored paths** remain. E1 is not
certified.

The [report](report.json), selected [Maud](mauds-cellar.jsonl) and
[dream](dream-follow_fox.jsonl) traces, redacted [CLI log](cli.log),
[focused run](focused.log), and [old suite](old-suite-mutant.log)/[new case](new-test-mutant.log)
red controls are hashed in [SHA256SUMS](SHA256SUMS), with
[verification](SHA256SUMS.verify). The complete isolated output was hashed at
capture in [case-SHA256SUMS](case-SHA256SUMS), with successful
[verification](case-SHA256SUMS.verify). The recorder's `redact()` covers local
paths and host identifiers in failure output.

The diff reuses the existing exact receipt and policy-path walk. Its Ponytail
Review found no dependency, configuration or generalized quest framework;
remaining objectives and authored paths need their own witnesses. Final
combined capture and the 10,000-sequence simulation remain pending.
