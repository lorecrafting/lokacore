# E1 selected active journal variants — independent review

Verdict: **APPROVE**, no findings. Reviewed source
`77ce30a45461eee7c68c2fdbeab42065e7957665` and evidence
`a77b6afcce18e46446dd1acbcd0fb46f908ec13e`. Reviewer authored none
of this implementation; review used an isolated branch.

Governing scope: [E1 proof policy](../system/architecture.md#e1-exact-candidate-proof-policy).
The added rule permits only the first satisfied active journal variant with its
exact displayed text; it retains separate evidence requirements for other branches.

Correctness inspection traced the real player-scoped GameView journal projection,
accepted-command guard, full quest reference, first-match selection and required
`all` traversal. Resolved and failed journals cannot backfill active paths.
Replay intersects recomputed witnesses with the paths retained on each committed
step; stripping intermediate paths leaves them unwitnessed. The test uses literal
variant paths and expected met/answered/following-or-deliver order, including
simultaneously satisfied lower-priority variants.

Independent checks executed:

- Focused obligations and journal suites: exit 0, 5 tests.
- Both retained traces replay: rescued/prior 49 steps and 7 journal paths;
  stays/prior 49 steps and 6 paths; union is the reported 9 distinct paths.
- Evidence SHA256SUMS: all 13 entries verify.
- Independent mutation replacing first-match with last-match: journal test exits 1
  on missing variant3 root/child. Source restored afterward.
- Author omission and precedence red-control logs inspected: old 4-test suite
  passes each mutation, new journal test fails each. Author typecheck, docs and
  size receipts are retained; this reviewer did not rerun the full gate.

Ponytail Review: lean already; one bounded helper reuses production policy and
projection queries and the existing path traversal. No new dependency or host
framework. No correctness or scope findings remain.

The [author checkpoint](https://github.com/lorecrafting/lokacore/blob/4c1bb174b603e16f425b21a7752c576939bcf1db/docs/evidence/2026-10-07-e1-journal-variants/README.md)
correctly keeps the three separated-escort variant0 paths pending. This review
approves only this witness binding; it does not certify the integrated E1
candidate, final 10,000-sequence proof, SQLite fault matrix or E2/E3/native work.
