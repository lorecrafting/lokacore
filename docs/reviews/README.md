# Independent reviews

Each record is written by a fresh agent that authored none of the reviewed work (AGENTS.md).

## R0/R1

Reviews before R2 live in the [legacy repository](https://github.com/lorecrafting/lokacore-v2-legacy) (commit `997a7a8`, `docs/rewrite-v3/reviews/`).

## R2: foundation, delivery process, plan

- [2026-09-24 R2 foundation](2026-09-24-r2-foundation-review.md): PR #1 at `acccda6`,
  APPROVE WITH NOTES; findings and their disposition are in the PR.
- [2026-09-24 delivery workflow](2026-09-24-workflow-review.md): PR #2 at `7b2e7ab`,
  APPROVE WITH NOTES (docs-only, short review).
- [2026-09-24 docs budget](2026-09-24-docs-budget-review.md): PR #3 at `910b6a6`,
  APPROVE WITH NOTES (tooling/docs, short review).
- [2026-09-24 roadmap](2026-09-24-roadmap-review.md): PR #5 at `3638143`,
  APPROVE WITH NOTES (docs-only planning, short review).

## R3: contract slices and gate

- [2026-09-24 R3 PR 1 portable ABI](2026-09-24-r3-pr1-portable-abi-review.md): PR #4 at
  `99b9b37`, APPROVE WITH NOTES (full review, contract freeze); re-review of the fixes at
  `e258bff`, APPROVE WITH NOTES (one test-gap should-fix; freeze owner-approved in `eb6dd03`).
- [2026-09-24 R3 PR 2 contracts](2026-09-24-r3-pr2-contracts-review.md): PR #9 at
  `324015c`, APPROVE WITH NOTES (full review, contract freeze; 8,653-case differential with
  zero disagreements; three should-fix: pattern syntax not closed, boundary test gap,
  untested duplicate-name guard); plus cross-vendor review (Astra): CHANGES REQUIRED, 4
  should-fix; re-review of the fixes at `3786ea3`, APPROVE WITH NOTES (all dispositions
  verified with mutants; 127-value differential with zero disagreements; one should-fix: the
  pattern grammar still admits three forms that throw in TypeScript); round 2 at `bb4a7fb`,
  APPROVE (grammar closed; 65-pattern differential with zero disagreements).
- [2026-09-24 R3 PR 4a capabilities](2026-09-24-r3-pr4a-capabilities-review.md): PR #12 at
  `0995551`, APPROVE WITH NOTES (full review, contract freeze; lock known answer recomputed
  independently; 31-value differential with zero disagreements; 8 of 9 mutants caught; two
  should-fix: the chapter-one lock's portability is untested, and the normalized manifest
  shapes need a spec-amendment record; views on owner questions 1-9).
- [2026-09-24 R3 PR 6a envelopes](2026-09-24-r3-pr6a-envelopes-review.md): PR #11 at
  `018ccbf`, CHANGES REQUIRED (test-the-tests on the contract; one blocker: the envelope's
  and registry entry's `required` lists survive mutation; one should-fix:
  `consequence_operator` must freeze at R5, where ActionRecipe executes over registered
  consequences; docs part accurate, decision record byte-identical); re-review of the fixes at
  `b966814`, APPROVE (F1 mutants now fail in both kernels; F2 and N1 fixed).
- [2026-09-24 R3 PR 3 commands](2026-09-24-r3-pr3-commands-review.md): PR #13 at `cfc6a14`,
  CHANGES REQUIRED (full review, contract freeze; 7,911-case differential with zero
  disagreements below the decoder's depth cap; CommandId known answers recomputed
  independently; one blocker: 120 `required` entries of the frozen contracts survive
  mutation; two should-fix: no "always allowed" policy, no id rule for internal commands);
  plus cross-vendor review (Astra): CHANGES REQUIRED (A1 continuation context, A2 old/new,
  A3 subjects); re-review of the fixes at `2c0d824`, CHANGES REQUIRED (all round-1 items
  verified with mutants and a 177-mutant sweep; two new one-line should-fix in the reshaped
  shapes: `fact_changed` subject, `job.complete` precondition during an advance); round 2
  at `c2284ed`, APPROVE (F4/F5 fixed; PR #12 merge resolutions verified line by line).
- [2026-09-24 R3 PR 4b facts, relations, GameView, accounts](2026-09-24-r3-pr4b-facts-review.md):
  PR #14 at `bccc582`, APPROVE WITH NOTES (full review, contract freeze; 122-value
  Elixir/TypeScript differential with zero disagreements; all 292 fixture expectations
  recomputed by an independent oracle; 22 of 22 mutants caught; one should-fix: GameView
  carries no logical time, so `wait` cannot be built by touch; one process should-fix on
  generated fixture expectations; views on owner questions 1-5); Astra cross-vendor review
  appended (A1 blocker: AdvertisedAction lacked target/input); re-review of the fixes at
  `1f96346` and the PR #15 merge `3c422a2`, APPROVE (A1 and F1 verified with 9 mutants,
  ActionDefinition A/B identical, merge consistent).
