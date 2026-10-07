# E1 dialogue choice effect checkpoint

Clean source `d344aaaa1cb9d6f0c83c3b5e95432aac2ac59f8e` binds a selected accepted dialogue choice's authored fact assignment or adjustment to its exact before/after transition and committed `fact_changed` event. The candidate and check digest `3d5d51c0c0fbfd700f7303d3fa5e7869e5f03c591fd4580c1ac149d2e6af3a20` are in the [report](report.json).

The recorder exited **2, pending**. All 18 isolated real SQLite cases and semantic replays passed, including five endings, Maud's cellar, thirty-day hourly replay and three storage faults. Twelve dialogue consequence paths were discharged; **243 authored paths** remain open on this isolated source. This does not certify E1.

The focused E1 suite passed 11/11, TypeScript typecheck passed, and docs found 836 documents with zero broken or unreachable links. Omitting the Maud trust adjustment left the prior ten tests [green](old-suite-green.log) and made the new choice-effect test [fail](red-control.log). The restored test validates both trust adjustment and cellar-status assignment. The diff reuses the existing exact receipt/replay path, with no new dependency or configuration; Ponytail Review found no extra abstraction.

The [report](report.json), selected [Maud](mauds-cellar.jsonl) and [ending](rescued-prior.jsonl) traces, and [redacted CLI log](cli.log) are hashed in [SHA256SUMS](SHA256SUMS), with [verification](SHA256SUMS.verify). The full isolated output, including 18 databases and traces, was hashed at capture in [case-SHA256SUMS](case-SHA256SUMS); all 38 checks are retained in [verification](case-SHA256SUMS.verify). Final path coverage, candidate pin, independent review and 10,000-sequence simulation remain pending.
