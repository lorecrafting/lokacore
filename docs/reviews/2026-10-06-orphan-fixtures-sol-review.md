# Orphan provisional fixtures — independent Sol review

- Branch: `cleanup/orphan-story-baselines`
- Source reviewed: `601e7152c6c04cac9c7a3cb68432e77c7dbf0504`
- Reviewer: fresh Codex Sol agent; authored none of the source changes.
- Verdict: **APPROVE**. Findings: none.

The [forward-development decision](../decisions/owner-decision-forward-development-2026-10-05.md)
authorizes removing obsolete development answers while retaining current validation,
determinism and save recovery. The diff deletes exactly the B9/D4 hash/ID pairs and their
two generators; its only additions are the indexed [cleanup decision](../decisions/pm-decision-orphan-fixtures-2026-10-06.md).

Repository filename/hash searches and generator inspection find no active named consumer
or generator dependency. The transcript runner discovers hash fixtures by glob, then selects
by manifest and exact content hash; none of the 29 active headers selects either deleted
hash. Integrated B9/D4 generators use v027/v030 predecessors, respectively. Current v042,
C3_B8/v029, frozen conformance, active transcripts and runtime/save code are unchanged.

All six recovery commands resolve to bytes identical to the source parent: B9 at
`8b9e5b52fffdffd34569cb0f6aa837090a7478df`, D4 at
`347c8197303358136cfa7095016ca8b4bcff9fb4`. Remaining references are historical review/evidence
records, including D4 capture's explicit removed-fixture read. The decision correctly requires
reproduction at the recorded historical source. Evidence trees are unchanged and all 81
entries in D4's retained `SHA256SUMS` verify.

Independent focused run: `mise exec -- node --test --test-reporter=dot kernel/ts/test/transcripts.test.ts kernel/ts/test/missing_child.test.ts kernel/ts/test/portable_abi.test.ts`
exited 0: 26 tests, including all active transcript replays, current v042 allocation answers,
32 controlled simulation seeds and 23 portable ABI controls. No broad gate, ExUnit run or
owner-save access was performed in this review. No new executable behavior or tests require
a mutation control. Ponytail Review: lean already; no extra machinery or coverage-only tests.

## Hosted exact-head Codex review

```text
APPROVE

No findings.

Reviewed exact head b0821ee8c817affcf77dd062a4c66226e2a7a55f against published main 1424b6cda48cd89f2ed84325d57f69334bccb6a9.

Active contract pins, canonical/conformance fixtures, current v042 and C3_B8/v029 answers remain unchanged. All 29 active transcript headers resolve to retained fixtures; none selects either removed hash.

Save mismatch refusal and unchanged-byte checks remain intact. No runtime or save handling changes.

All six documented Git recoveries reproduce the removed bytes exactly. Historical evidence is preserved; D4’s 81 checksums verify. Its retained capture’s removed-fixture dependency is covered by reproduction at the documented historical source commit.

Focused current-chapter and portable ABI tests pass: 25 tests. Ponytail Review found no unnecessary machinery.

GitHub API access was unavailable; hosted CI status was not verified.
```

PM independently verified every started hosted check on `b0821ee8` green before this review-only addition.
