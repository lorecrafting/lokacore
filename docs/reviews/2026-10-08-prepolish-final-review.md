# Review: pre-polish final (PR #324)

- PR #324 `chore/pre-polish`, commit reviewed `187d6a45`, base main `e38af110`.
- Scope (PM brief): merge `227280e5`, PM commits `3f73814b`, `fe348956`, `725a9b7a`, `187d6a45`, the
  unreviewed `da8a9eb3` (the batch 1 re-check stopped at `cf132ee9`), and the PR body. Batch records:
  [batch 1](2026-10-08-prepolish-batch1-review.md), [batch 2](2026-10-08-prepolish-batch2-review.md).
- Governing: [WORKFLOW Review stance](../WORKFLOW.md), [process tightening](../decisions/owner-decision-process-tightening-2026-10-08.md)
  (generated review index), [agent tooling](../decisions/owner-decision-agent-tooling-2026-10-08.md) (Fable audit line).

## Must be true

1. The merge keeps both sides: its tree equals a clean automatic merge of `da8a9eb3` and `18dc34a7`.
2. The red-control scripts that create throwaway repos never write to the real repository under a hook.
3. The README index is the generated text and shows each record's final verdict.
4. The Beads export is valid JSONL with no local paths. Deferred work (loka-b60, rest of loka-soq, loka-vqk) is not in the code.
5. The PR body matches the diff and reports `/code-review`.

## Evidence

- 1: `git merge-tree --write-tree da8a9eb3 18dc34a7` = `0dadd577` = `227280e5^{tree}`. The two sides touched
  disjoint files (30 and 20), so no hand resolution happened. `book-ui.md`, `owner-rules.md` and `CHECKS.md` come
  from one side only. Semantic check at head: `node bin/check_ts_size.mjs` rc 0; `check_docs.exs` rc 0.
- 2: red control reproduced on a copy of the index with `GIT_INDEX_FILE` exported: the old script left 11 entries,
  the fixed one 2340 (the real index stayed at 2340). `docs_only_red_controls.sh` and `integration_red_controls.sh`
  already unset `GIT_*`. `ts_size_red_controls.sh:72-78` and `red_size_controls.exs:102` pass their own temp
  `GIT_INDEX_FILE` on purpose. No other hook-run script calls `git init` or `git add`.
- 3: `bin/review_index.sh` leaves the tree clean. The wording in `3f73814b` matches `bin/sync_pr.sh:19-21`.
- 4: 94 lines parse, ids are unique, there are no `/Users/` or `source_repo_path`, and `check_beads_export.py` rc 0.
  The diff contains loka-b60, loka-vqk and soq D2/D4-D6 only as Beads text and audit records.
- 5: the body lists both batches, the PM fix, the deferrals and the `/code-review medium` counts. CI was still running at review time.

## Findings

1. should-fix `bin/review_index.sh:26` (from `da8a9eb3`, not reviewed by anyone else): the script takes the last
   verdict word anywhere in the record, including quoted words inside finding text. `docs/reviews/README.md:15` therefore
   shows batch 1 with the round-1 failure verdict. The cause is a quote at `2026-10-08-prepolish-batch1-review.md:62`.
   The final re-check verdict at `:48` is approve-with-notes. Any record that quotes a verdict word after its last
   round is mislabelled the same way. Fix: take the verdict from the last line that holds `Verdict`, a heading or
   a `Fix round` line, and keep the red control at `docs_red_controls.sh`. Or reword `:62` and make that a rule.

Final verdict: **APPROVE WITH NOTES**
