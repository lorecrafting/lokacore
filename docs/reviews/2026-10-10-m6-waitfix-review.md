# Review: one wait across several listed schedule hours (loka-qi0r)

- Branch `toolbox/m6-waitfix`, head `e35fcb7851028cd5ac8f913943f25a2fb6d1b7cf`, base `origin/toolbox/batch-m6` `89a277c8` (7 files). No PR (batch lane); the batch head is now `23276c6e`, and a trial merge onto it is clean and does not touch the drain files. Kernel drain contract, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [mechanics.md schedule@1](../system/mechanics.md#schedule1-behavior1-calendar1-mechanicsschedulerulets-kernelts-srcmechanicsschedulebehaviorts); [protocol.md](../system/protocol.md) `job.schedule` (`nonfuture_job`); [numeric-profile.md](../spec/conformance/numeric-profile.md) Job CommandId; `adverse-cases.json` `nonfuture-job`. PM decision option (b), no contract change, and accepted limit loka-j2mo (Beads `loka-qi0r` comments).
- Hosted CI on the head: ci and book-e2e both success.
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, one question).

## Must be true

Written from the spec and the PM decision. The diff was read first, so this list is a check, not a framing guard.

1. One wait across N listed hours of one NPC commits. Each crossed hour moves the NPC and gives an arrival at that hour, and its reactions fire. One successor job is due strictly after the target.
2. The steps sit in `(due_time, job_id)` order with the other due jobs. Each step reuses its job's writer group and runs under a distinct CommandId. Replay is identical.
3. Every other job kind still faults `nonfuture_job`, and the composer case is unchanged.
4. Each step counts toward `due_jobs_per_advance`.
5. Chapter 1 receipts and the corpus are unchanged.
6. The accepted limit (loka-j2mo) is documented.

## Proof

- (1, 2) `schedule.test.ts` and `schedule_cases.test.ts` green at the head. A probe on the 06:00 to 19:00+1 wait gives three distinct event and causation ids. In budget probes, 512 days (1024 steps) commits and 1025 steps faults `due_jobs_per_advance`.
- (3, 5) On the trial merge (exit 0): schedule, schedule_cases, sim, sim_mechanics, chapters, e1_*, missing_child, missing_child_finale, portable_abi (consumes `adverse-cases.json`), rumour, quest_deadline and hounds. Splicing into `due` is safe because `nextHour` is strictly later, so a step is always inserted after the current one.
- W3 parity (`schedule_cases.test.ts`): the single 16:30 to 18:30 wait and the 17, 18, 18:30 waits match on arrivals, facts and room.
- Test changes: `schedule.test.ts:143` drops the old fault half because that behaviour is meant to change; the "a fault adopts nothing" pin remains at `schedule.test.ts:240`. `sim.test.ts:95`: the MAX_SAFE wait now trips `due_jobs_per_advance` before any successor is scheduled, which is intended. The sim no longer reaches `nonfuture_job`, but `portable_abi` (`nonfuture-job`) and the unit tests still pin it.
- Elixir has no drain. Its only part here is `job_command_id/2`, so there is no parity case.
- Budget headroom: Chapter 1 has 12 listed hours a day, but `real_elapsed` disables player Wait. The other shipped cartridges have at most 6 a day (variants_sampler), so a wait reaches 1024 steps only after about 170 days.
- Mutants, run against the two schedule test files: `proposal_hours.ts` splice at the end, killed; `cmp(...) > 0` to `< 0`, killed; `proposal.ts` group reverted to partner only, killed. Three survived: `j.due_time > next` to `>=`; `due.length` to `due.length - 1`; CommandId from `current.due_time`. The last one gives duplicate event ids (two `entity_entered_room` events, both `5786a91b…`) and is still accepted.

## Findings

1. **blocker**, `kernel/ts/test/schedule.test.ts:143`: three of the six mutants survive.
   (a) In `proposal_hours.ts:14`, `>=` queues a crossed hour before an equal-time original job with a smaller id. Its event order then breaks the `(due_time, job_id)` order, but no test ties a crossed hour against an original job. Probe `withAda({'6': green})`, wait to H(30): the head orders ada then bram at 108000; the mutant orders bram then ada.
   (b) In `proposal_hours.ts:17`, `due.length - 1` lets a 1025-step wait commit. The test pins only 1026 steps.
   (c) In `proposal.ts:280`, `current.due_time` puts every step under one CommandId, so one decision commits duplicate event ids.
   Fix: add one case for each.
2. **should-fix**, `docs/system/mechanics.md:654-660`: the accepted limit is not documented. The same reaction firing twice in one wait faults `conflicting_write` (loka-j2mo), but the schedule paragraph claims parity with hour-by-hour play and gives no limit.
3. **question (PM)**, `docs/spec/conformance/numeric-profile.md:70`: the spec says a `run_job`'s occurrence "is its due time; a job row is one occurrence … completed once". Each crossed step now runs a completed row under the occurrence of a different hour (`proposal.ts:280`). Readers that check `causation_id === jobCommandId(job_id, due_time)` (`combat/credit.ts:105`, `compose_sight_rebind.ts:77`, `deer-save.ts:116`) read no schedule job, so nothing fails today. Does an occurrence other than the row's due time amend the Job CommandId clause? If so, amend the clause; if not, the PM records in Beads that it is not a contract change.
4. nit, `kernel/ts/src/runtime/proposal_hours.ts:17`: `due.length` also counts due jobs that the drain skips (stale rounds, jobs already completed), whereas compose counts `job.complete`. The limit can therefore fault early, but only when an hour is crossed.
5. nit: the developer's `/code-review` result is not reported in the Beads hand-off.
