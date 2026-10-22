# Retire Ashmere, phase 2 (lean)

Owner, 2026-10-21 (AskUserQuestion choice, quoted): "Lean: neutral fixture (Recommended)". Earlier the same day: "right now we should only be having the showcase, and then rebuilding the real game from 0 after ui polish". Tracking: `loka-4hik.2`.

The planner's full analysis is in [plan.md](plan.md). Its per-file classification is in [files.psv](files.psv), with the columns `path|bucket|break or reason|target|planner slice`. The lean plan keeps the classification and changes the K bucket.

| Slice | Bucket | Work |
|---|---|---|
| L1 (`loka-4hik.5`) | R (140) | Rename the 19 Ashmere samplers to the neutral names in plan.md's "Rename map (R)", following the rename mechanics there: round-trip check first; rewrite the frozen answers in Python; never take a new answer from compiler output. Also covers the R fixtures and transcripts and `bin/red_controls.exs`. |
| L2 (`loka-4hik.6`) | K (167) | Retarget nothing. Move the chapter out of author space: `cartridges/ashmere_missing_child` becomes the frozen, non-playable test fixture `test/fixtures/chapter_v042/`. Its internal id and frozen answers are unchanged, because changing them rewrites about 70 pinned answers. A README there says it is the retired chapter, kept only as a test fixture until the real game's chapter replaces it. Update every path in the K files. Repoint `bin/features.exs` and the transcript tests at the new location. K tests otherwise run unchanged. |
| L3 (`loka-4hik.7`) | D (74) | Before deleting each D test, break the guarded code once (or check the "covered by" test the plan names) and confirm another test fails. If none fails, it becomes K and stays. Delete the rest. Retire the v042 E1 case files and keep the generic harness (plan.md decision 3). Retarget or delete the CI `e1-recorder` job. Update the docs (plan.md "Docs"). Move `docs/MISSING-CHILD-PLAN.md` to `docs/archive/`. Append a phase-2 line to the decision record. |

- The three slices share no test files, so they run in parallel on branch `retire/ashmere-2`.
- Generated files (`docs/features.gen.md`, `docs/system-graph.gen.json`, `docs/checks.gen.json`) are regenerated at each merge with `elixir bin/contracts.exs`.
- Where a K or D file also names a renamed sampler, the second slice to merge reruns L1's sed map on it.
- The Ashmere-keyed production code (`bell-save.ts`, `finale-save.ts`, `bell-receipt.ts`) gets its own follow-up item and is not deleted here.
- Storybook views keep using `missing_child_v042_hash.json` until they are re-snapshotted (paused lane).
