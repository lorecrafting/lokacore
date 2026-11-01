# Second opinion: catch-up folds saturated permanent status ticks, PR #535 (loka-sgqk, kernel_api 1.130)

- PR [#535](https://github.com/lorecrafting/lokacore/pull/535) `engine/catch-up-fold` at `178763539e20540290ffb923c722c3611154c13c`, required because the diff changes `kernel/ts/src/runtime/proposal.ts`.
- Governing: `br show loka-sgqk` notes; [mechanics.md W8 Catch-up](../system/mechanics.md) (line 2407); [cartridge.md status declarations](../system/cartridge.md); [first review](2026-10-31-catch-up-fold-review.md), read only after the checks below.
- Reviewer: independent of the author and the first reviewer.
- CI at head (`gh run list --commit`): ci 41260441814, book-e2e 41260441752, graph-diff 41260446644, all success.

## Must be true (written before reading the first review)

1. Only no-op ticks fold; the end state equals job-by-job play, barring the ruled exceptions.
2. Host `boundary` and kernel read one predicate.
3. A fold never crosses a pool-changing tick, a fatal tick, a self-moving pool, a listener or another pending non-folding job.
4. No protocol, event or receipt shape change; one `status_ticked` per run; no RNG or fact write.
5. `next_tick_at` is the first tick after the target or at or after the next queued run; checked add unchanged.
6. Cold reopen, fenced COMMIT, lost ack and receipt replay work.
7. Showcase and hash fixtures frozen.
8. The compiler refuses item, room, tag and the default subject on status events; non-ticking permanents stay legal.
9. The month costs 11 steps, 22 ticks, 11 `clock_hour`.

All hold at this head.

## Findings

**nit** PR body line 21: "`permanent_tick.test.ts` 18 pass" under "Local runs at final code". The file has 21 tests at this head, all passing. No behaviour impact; correct it in any later body edit.

No blocker, no should-fix.

## First-review dispositions

- Blocker `job.ts:153`: fixed by walking `queue.slice(self + 1)`. Restoring the exact loop of `6b9077fd4` fails only "a fold does not jump a raise's queued sub-step" at 28801 and 72001.
- Should-fix `mechanics.md:2407`: the same-time exception is in the text.
- "Predicate duplicated" nit: gone from the body.
- `/code-review` coverage nit: the body now reports a second run through `fefaeb311`; `178763539` after it adds one test (`git log` confirms).
- `cartridge.md:1015` nit: fixed; the line now names the non-body holders the checks do not reach (never fold, one step per tick).

## Scenarios

Scratch test in a detached worktree, deleted after. Differential: 500 random cases across three seeds (hungry and fed period and amount, timed or permanent fed, floor or max saturation, target up to 45 h, driver with cold reopen after each pulse on even cases, versus job-by-job, versus one direct `elapsed`), comparing hunger, thirst, hp and every status row's `next_tick_at` and `ends_at`.

- Driver equals job-by-job in all 500. Direct differs from both in 5 cases, all at hungry 2500 and fed 5000: the ruled same-time tie.
- `clock_hour` applying a raising status while folded: hunger 0 as stepwise at 8 h, 48 h and a month. It is applied at clock `to`, so the first tick falls after the target: the documented lateness.
- `hp` draining by a second status while `hungry` folds, periods 1301, 3607 and 2500: driver and job-by-job match, with the clock at the target.

Cleared by reading:

- `proposal.ts:271` is the only `decideAt` caller with a queue; `schedule/rule.ts:103` `decide` passes none, so it folds 1.
- A stale, complete or moved queue entry, or `self === -1`, only lowers the horizon.
- A cured or removed row is a `job_ran` no-op; a re-apply mints a new job and the old entry is conservative; a permanent re-apply is a no-op (`shared.ts:144`).
- A death clear or return comes only through non-folding stops or actions.
- A sub-step past a fold is re-enqueued, so the already-due guard at `elapsed.ts:67` cannot fire from a fold.
- Overflow: the product is at most target plus `tick_every`, the same value job-by-job reaches, and the checked add throws identically.
- Fatal requires `by < 0`, so it never folds.
- `status_ticked` consumers are `reaction.ts:243`, `job.ts`, `fatal.ts`. No Elixir fold rule exists to differ; Elixir holds only the compile refusal.

## Test the tests

`bin/mutate_diff.sh origin/main` at head: 42 mutants, 40 run, no TIMEBOX, red-narrow 37, SURVIVED 3 (the handback's three), BASELINE-RED 2. Each is cleared by hand:

| row | hand mutant | result |
|---|---|---|
| `job.ts:121` | drop `if (!held)` | `elapsed-driver.test.ts` + `permanent_tick.test.ts` 10 red |
| `status.ex:64` | `\|\|` to `&&` | holder test 4 red |
| `status.ex:78` | `or` to `and` | holder test 1 red |
| `elapsed.ts:70` | `!==` to `===` | 5 red |
| `elapsed.ts:70` | `&&` to `\|\|` | month test red |

The tool's baseline for `elapsed.ts` failed in my worktree, cause not chased; the same two files are green unmutated there (39 pass), and hosted CI is green.

Further hand mutants at `job.ts`, all red: `queue.slice(self + 1)` to `queue`; `due_time - 1` to `due_time`; `due_time > horizon` to `>=`; drop the `+ 1` on the tick count. Planted compiler holes, all red: `tag` dropped from `off_body`; `status_ticked` dropped; the `ticking?` filter off.

No expected answer or frozen fixture touched; the only `mobile/app/stories/live/*.sql` change is the version bump. Test literals are hand-traced. Composition record present; capability code names no mechanic or content beyond the calendar job 2407 requires. No over-engineering finding.

## Claims rerun

- "No shipped content raises via `clock_hour`": backed, listed every `clock_hour` reaction.
- "18 pass": not backed, nit above.

## Not run

Full suites (hosted CI is their run). Device timings.

**Verdict: APPROVE WITH NOTES**
