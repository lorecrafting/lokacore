# Review: open-time catch-up refusal offers Start over (loka-k3b5, PR #541)

PR #541, commit `9d2ed1dcac712006d76ee4ab23b4a967ebe0399e`, merge-base `a3f0d3b39`. Governing: [save.md](../system/save.md) refusal table and elapsed recovery paragraph, [storage lessons](../lessons/storage.md), `br show loka-k3b5`. CI at the head (`gh run list --commit`): `ci`, `book-e2e`, `graph-diff` all success.

## Must be true (written before the diff)

1. A deterministic refused catch-up at open returns the recovery route, not a throw; the failure loop ends.
2. A refusal leaves the refused step's bytes unchanged; `remove` never runs.
3. Start over works, the new run plays, the trace survives.
4. A valid catch-up is unchanged (65300).
5. A lock, full disk or read error never offers Start over; a fault keeps game and debt.
6. A kernel-caused failure does not read as damage, or the wording says why it cannot.

## Findings

**Blocker. `mobile/authority/local-story/elapsed.ts:70`, `open_catch_up.test.ts:56`.** Mutant `<=` to `<` survives `open_catch_up` and all of local-story. A job forged with `due_time` equal to the clock (64800) refuses at the head; under the mutant the game opens at 64800 with the bytes changed, a damaged save with no Start over offered at the save error screen. The test forges `due_time` 1, so the boundary is unpinned. Fix: forge 64800 at line 56; run: head 5 pass, mutant red on that test. The comparison is byte-identical to main, but it is in this diff's hunk and this PR makes it decide whether Start over is offered, so the mutant rule applies.

**Should-fix (follow-up issue before closing loka-k3b5). `kernel/ts/src/runtime/world.ts:213`, load's job validation.** The same failure loop remains for a job row of a known kind and forged body: kinds `quest, bleed, room, rule, tick, replenish` and an unknown kind, due 64900, throw `TypeError ... schedule_cases`; no Start over, bytes intact, every launch. The issue is fixed for refused elapsed results, not for this class. Do not widen the catch at `authority.ts:119`: it would call a kernel bug on a good save damage. Fix load to refuse the job row, a separate slice.

**Nit. `open_catch_up.test.ts`.** `save.md:262` claims "steps settled before it stay committed"; no test pins it. Probed: steps 64900, 65300, conflict on the second: launch one commits step one then refuses; launch two is byte-identical; Start over plays at 64800.

**Nit. `delivery.ts:71`.** `effect outbox not built` is a further deterministic plain throw at open; disclosed in the PR, unchanged.

## Rulings (real SQLite, at the head)

- Transients: lock before BEGIN and for the whole open, `disk I/O error` at receipt lookup, failed COMMIT, lost ack, full disk: all plain errors, `startOver` false, `remove` never ran. Requirement 5 holds through the save error screen.
- Clocks: wall 1e12 to MAX_SAFE opens at 712800, 16 receipts per launch; clock -1 or 1.5 is `invalid elapsed clock evidence`, no Start over.
- Kernel fault at open (`elapsed.ts:140`): accepted. This PR's new fault return routes it into the Book: game opens at 64800, debt kept, "Time stopped: evaluator_error" (`presenter.ts:70`), keyboard off, Start over the one control (`lines.tsx:273`); before, a plain throw with no Start over. Requirements 5 and 6 hold: debt kept, nothing removed, it does not read as damaged; deletion only through the confirm dialog (`App.tsx:105`), as at play time. Residual: a kernel bug on a good save that an update would clear can still lead a player to confirm; owner wording is a Beads follow-up, not this slice (owner writes player-facing words). Trace one row per launch (2, 3, 4), so bytes change by the trace only; no heartbeat retry (`App.tsx:146`).
- `stale_view` (`elapsed.ts:141`): keep. `expected_run_id` is the row just read; a forged checkpoint of another run is refused by load first; a replaced run comes through `checkRun`. Effectively unreachable at open.
- Wording, `save.md:23`: holds, no edit required. Already-due cannot come from a lawful save (`compose_job.ts:24`); conflict needs a forged receipt. Kernel version: same `kernel_api` with a new `kernel_version` caught up to 65300; a contract bump is refused at the pin (`authority.ts:96`) as `pinned_release_missing`. The residual route is a contract change without a `kernel_api` bump plus an old rejected receipt at the same step: the #514 class, closed by loka-daha's rule.
- Rejected decision: not playable. Ancestry bundle, forged debt: opens with status fault `invalid_state`, every action returns that fault, stable across launches. Recovery is the Book's Start over. Accept.
- `ElapsedRecoveryError` at the open pulse: another run's header gives `save run replaced`, no Start over; the next launch reopens, not a loop. A malformed run id reaches `replace` through the `corrupt()` message match: needs a concurrent writer, pre-existing.
- Disputed self-review: `elapsed.ts:64` subclass kept, retyping would change `statusOfError`. `authority.ts:119` guard kept. `authority.ts:124` not using `refuse` is fine, `words.ts:44` handles the absent message.
- Multi-step: earlier settled steps staying committed is correct, they are valid progress.

## Test the tests

`bin/mutate_diff.sh origin/main`, `MUTATE_MINUTES=15`, twice: all 7 rows BASELINE-RED, 0 run; local-story itself is green (489 tests, 0 fail), so the reach into other packages failed in this worktree, not a PR defect. Replaced by hand mutants through `bin/mutate.sh`: guard removed, return to throw, `s.behind` removed, already-due throw removed, fault return removed, delivery refusal to plain Error: all red-narrow. `<=` to `<`: survived (blocker above).

