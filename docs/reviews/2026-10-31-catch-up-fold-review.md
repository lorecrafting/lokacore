# Review: catch-up folds saturated permanent status ticks, PR #535 (loka-sgqk, kernel_api 1.130)

- PR [#535](https://github.com/lorecrafting/lokacore/pull/535) `engine/catch-up-fold` at `6b9077fd4734c6dbf0992a94315e21511d18fe48`, diff `origin/main...6b9077fd4`.
- Governing: `br show loka-sgqk` notes (brief, A1-A9, PM ruling: horizon option B, first tick at or after H); [mechanics.md W8 Catch-up](../system/mechanics.md); [cartridge.md status declarations](../system/cartridge.md); [save.md Status recovery](../system/save.md).
- Reviewer: independent; authored none of the work.
- CI at head (`gh run list --commit`): ci, book-e2e and graph-diff success.

**Verdict at `6b9077fd4`: CHANGES REQUIRED** (one blocker, `job.ts:153`). **At `178763539`: APPROVE**; see Re-check below.

## Must be true (written before reading the diff)

1. Host `boundary` and kernel use one predicate; a host skip without a kernel fold would fault `budget_exceeded`.
2. A fold never crosses a pool-changing tick, a fatal tick, a self-moving pool, a listener or another non-folding pending job (calendar job excepted).
3. No protocol change. A folded run writes `job.complete`, `status.transition`, `job.schedule` or sub-step, one `status_ticked`, no `resource.adjust`; a single saturated tick is byte-identical; transcripts and hash fixtures unchanged.
4. No Book change; the log has tick lines only for real changes.
5. The compiler refuses a ticking permanent through `item`, `room`, `tag`, or the default subject on `status_applied|ticked|expired`. The next tick is the first at or after the horizon, phase preserved.
6. A1-A9 (month: 11 receipts, hunger and thirst 0, hp 10, `next_tick_at` `t0+MONTH+3600`). Showcase month at most 1 min and 50 MB.

Clause 2 fails in one case; the rest hold. No `cartridges/`, protocol or frozen fixture file in the diff.

## Findings

**blocker** `kernel/ts/src/mechanics/status/job.ts:153`. `due_time === clock && other.status !== 'pending'` is meant to skip entries that already ran, but also skips a crossed sub-step entry that has not run: at its second tick in one advance the other row is `complete`, and it sorts after the folder. The fold then jumps past it, breaking mechanics.md:2407 ("at or after the next queued run"). The kernel_api pins replay, so a later fix needs another bump.

Scenario (patched fixture; a showcase copy with a permanent +1 hunger status compiles): hunger start 0, `hungry` -1 per 3600, permanent `fed` +1 per 7200, `thirsty` tick 1e7. One `elapsed` from t0, stopping at the listed target. Reproduced through direct `elapsed` only. ClockDriver does not hit it, since `boundary` stops at each non-folding job. A scripted action's `time.advance` (`scripted_action/rule.ts:106`) takes the same path by reading only, not run; I found no shipped showcase action with a duration.

| until | head direct | no-fold direct | job-by-job | driver |
|---|---|---|---|---|
| t0+28801 | 3 | 1 | 0 | 0 |
| t0+72001 | 9 | 1 | 1 | 0 |

At head `hungry` ticks stop at 14400 until past the target. All tests stay green: the existing raise tests (`permanent_tick.test.ts:310,327`) cross only the first sub-step, whose row is still pending. No shipped cartridge has an opposing ticker on a foldable pool (hunger 1 drain, thirst 2 drains). Trial fix, position in the queue instead of status: `let past = false; for (...) { if (id === job_id) { past = true; continue; } if (!past && due_time === clock) continue; ...`: 18/18 pass, probe 1 and 1 with every tick kept, matching no-fold. The fix needs this scenario as a test.

**should-fix** `docs/system/mechanics.md:2407`. "The end state equals job-by-job play" has no equal-due exception. Scenario under ruling 2 below.

**PM follow-up, outside this PR, not blocking** `mobile/authority/local-story/liquid-save.ts:30`. Cold open replays receipt history each launch; evidence in ruling 3. Pre-existing; no fix asked of this slice.

**nit** PR body line 32, "predicate duplicated in elapsed.ts": `elapsed.ts:16` imports `folds`. Stale.

**nit** PR body: `/code-review medium` stops at `b0fe0b4f9`; later commits (from `7a4e0c849`) had none. Run it in the fix round.

**nit** `docs/system/cartridge.md:1015` "on a body only" overstates: see ruling 1, weathering.

## Rulings

1. Open `/code-review` items.
   - `mechanics.md:2407` calendar reaction lands later: accepted, documented. I listed every `clock_hour` reaction in all cartridges: status drains, `fact.assign`, raid spawn. None raises a folded pool, confirming the brief's sentence.
   - `status.ex:77` non-body default subject: accepted. A showcase copy with `fact_changed` applying `hungry` compiles (`reaction.ts` subject may be an item). `folds` is false off a body, so one step per tick: cost only, no wrong state, no fault. Matches cartridge.md:1015's enumerated list.
   - `status.ex:62` structure weathering: accepted. `build_sampler` copy with permanent weathering compiles; shipped weathering is timed. Never folds; cost only.
2. Same-time tie: not a bug, a missing spec exception. `thirsty` +5 per 72000, until 82801: head direct 2, stepwise 1, driver 2; no-fold direct 2, stepwise 1, driver 1. The direct-versus-stepwise gap exists before this PR: equal-due order is by minted job id, and chunking changes the ids. The fold moves the driver from 1 to 2, which is one of the valid orders. Add to 2407 what mechanics.md:2053 row 1 says for sub-steps.
3. Job growth: expected, not a leak; unbounded and linear, not caused by the fold.

   | absence | job rows | pending | receipts | save MB | catch-up (segment) | move ms |
   |---|---|---|---|---|---|---|
   | fresh | 27 | 26 | 2 | 0.12 | | 4-5 |
   | 7 d | 1188 | 26 | 183 | 2.5 | 1.4 s | 5 |
   | 30 d | 4969 | 26 | 751 | 10.1 | 15.5 s | 7-8 |
   | 60 d | 9904 | 26 | 1492 | 19.9 | 41 s | 11 |
   | 120 d | 19750 | 26 | 2954 | 39.5 | 223 s | not run |

   Pending stays 26. Finished rows are never pruned: about 165 a day, mostly replenish and population, with status and calendar about 2 and 1 per step. Per-action cost is small. The limits hold at a month, but segment cost per day rises (0.5, 1.4, 3.7 s), so a two-month absence passes 1 min, and 50 MB falls at about 150 days. I did not locate the step-cost growth. Cold open is the larger cost: at a month one `load` took 23-29 s, of which `liquidSave` (`receiptHistory`) was about 23 s and `commerceSave` 3-5 s; the harness reopen took 34-56 s and logged two `load` calls, cause unconfirmed, so a real launch may pay one. All under concurrent mutate load, on a laptop. Neither path is in this diff, and pre-fold receipts were about 36k. A follow-up for the PM: finished-row pruning and receipt replay on open.

## Test the tests

- `bin/mutate_diff.sh origin/main`: 43 run, 40 red, 3 SURVIVED, the same three as the handback, no TIMEBOX. Cleared by hand: `job.ts:121` drop `if (!held)` (`elapsed-driver.test.ts` 10 red, tsc TS18048); `status.ex:64` `||` to `&&` (holder test 4 red); `status.ex:78` `or` to `and` (holder test 1 red).
- Hand mutants in `permanent_tick.test.ts`, all red: `floor+1` to `floor` (month, one second before); listener filter inverted (predicate table, listener); kernel no jump (month, one second before, COMMIT fence); host no carve-out (month). The last two pair prove R1.
- R1: `boundary` (`elapsed.ts:70`) and the kernel import one `folds` with no clock read; they cannot diverge by construction.
- Expected values in the tests are hand-traced literals; no fixture or expected answer touched; no change detector found. Composition: the fold names only the calendar job, as 2407 requires, and the new `status/job.ts` import of `schedule/daily.ts` makes no runtime cycle (walked `daily.ts`'s non-type imports; none reaches `status/job.ts`). No over-engineering beyond what the PR lists as accepted.
- PR claims rerun: showcase month (my run 751 receipts, 4969 jobs, 10.07 MB; body 738, 4968, 9.9 MB; backed, the small gap is my route's moves); "predicate duplicated" not backed (nit above).

## Not run

Full suites (hosted CI is their run). 120-day move and reopen timings, stopped for time. Device timings.

## Re-check at `178763539e20540290ffb923c722c3611154c13c`

**Verdict: APPROVE.** This supersedes the first-round verdict above, for this head only. Scope: fix commits `fefaeb311`, `178763539`, the code they touch and its direct callers. CI at this head (`gh run list --commit`): graph-diff, ci and book-e2e success.

Dispositions:

- **Blocker `job.ts:153`: resolved.** `foldedTicks` (`job.ts:150`) now reads only queue entries after this run. The hungry/fed scenario rerun at this head, direct `elapsed`: to t0+28801 gives 1, to t0+72001 gives 1 (head before the fix: 3 and 9).
- **Should-fix `mechanics.md:2407`: resolved.** The exception for same-time ties matches the tie measurements of the first round.
- **`cartridge.md:1015`: correct.** "A non-body holder those checks do not reach ... never folds" matches `folds`, and `weathering` exists at `mechanics.md:3494`.
- **New tests: fail on the bug.** `permanent_tick.test.ts` passes at this head (21). Hand mutants on `job.ts`, each restored:

| mutant | red |
|---|---|
| old skip line restored | both sub-step cases |
| no position (`of queue`) | "already ran", "a month of catch-up takes 11 steps" |
| `findIndex` by id only | "already ran" |
| `slice(self + 2)` | 6 tests |

- **Size allowance 570 to 600: acceptable.** 597 lines, under the 1.5x cap of 750 in `bin/check_ts_size.mjs`, with a reason; every case shares one compiled fixture and harness.
- **Record commits: review material only.** `c9904b89f` touches the record and `docs/reviews/README.md`; `627f31ff8` touches the record. Each has the same tree as my commit (`git diff 601f6d9c6 c9904b89f` and `git diff 048c0a776 627f31ff8` are empty).
- **Nits:** `/code-review` is now reported in the PR body. No diff under `cartridges/toolbox_showcase`.

Rulings on the developer's `/code-review` items; none is a real risk:

- `elapsed.ts:70` calendar budget exposure: not reachable. A reaction cannot adjust a pool (`reaction.ts:331` throws `precondition_failed`; the probe faulted `evaluator_error`). A status the calendar applies is due after the step's target, so it never joins that drain. Probe: hunger 5000, `hungry` -1 per 70, calendar reaction applies `surge` +2000 (duration 150, tick 100), driver to 3590 then 400000: no fault, 367 pulses, clock 400000, one tick per step after the raise, none over `due_jobs_per_advance`.
- `elapsed.ts:70` no kind guard: cost only; `folds` returns false at `if (!held)` for a non-status job.
- `job.ts:150` per-tick scan: runs only on folding ticks, and the queue is capped by `due_jobs_per_advance`.
- `job.ts:156` repeated calendar exemption: two one-line sites, host and kernel, one reason, both named by the spec. Leave it.
- `rule.ts:59` positional queue: one caller passes it (`runtime/proposal.ts:271`), types check, and absence means no fold.

Open: nothing from this re-check. The PM follow-ups above stand.

Not run in this re-check: full suites, a device, `bin/mutate_diff.sh` on the fix (hand mutants instead), `bin/check_ts_size.mjs` directly (read it; CI green). The compiler's handling of `resource.adjust` in a reaction was read, not run; the runtime refusal was run.

**Final verdict at `178763539`: APPROVE.**