- [2026-09-24 R3 PR 5 composition](2026-09-24-r3-pr5-composition-review.md): PR #15 at
  `9131dbe`, APPROVE WITH NOTES (full Fable review: spec-derived requirements, reviewer
  differential of 2,124 cases over 3 seeds, 29 mutants of which 1 survives in both kernels;
  two one-line should-fix, four nits, no owner decision needed); Astra cross-vendor review
  adjudicated (A1 not a compose blocker: an R5 coordinator obligation to register; A4 and
  AQ1 accepted; A2, A3, A5 deferred with follow-ups), verdict unchanged; re-review of the
  fixes at `2812a71`, APPROVE (every item verified, six mutants die, differential identical).
- [2026-09-24 R3 gate](2026-09-24-r3-gate-review.md): PR #16 at `5ee2aa7`, APPROVE WITH
  NOTES (full Fable review of the gate PR: ten type-checker probes, eight mutants, full
  check line; two documentation should-fix, two nits); **Gate R3: PASS WITH NOTED GAPS**
  (every R3A/R3B/Gate item verified against the code; follow-ups from #4-#15 traced; six
  deferrals, none needing the owner; plain-language residency view for the owner); Astra
  cross-vendor review appended (PR CHANGES REQUIRED, Gate NOT YET: A1 six classes, A2
  composite Elixir types, A3 observed boundary, A4 guarantee overstated); re-review of the
  fixes at `94b15fb`, APPROVE, **Gate R3: PASS WITH NOTED GAPS** (six-class view, boundary
  test with five dying mutants in both kernels, probe test, owner-approved amendment).

## R3: tooling and design

- [2026-09-24 local hooks](2026-09-24-local-hooks-review.md): PR #7 at `0673d90`,
  APPROVE WITH NOTES (tooling, short review; hooks run on planted cases).
- [2026-09-24 lessons split](2026-09-24-lessons-split-review.md): PR #8 at `9bbd478`,
  APPROVE WITH NOTES (docs-only, short review); re-review of the fixes at `9ab9094`, APPROVE.
- [2026-09-24 size limits](2026-09-24-size-limits-review.md): PR #6 at `6c02aee`,
  CHANGES REQUIRED (tooling, full review with mutation check); broad re-review of
  `aa58475`: CHANGES REQUIRED (one blocker, two should-fix); final round `24c72ea`:
  APPROVE WITH NOTES.
- [2026-09-24 Prettier](2026-09-24-prettier-review.md): PR #10 at `7d8d7c8`,
  APPROVE WITH NOTES (tooling, short review; hooks and checks run on planted cases);
  re-review of the fixes at `7e05205`, APPROVE.
- [2026-09-24 room view prototype](2026-09-24-room-view-prototype-review.md): PR #17 at
  `ba5e572`, APPROVE WITH NOTES (docs-only design record, short review; schema cells
  verified against `4e8f40b`; two one-line should-fix: the lone "must" row is neither a
  must nor a gap, and the needs list lives in three places; three nits); re-review of
  the fixes at `9cc66f6`, APPROVE (all five dispositions verified).

## Post-R3

- [2026-09-24 ADR-074 TypeScript-first proposal](2026-09-24-adr-074-ts-first-review.md): PR #18
  at `0f7c4f6`, CHANGES REQUIRED (Fable design review of the proposal document: citations
  and re-estimate arithmetic verified; six should-fix: the R9 Lab runs rules before the
  first release and is unaddressed, the deferral boundary and reopen trigger are by feature
  name rather than by residency class and code, the on-device differential is downgraded
  without reason, the plain-words section misstates the present and omits the net cost,
  the post-release "TypeScript becomes the rulebook" consequence is missing, and the
  amendment list is incomplete; four nits, one question; owner recommendation: accept
  the direction after the fixes); re-review of the fixes at `1545b82`, APPROVE (every disposition verified, arithmetic reproduced, crosswalk complete but for two reading aids; fit for the owner to decide).
- [2026-09-24 maintenance cleanup](2026-09-24-maint-cleanup-review.md): PR #20 at `d387b93`,
  APPROVE WITH NOTES (cleanup, proportionate review: case lists and differential inputs
  byte-identical to `main` in both kernels, PR #15 mutants still die; one should-fix: the
  fixture description does not say how to rebuild the three built cases).