PR claims rerun: implementation back at the merge-base gives 4 red, the full-disk test green, as the body's control states (it counted 3 of 4 before the fifth test). Guard removed is red on the full-disk test, as listed. Tests use literal expected values, real files, no mocks; no frozen fixtures touched. Nothing to delete. `/code-review` reported in the body.

Not run: the fault display in a browser (read from code, status confirmed at the session).

Verdict: CHANGES REQUIRED

## Re-check at a58b6936e03b36adc4f63cdedfe4cb0abfde172f (fixes a3279fed6, a58b6936e), full review of the fix

Must hold ([save.md:262](../system/save.md)): a job row no handler can run is `save_corrupt`; a save written by normal play never is. A cold open never throws a raw TypeError from such a row.

CI (`gh run list --commit`): ci 41275992471, book-e2e 41275992432, graph-diff 41275996708, all success.

### False-refusal hunt: 0 refusals

- Every lawful writer read: off-hour NPC rows carry a marker (`combat/rule.ts:56`, `round_flow.ts:220`, `disposition.ts:163`, `expedition/sequence.ts:146`) or come from `nextHour` (`daily.ts:68`, `rule.ts:147,152`). Completed rows keep markers (`compose_job.ts` spreads the row).
- Local-story suite, `jobSave` after every commit: rows bleed, calendar, npc with and without encounter (completed and pending), order, population, crow, sight, quest, reaction, replenish, room water, status.
- Random walker on real file SQLite, 14 reopens each: showcase seeds 2-5, build_sampler, bleed, shoo, expedition, penalty, containers_sampler_v010.
- Long run: showcase seed 7, 62 game days, 72 h jumps, 5 reopens, 1611 receipts, about 8292 finished rows.
- `kernel/ts/test/sim.test.ts` with the row check after each step: 0.
- An edited schedule cannot reach an old save: the save's `pin.content_hash` selects its release (`authority.ts:94`), so the row is judged against the cartridge that wrote it.
- A `schedule_cases` hour cannot refuse: `nextHour` is only given `daily_schedule` (`daily.ts:68`, `rule.ts:147` through `scheduleOf`, `daily.ts:28`), so a due hour is always one of its keys; `.scene` lowering derives cases and fallbacks from one key set (`schedules.ex:77-84`). Keys read back through `hourOf` (`calendar.ex:114-119`).
- A killed scheduled NPC cannot refuse: nothing deletes from `world.entities` (`created.ts:91` only adds), so `npc?.kind` still reads `npc`.

### Cost

19750 NPC rows, worst path: 84-124 ms against a 23-29 s load (loka-qhvgq, mostly `liquid-save.ts:30`). Acceptable. Synthetic world, this machine.

### Test the tests

`bin/mutate.sh` hand mutants, tree restored. Red: `elapsed.ts:70` `<=` to `<` (the blocker mutant), hour check dropped, `same` skip dropped, replenish lookup true, wage gate true, kinds order, reaction and `CLOCK_JOB` removed, `water_generation` removed. Survived: see nit below. Forged cases fail on their planted rows; `open_catch_up.test.ts` 15 pass. `bin/mutate_diff.sh` not rerun (BASELINE-RED here in round one).

### Findings

**Should-fix, non-blocking. `job-save.ts:8-27`.** It mirrors `decideAt`'s dispatch (`schedule/rule.ts:74-99`) with no shared table and no sync check. A new job kind added to `decideAt` alone is refused as `save_corrupt` on each reload holding a changed row of that kind: Start over offered on a good save. Only a cold reopen in that kind's walkthrough catches it. Cheapest fix: a comment at the dispatch naming `job-save.ts`, or a Beads follow-up.

**Nit. `job-save.ts:14,15,25`.** `row.crow_phase !== undefined ||`, `row.sight ||` and `npc?.kind === 'npc' &&` survive their mutants. Sight and crow rows carry kind `population` (`crow/shared.ts:22`, `population/behavior.ts:135`) and an item ref has no `daily_schedule`, so for lawful rows all three are deletable. Only a forged row differs.

**Nit. PR #541 body.** Says "5 pass" (15 now), omits `job-save.ts`, its `/code-review` range `origin/main..e919b218a` does not cover it, and Open says forged kinds' TypeErrors are "Unchanged from main", now false. Forged-kind refusal and mutant-red claims rerun and backed; these are not. Fix in the next push or at merge.

### Notes and questions

- Question: a spawn-template NPC with a `daily_schedule` gets a first row and no entity. `placeOf` (`daily.ts:40`) throws at run, pre-existing; the fresh-equal skip keeps the row from being refused. Compiler refusal not confirmed.
- Frozen `sampler_v010_hash`, `reward_storage_hash`, `cartridge_sampler_hash` give `save_corrupt` on first reopen through `custodyValid` (`created.ts`): trunk with no `container: true`. The compiler refuses that source (`entities.ex:227-239`); kernel diff is empty, so not this PR.

Not checked: 120 game days (62 run), a wage row at load (static only, `escort/job.ts:24` matches), a phone, a walker-driven spawned scheduled NPC.

Verdict: APPROVE WITH NOTES
