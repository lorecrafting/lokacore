# Independent reviews

Each record is written by a fresh agent that authored none of the reviewed work (AGENTS.md).

- [2026-09-24 R2 foundation](2026-09-24-r2-foundation-review.md): PR #1 at `acccda6`,
  APPROVE WITH NOTES; findings and their disposition are in the PR.
- [2026-09-24 delivery workflow](2026-09-24-workflow-review.md): PR #2 at `7b2e7ab`,
  APPROVE WITH NOTES (docs-only, short review).
- [2026-09-24 docs budget](2026-09-24-docs-budget-review.md): PR #3 at `910b6a6`,
  APPROVE WITH NOTES (tooling/docs, short review).
- [2026-09-24 local hooks](2026-09-24-local-hooks-review.md): PR #7 at `0673d90`,
  APPROVE WITH NOTES (tooling, short review; hooks run on planted cases).
- [2026-09-24 roadmap](2026-09-24-roadmap-review.md): PR #5 at `3638143`,
  APPROVE WITH NOTES (docs-only planning, short review).
- [2026-09-24 R3 PR 1 portable ABI](2026-09-24-r3-pr1-portable-abi-review.md): PR #4 at
  `99b9b37`, APPROVE WITH NOTES (full review, contract freeze); re-review of the fixes at
  `e258bff`, APPROVE WITH NOTES (one test-gap should-fix; freeze owner-approved in `eb6dd03`).
- [2026-09-24 lessons split](2026-09-24-lessons-split-review.md): PR #8 at `9bbd478`,
  APPROVE WITH NOTES (docs-only, short review); re-review of the fixes at `9ab9094`, APPROVE.
- [2026-09-24 size limits](2026-09-24-size-limits-review.md): PR #6 at `6c02aee`,
  CHANGES REQUIRED (tooling, full review with mutation check); broad re-review of
  `aa58475`: CHANGES REQUIRED (one blocker, two should-fix); final round `24c72ea`:
  APPROVE WITH NOTES.
- [2026-09-24 Prettier](2026-09-24-prettier-review.md): PR #10 at `7d8d7c8`,
  APPROVE WITH NOTES (tooling, short review; hooks and checks run on planted cases);
  re-review of the fixes at `7e05205`, APPROVE.
- [2026-09-24 R3 PR 2 contracts](2026-09-24-r3-pr2-contracts-review.md): PR #9 at
  `324015c`, APPROVE WITH NOTES (full review, contract freeze; 8,653-case differential with
  zero disagreements; three should-fix: pattern syntax not closed, boundary test gap,
  untested duplicate-name guard); plus cross-vendor review (Astra): CHANGES REQUIRED, 4
  should-fix; re-review of the fixes at `3786ea3`, APPROVE WITH NOTES (all dispositions
  verified with mutants; 127-value differential with zero disagreements; one should-fix: the
  pattern grammar still admits three forms that throw in TypeScript); round 2 at `bb4a7fb`,
  APPROVE (grammar closed; 65-pattern differential with zero disagreements).
- [2026-09-24 R3 PR 6a envelopes](2026-09-24-r3-pr6a-envelopes-review.md): PR #11 at
  `018ccbf`, CHANGES REQUIRED (test-the-tests on the contract; one blocker: the envelope's
  and registry entry's `required` lists survive mutation; one should-fix:
  `consequence_operator` must freeze at R5, where ActionRecipe executes over registered
  consequences; docs part accurate, decision record byte-identical); re-review of the fixes at
  `b966814`, APPROVE (F1 mutants now fail in both kernels; F2 and N1 fixed).
