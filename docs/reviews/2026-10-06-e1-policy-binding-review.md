# E1 policy and exact consequence binding review

Verdict: **CHANGES REQUIRED**. One required test fix; no source behavior defect found.

Reviewed exact source `90e36f108ceabc4580b2e196c79adcf4e24102e3`, base
`dc35dd09`. This reviewer authored none of the source. This review covers the
world ownership and bounded consequence binding delta, not E1 certification,
route completeness or final candidate publication.

## Obligations derived before the diff

Read AGENTS.md, delivery workflow, E1 brief, architecture E1 exact candidate proof
policy, and contract/storage/evidence lessons. World keys must retain their
explicit semantic owner; unknown keys and missing owner capabilities refuse.
Receipts must bind changed policy and check implementation. Only the exact
study_tracks success fact.assign path can be discharged, after a retained
accepted perform command and literal fen_tracks_found false→true transition
are checked again in semantic replay. Missing/unrelated/invalid witnesses stay
pending, sibling paths stay pending, and no result implies full E1 success.
Owner save and mobile/native work remain outside this review.

## Finding

**E1-BIND-R1 — should-fix, required before handoff.**
`kernel/ts/test/e1_cases.test.ts:76`, guarding
`kernel/ts/test/e1_case_host.ts:60`: the new witness test covers a valid
false→true route and missing/unrelated metadata, but does not catch loss of the
literal false precondition. Removing
`value(before, p.actor_id, fact) === false &&` leaves all seven focused tests
green (exit 0). A controlled probe using the already searched real-authority
world as both before and after, its accepted study_tracks command and decision,
then returns the exact obligation despite fact true→true. That mutation violates
the active bounded binding clause and can wrongly discharge a non-transition
step. Add the smallest literal negative control for true→true and demonstrate
this mutation fails; restored source must pass. No production change is needed
unless that test exposes another defect.

## Verified behavior and controls

- `mise exec -- node --test --test-reporter=dot kernel/ts/test/e1.test.ts
  kernel/ts/test/e1_cases.test.ts`: seven tests pass, exit 0 on reviewed source.
- Reviewer mutation carry owner containment→schedule: focused policy test fails
  exit 1, expected authored.containment versus actual authored.schedule.
- Reviewer mutation removing false precondition: seven tests pass, exit 0;
  controlled true→true probe returns the obligation, as detailed in R1.
- Mutations ran only in a throwaway detached worktree, restored and removed.
- POLICY_HASH includes world ownership; source check_hash includes the witness,
  recorder and replay files. Replay compares source/check/policy identity and
  exact candidate bytes, redecides and checks decision/state bytes before binding.
- Witness helper checks accepted perform/study_tracks and literal false→true;
  replay intersects recomputed exact paths with retained step metadata. Gaps
  remove only the witnessed authored path; the recipe root remains pending.
- The recorder retains pending status and null certification verdict. This delta
  introduces no production writer, save reset, adapter or native execution.

Ponytail Review applied to the actual diff: Lean already. No complexity finding.
Correctness self-review found only R1. Focused checks are review evidence; full
publication checks, exact-head CI and final E1 proof remain separate gates.
