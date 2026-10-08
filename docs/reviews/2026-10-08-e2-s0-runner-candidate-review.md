# E2 S0 review: E1 runner accepts a named second candidate

- PR #312, branch `e2/s0-runner-second-candidate`, exact head `2f1bcd70b38710c9ff7fc673382062c7add6efeb`, base main `c44a44c3`. Hosted CI green on that head.
- Governing: [e1-certification.md](../system/e1-certification.md#e1-exact-candidate-proof-policy) (candidate rule, policy bound, receipts, recorder); [E2 slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md) S0 and exit criterion 3; [review stance](../WORKFLOW.md).
- Reviewer: independent Opus. **Verdict: APPROVE WITH NOTES.**

## Must be true (written before reading the diff)

1. Exactly two literal rows admit; an unlisted id refuses; a version or hash mismatch against the *selected* row refuses with `wrong E1 candidate`.
2. Loader and `applicability` still run before the comparison; no loader or `kernel/ts/src` change.
3. `POLICY_HASH` stays `02d71791…`; the table is outside it.
4. The v042 report `candidate` block keeps its keys and values.
5. Spec text (:10, :19, recorder paragraph) matches behavior; CLI shape unchanged; `checks()` uses the row's source and content test.

All five hold at `2f1bcd70`.

## Mutants (throwaway detached worktree, `node --test test/e1.test.ts`, baseline 10/10)

| Mutant in `admitCandidate` | Result |
|---|---|
| drop hash comparison | red (existing wrong-candidate test, B) |
| `row && (…)` guard | red (C) |
| compare hash to `CANDIDATES[0]` | red (A) |
| lookup miss falls back to row 0 | green, equivalent: the content hash covers `manifest.id`/`version` (a title change alters it), so the v042 hash still refuses bell |
| drop version comparison | green, equivalent (hash binds version) |
| hash compared against any row | green, equivalent (equal hash implies same cartridge, so same id row) |
| find row by hash instead of id | green, equivalent |

The refusal is not weakened: every surviving mutant still refuses any artifact whose hash is not a listed row's hash. The PR body records the row-0 fallback as green, so no red control is misreported.

## Other checks

- Recorder on r9c bytes (`e1_cases.ts`): exit 1, `invalid disposition /dialogues/ashmere_missing_child@0.0.42:…`, no output directory created. Matches the new spec sentence. Explicit guard deferred to loka-hs9 (PM ruling).
- `docs/evidence/2026-10-07-e1-coverage-complete/SHA256SUMS` verifies; its `policy_hash` equals test D's literal.
- `cartridge.md#r9c-synthetic-interaction-cartridge-e2` anchor exists.
- Tests follow AGENTS.md: literal expected values from fixtures, no mocks; each new test has a distinct red control above.
- Known PM item (not counted): r9c `deployment.reason` "bundled private Story candidate" (`kernel/ts/test/e1.ts:263`), fix due in round 1.

## Findings

- nit, `docs/system/e1-certification.md:19`: "the admitted candidate's admitted forms" repeats "admitted"; "the admitted candidate's forms" reads the same.

## Fix round 1 re-check at `ac2ca37e`

Scope: fix commit `ac2ca37e` only, the code it touched and its direct callers. **Verdict: APPROVE.**

| Disposition | Proof |
|---|---|
| `e1.ts:263` deployment reason now `private candidate; no deployment identity` | Holds for both rows; spec still says "record the reason". Old string survives only in the archived E1 brief and historical evidence, which are correct for their time |
| `e1.ts:276` review reason now `PM assigns fresh review of this candidate report at its published head` | Row-neutral; no test or evidence pin on the old text outside `docs/evidence` |
| `reportOf` exported; test A asserts an r9c report names `r9c_interactions` and `7d74fac7…` | Only caller in code is `certify` (`e1.ts:175`); export is safe because the CLI runs under `import.meta.main` (`e1.ts:301`). Red controls in a throwaway worktree: hard-code `candidate.id` to the chapter, A red; hard-code `candidate.content_hash` to `5d8b0e3a…`, A red; baseline 10/10 |
| nit `e1-certification.md:19` | Fixed: "the admitted candidate's forms" |

Open: none from this reviewer.
