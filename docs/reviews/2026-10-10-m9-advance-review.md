# Review: M9 advance fixes, status sub-steps and plan/resume pairing (loka-6ztc, loka-dto9, loka-2s48)

- Branch `toolbox/m9-advance` (no PR), head `6b433323fbcdcf49b378840ed2b7fe0a32350d41`, base `toolbox/batch-m9` = main `82cefdf2`. Changes the kernel's time-advance core and the D9 writer-group rule, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [mechanics.md](../system/mechanics.md) schedule@1 drain and sub-steps, `job_complete_owned_by_run`, row 1 (status effects); [protocol.md](../system/protocol.md) D9 composition; [save.md](../system/save.md) D9 recovery; Beads `loka-6ztc`, `loka-dto9` (PM ruling), `loka-2s48`.
- Hosted CI on the head (per brief): ci and book-e2e green.
- Verdict: **CHANGES REQUIRED** (one blocker, three should-fix, two nits).

## Must be true

1. A status successor that the same advance crosses runs at its own time, in `(due_time, job_id)` order, in the holder's group. It ticks, expires or kills as job-by-job play would, reactions included. Only the last sub-step writes the row, and its successor is due after the target.
2. Each sub-step counts toward `due_jobs_per_advance`, gets its own CommandId and event ids, and its events carry the sub-step's logical time.
3. A refresh between sub-steps keeps job-by-job semantics: no tick at the old end, the new end honoured.
4. Fatal sub-step: the death sequence runs once, the encounter closes, and no later sub-step ticks.
5. D9: the plan job and its resume job share one group whenever one advance runs both. Unrelated jobs keep separate groups.
6. Chapter 1 frozen receipts and transcripts are unchanged; the docs match the code.

## Findings

1. **Blocker: a refresh inside a crossed chain still faults, and the refresh fix is dead code (`kernel/ts/src/mechanics/status/job.ts:50`, `:76-77`; `mechanics.md:1813`).** Probe on the elements sampler: `shocked` set to 90 s with a tick every 60 s, plus a reaction `status_ticked shocked → status.apply shocked`. Drop the jar, then run one elapsed of 90, 95, 119 or 130 s. The proposal faults `precondition_failed` on the shocked row. Job-by-job play (10 s waits) is accepted: one tick at 60 (hp 19, ends 150), or ticks at 60 and 120 (hp 18). Cause: the first step at 60 leaves the row unwritten, so the reaction's refresh (`status/shared.ts:141`) copies `next_tick_at` 60, which is before the advance end, and `compose_status.ts:22` refuses it. The new `Math.max(row.next_tick_at, now)` can only matter after such a refresh, so it is unreachable. Mutant M1 (revert to `now`) stays green on all named files. Shipped content can produce this: a row G3 scheduled NPC that re-enters a poisoning room during one `wait`. Fix, or record a known limit with a Beads issue and drop the dead branch. The commit's claim "a sub-step after a refresh ticked at the old end time" is not backed.
2. **Should-fix: the wider D9 pairing has no test (`kernel/ts/src/runtime/proposal_deadlines.ts:17`).** Probe: start from `rung()`, advance job by job to 237000, move the plan job to 237600+{1800, 3599, 3600}, then run one elapsed to 241200. All are accepted and match job-by-job play (suppression null, generation 2). With the issue's narrower `b.due_time <= a.due_time`, the same three cases fault `conflicting_write` (containment), and `d9_suppression.test.ts` stays green. The plan-due-after-resume case needs a test.
3. **Should-fix: "own group first" is untested (`kernel/ts/src/runtime/proposal.ts:289`).** Reverting it to the pre-fix `groups.get(partner ?? job_id)` stays green on the d9, bell, population, writer_groups, elements and buffs files. Add a test that fails on the revert, or drop the change.
4. **Should-fix: a source-file `size: allow` was raised (`job.ts:32`, 44 → 48).** [CHECKS.md](../CHECKS.md) Size forbids raising an existing allowance in a source file. Split `runStatus` instead.
5. **Nit: `mechanics.md:2365` cites `loka-6ztc`** for the remaining spell-duration limit. That limit is now Beads `loka-kgd.104`.
6. **Nit: no `/code-review` result is reported** (no PR body; only the commit says "self-review").

## Open item (pre-existing, not this slice)

- A reaction during the drain that applies a status ending or ticking before the advance target faults `precondition_failed`, on head and on base `82cefdf2`. Probe: on a shocked tick at 60, apply `warm` cut to 30 s, then one elapsed of 100. This is the same composer bound as `loka-kgd.104`, reached by reactions instead of spells. The PM should file it or fold it into `loka-kgd.104`.

