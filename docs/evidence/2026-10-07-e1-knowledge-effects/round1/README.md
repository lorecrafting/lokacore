# E1-K1 — isolated membership guard control

Fix source: `3ce2d9c1a6237e1e63cc3dc6e8b732e3a1e28ce0`.
The independent reviewer found that the original two negative inputs changed
choice lifecycle alongside facts, so they did not isolate the membership guard.
The existing two parameterized tests now replace only `state.facts`, preserving
the pending/resolved continuation and all receipt fields. No new route or test
was added; the witness implementation is unchanged.

[Removing both membership state guards](missing-membership.diff) leaves the old
12 focused tests [green, exit 0](missing-membership-old.log) and makes both corrected
new tests [fail, exit 1](missing-membership-new.log). The restored source passes
[all 14 focused tests](restored.log), [typecheck](typecheck.log) and the
[test size check](size.log), each exit 0. Commands match the parent evidence page.
Ponytail/correctness self-review: the two confounded inputs were replaced; no
additional machinery. Independent scoped recheck remains required.

[Checksums](SHA256SUMS) and [verification](SHA256SUMS.verify) cover these retained
redacted logs and mutation diff. E1 remains pending.
