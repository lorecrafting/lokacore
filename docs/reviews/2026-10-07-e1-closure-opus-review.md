# E1 closure review (Opus): PR #288

- PR: [#288](https://github.com/lorecrafting/lokacore/pull/288), branch `slice/chapter-one-e1-r9-certification`
- Reviewed: whole PR at `d30e21c234520a03cef8e4c49b3652b0fc34e0aa` against base `cfc228ba`
- Reviewer: independent Opus, author of none of the work; second reviewer (Fable) not consulted
- Verdict: **APPROVE WITH NOTES**

Governing: [E1 certification](../system/e1-certification.md#e1-exact-candidate-proof-policy)
(recorder pass result, [branch evidence and dispositions](../system/e1-certification.md#e1-policy-branch-evidence)),
[E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md),
[polish order](../decisions/owner-decision-chapter-one-polish-order-2026-10-07.md) item 1,
the four E1 decision records, [WORKFLOW](../WORKFLOW.md).

## What must be true (written before reading the diff)

1. The recorder exits 0 only when every case passes, no authored path is pending, every family gap is empty and the disposition and refusal checks hold; the result is computed, not asserted.
2. A disposition never adds to the witnessed set; a row for an unknown or witnessed path fails; a refusal row fails unless its case's final replayed step is refused with that code by the named dialogue.
3. No disposition credits a path that is reachable but unexercised.
4. No production behaviour change and no new protocol schema.
5. E1 closes only with the pass, independent review and green exact-head hosted CI.

## Checks and results

- **Recorder at exact head** (`node kernel/ts/test/e1_cases.ts tmp/e1-selected-v042.json <new dir>`, clean tree, source_sha `d30e21c2`): exit 0, `status` pass, 38/38 receipts pass, 614 witnessed, 34 dispositioned, all six gap lists empty, `certification_verdict` null. The witnessed, dispositioned and coverage lists are identical to the retained [report](../evidence/2026-10-07-e1-coverage-complete/report.json), which was captured at `e2f56884`. This re-run supersedes that source for the merge head; main's runtime edits (`decision.ts`, `calendar.ts`, local-story receipts) changed no coverage.
- **Pass is computed:** `recorderExit` and `gaps` (`kernel/ts/test/e1_cases.ts:207-252`) derive the status from the replayed obligations. A witnessed-row assertion throws, so the run fails closed (exit 1).
- **Red controls** (throwaway detached worktrees, edit hidden with `--skip-worktree` so the source stays clean; all removed afterwards):
  - Dropped the `resource/ma` disposition row: exit 2, `pending`, `authored_obligations = [/resources/…/ma]`.
  - Dropped the `carry-limit` case: exit 2, 37 receipts, `authored_obligations = [/world/carry]`.
  - Changed the `refuse-maud-resolved` refusal code to `not_found`: exit 1, `fail`, refusal assertion naming the row.
  - Removed the dialogue-disposition filter in `gaps`: `e1_obligations.test.ts` "closes its family gap" fails (12 pass, 1 fail).
- **Dispositions (34 rows):** each row has a path, reason, evidence and review, checked by `checkDispositions`. The 15 refusal rows are bound by `checkRefusals`; the cases assert that the other conjuncts hold and no choice or combat is pending (`e1_refusals.ts:15-80`). I re-derived the non-refusal claims from the code and the artifact:
  - `objectives_complete` persists only for `post_activation_event` objectives (`proposal.ts` `earned`). `resolution` passes through it within one op group. All five quests named have `current_state` objectives.
  - No runtime writer of `abandoned` and no abandon command exist. `failed` is written only by the deadline job (`schedule/rule.ts`) and by a `quest.fail` reaction. The only such reaction targets `missing_child`.
  - `seek_wisp` failure: `attribute_threshold` passes when the value is >= difficulty (`action_recipe/rule.ts:124`). `per` starts at 5 and the ancestries only add +1. `difficulty` is 5.
  - `ma` has no reference beyond its definition and starts at its maximum.
  - `a_elspeth_lost` is shadowed by `a0_d9_elspeth_lost_prior` (key order, lost implies prior). It is unlabelled, so it cannot be selected by key.
- **Non-test, non-docs diff:** `kernel/ts/src/runtime/world.ts` changes a comment only. `bin/integrate_batch.sh` accepts exit 0 only at zero expected pending, and its red controls cover zero-pass and zero-gap. The test helpers `sim.ts` (exported `replay`, optional `action` passthrough) and `elapsed-host.test.ts` (`sqliteHost` split) also change. No production behaviour change and no new schema.
- **Last commits:** `2e9b1263` deleted 30 E1 evidence folders. None is referenced outside docs. All 31 rewritten permalink paths exist at `4c1bb174`, and every permalink commit in the changed docs is an ancestor of the head, so a merge commit keeps them. The two lessons in `docs/lessons/checks.md` are specific and linked. In `d30e21c2` the index diff against main only adds lines: 39 review lines and 4 decision lines, none from main lost. `check_docs`: 333 docs, 0 broken links, 0 unreachable.
- **Typecheck** exit 0. **E1 tests** `node --test test/e1*.test.ts`: 63/63. **Prettier** on the changed TS/JSON and `check_ts_size.mjs`: exit 0.

## Findings

1. **nit**, `kernel/ts/test/e1_cases.ts:377`: the summary line reads `fail: 34 real SQLite cases passed` on a failed run (seen in the refusal red control). The status word is right, but the line reads like success. Suggest `${status}: ${receipts.length} of N cases passed`.

## Open items (not findings against the diff)

- **Exact-head hosted CI is still due.** Every job at `d30e21c2` is SKIPPED because the PR is a draft. The polish-order decision requires green hosted CI, so E1 may not close until CI is green on the final merge head, which will include the cherry-picked review records.
- **The recorder is not in CI.** CI runs the E1 unit tests through `test:nosim`, not `e1_cases.ts`. During the polish phase, a change that reopens a path will not turn CI red. The policy does not require this; the owner order relies on running the recorder for each mechanic slice.

## Answer

E1 may close at coverage complete. The pass is reproduced at the exact head, is computed by code, fails on planted gaps, and the dispositions are sound. #288 is safe to merge with a merge commit once hosted CI is green at its final head.