## Proof

- Named files plus `targets.test.ts` (15 files) are green on the head; `npm run typecheck` passes. No fixture, transcript or `e1_creatures` expectation changed (`git diff --stat` covers docs, 5 sources and 4 tests).
- Mutants on the focused files:
  - Killed: `crossed` off by one (`<`), precondition fault in elements; `dies` back to `ops[1]` (`evaluator_error`, so the commit's fatal claim holds); ticks skipped on non-first steps (`budget_exceeded`); pairing back to equal due (`conflicting_write`, so the d9 test holds); 2s48 red control, dropping `living` from `allyOf`, fails `targets.test.ts`.
  - Survived: M1 (finding 1), the `proposal.ts:289` revert (finding 3), narrow pairing (finding 2).
- 2s48 pack-round variant probe: a pack fight (two goblins in `active_ids`) with the guard moved to the den at 1 hp. Control: the guard strikes and the goblin goes 6 → 3. Poison tick on the guard sorting before the round: the guard dies (0) and the goblin goes 6 → 4. No finding.
- Sub-step plumbing: every sub-step gets `jobCommandId(job_id, due_time)` and its own allocator (`proposal.ts:278-282`) and is counted by `queueHour` (`:285`). Events take `logical_time` from the sub-step clock (`job.ts:145`). The last sub-step's `status.transition` uses the hydrated row as `expected`.

## Re-check at `948386f440ec99e84e0fb4617ab9216841ad170a`

- Fix commits only: `25ae6629`, `6f672c52`, `948386f4`. Hosted ci and book-e2e green (per brief). Verdict: **APPROVE WITH NOTES**.
- Named files (elements, d9_suppression, writer_groups, status_composition, e1_creatures, transcripts) green; `npm run typecheck` passes. No fixture, transcript or `e1_creatures` expectation touched.

| # | Disposition | Proof |
|---|---|---|
| 1 | Fixed | The drain carries each sub-step's next tick (`queueHour`, `proposal_hours.ts:21`; `job.ts:49`); a refresh while the row's job is completed writes its end as the tick (`status/shared.ts:164`); `Math.max` is gone. The new elements test's expected rows (hp 19/ends 150/tick 120 at 90 and 95 s; 18/210/180 at 130 s) match a hand count. Mutants, each killed by that test: stale tick (`row.next_tick_at`), now-as-tick, refresh placeholder removed (`precondition_failed`), tick not carried in `queueHour`. |
| 2 | Fixed | `d9_suppression.test.ts` "a plan job due after the deadline pairs": narrowing to `b.due_time <= a.due_time` faults `conflicting_write` at 1800. |
| 3 | Withdrawn by the dev, PM accepted | `proposal.ts:289` is back to `groups.get(partner ?? job_id)`. Nothing left to test. |
| 4 | Fixed | `job.ts:30` allowance back to 44. `status/fatal.ts` keeps the old op order (adjust, close, end, death). `accepted(visit…)` differs from `accepted(world…)` only in the default rng, which is passed explicitly. |
| 5 | Fixed | `mechanics.md:2365` cites `loka-kgd.104`. |
| 6 | Open (nit) | The commits say "Self-review", but they do not report a `/code-review` result. Report it in the PR body when the batch PR opens. |

- Import graph (value imports, resolved by a script): `status/fatal.ts` is in no cycle. Its imports (`combat/round_attack`, `combat/shared`, `death/sequence`, `status/shared`) are the ones `job.ts` already had. Only `job.ts` imports it.
- Mid-chain assumption ("the row's job is completed" means mid-chain): the only path that leaves an active timed row on a completed job is a crossed status sub-step (`job.complete` with no successor). The last sub-step, an expiry or a fatal end rewrites that row in the same drain. A cure followed by re-application gives a new pending job, and the old sub-step then completes with no change. `now()` returns only faults, so no partial drain is committed. A permanent row has no job id. Only `runStatus` reads `next_tick_at`, and it uses the carried tick. Safe.
- Known limit (`mechanics.md:1813`) is honest. Probe with the test's cartridge: one advance of 60 or 130 s matches job-by-job play. An advance of 150, 180, 200 or 300 s faults `precondition_failed`, where job-by-job play is accepted: the refresh at 60 writes ends 150, and the composer requires `ends_at > now` (`compose_status.ts:21`). The fault starts at "at or before the advance end", as documented. This is no regression against base, where a crossed successor faulted. Tracked in Beads `loka-kgd.104` (comment of 06:58).
