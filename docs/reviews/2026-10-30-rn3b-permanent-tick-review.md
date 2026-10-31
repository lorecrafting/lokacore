# Review: Permanent ticking status, PR #526 (loka-rn3b, loka-dw0k, kernel_api 1.128)

- PR [#526](https://github.com/lorecrafting/lokacore/pull/526) `feat/rn3b-permanent-tick` at `e8c5633915c0f2a58e2ed4c35bfe68cc19e49a76`, diff `origin/main...e8c563391`.
- Governing: `br show loka-rn3b loka-dw0k` (owner: hunger and thirst stay until you eat or drink, and drain while they last); [mechanics.md W8](../system/mechanics.md); [cartridge.md:22](../system/cartridge.md) (no cartridge `at_least` moves); [save.md](../system/save.md#opening-a-story) (pin carries kernel_api); AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **APPROVE WITH NOTES** (one should-fix as a follow-up issue, one nit, one question).

## Must be true (written before reading the diff)

1. A permanent status may tick (`tick_every`, `per_tick`), has no `ends_at`, never expires, and ends only by a cure (or a fatal tick).
2. A cure ends the row; any pending job is harmless after it (stale job finds no active row), in TS; the Elixir composer accepts the same transitions (shared fixture).
3. Refreshing an active permanent row writes nothing (no second job, no stacking); permanent never turns timed, nor timed permanent.
4. Elapsed catch-up and cold reopen reach the same state as live play.
5. kernel_api 1.128 only in `INSTALLED` (`world.ts`); an older save pin is refused; no cartridge `at_least` moves.
6. Compiler: a timed status still requires `narration.expired`; a permanent one may omit it; `per_tick: 0` still refused.

Results: 1-6 hold. Cure path: `cureOps` -> `endStatus` (`shared.ts`) writes the inactive row; the stale job completes in one tick, as for timed statuses. Contract: `world.ts:108` is the only `1.128`; `authority.ts:98` refuses any other pin (`release_pin.test.ts` 4/4).

## Findings

1. **Should-fix (follow-up issue), `mobile/authority/local-story/elapsed.ts:61`** (`boundary` stops at every pending job; `drain` 16 steps per pulse, `:144`). Measured with both showcase needs (tick_every 3600, rate 50): a week away is about 8400 steps, a month about 36000, at 2.9-5.4 ms per step growing with the save (+9.6 KB per step; completed job rows are never pruned, `job.ts` successor). A month is about 36000 x 9.6 KB, roughly 345 MB of save growth and several minutes of catch-up; two of the three job rows per step come from this PR. One unstepped month-long `elapsed` faults `budget_exceeded`. Non-blocking: the stepping path predates the PR (the showcase already steps about hourly) and the PR lists both as Open. Scenario: a player returning after a month waits minutes with a save hundreds of MB larger. File a Beads issue (none exists).
2. **Nit, `mobile/authority/local-story/permanent_tick.test.ts`.** The month catch-up applies one ticking permanent status; the showcase applies two (`reactions/needs_enter.json`). Not a correctness gap (same path), but the cost above is untested.
3. **Question, `kernel/ts/src/mechanics/status/job.ts:114`.** A ticking permanent status on an item or room ticks forever (`amount` returns 0, `status_ticked` still emitted) and never ends unless cured. No current content applies one (needs are player-only, `npcs/wat.json` immune); the compiler (`lib/loka/content/status.ex`) does not prevent it. PR lists it Open. Non-blocking; PM to decide whether to file.

## Test the tests

- `bin/mutate_diff.sh origin/main` at the head: 46 run, 33 red-narrow, 13 SURVIVED (handback: 26 BASELINE-RED + 20 NO-TESTS; a red baseline proves nothing, so this clean-baseline run is the evidence). The survivors' killing tests do not import the mutated module: `resources.ts:74` x2, `status.ex:93/:119/:127`, `job.ts:75`; each line cleared by a hand mutant below.
- Hand mutants, each red: `resources.ts:74` `!==`->`===` (needs.test.ts:141); `status.ex:127` drop `permanent?(s) or` (content_scars_test); `status.ex:119` `and not permanent?` -> `or` (content_scars and content_status, 3 failures); `status.ex:93` `>=`->`>` (content_status_test); `job.ts:75` `||`->`&&` (showcase_body.test.ts, 6 failures).
- Claim reruns: `job.ts:61` `?? Infinity`->`?? 0` fails `permanent_tick.test.ts` (backed); "mobile permanent_tick 1/0" passes (backed).

CI on `e8c563391`: ci success, book-e2e success, graph-diff success (one `gh run list --commit`).
`/code-review medium` reported in the PR body.
