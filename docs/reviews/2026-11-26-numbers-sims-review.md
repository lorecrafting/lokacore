# Review: Numbers sims under the 90 s timeout (PR #811, loka-hcnlh.70)

- PR #811, branch `fix/numbers-sims`. Reviewed at `031777df726d98bc52f44749b8bff69fc31b67c1` (merge base `7d24bd326`).
- Governing: [architecture.md](../system/architecture.md), pure kernel reducers (a reader must return the same answer for the same world); `play/reports.ts:33` (90 s per report).
- Why a record: this is a kernel mechanics change (`kernel/ts/src/mechanics/status/shared.ts`), and the PM brief asked for one.
- CI at the head (`gh run list --commit 031777df7…`): ci, book-e2e and graph-diff all succeeded.
- `/code-review medium`: reported in the PR body (six findings, one fixed in `031777df7`).
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. `activeStatuses` returns the same list, in the same order, as before for every (world, body, senses), including one state read under several cartridges.
2. The cache never serves data from another state or cartridge, and it is freed when the world is.
3. The view handed to `checked` is the view of the same `before` world `checked` would have built, through the same `gameView`.
4. `resources(w, w.body)` equals `gameView(w).resources ?? []`.
5. Sim output is byte-identical to the base on more than one cartridge.

## Checks run (detached worktrees at the head and at the base; no servers)

- **Cache key (1, 2).** The plan holds only cartridge-derived data: the sorted specs, the refs, and `statusKey(body, ref)` strings. Rows are read live from `world.state.statuses` (`shared.ts:59`). A state collision or an in-place state write cannot give a wrong answer, so the `WeakMap` key on `world.state` only sets how long entries live. The `keys` map is bounded by the bodies queried on one state. One state under alternating cartridges rebuilds the plan on each switch, which is correct.
- **View (3).** `checked` reads `kernel.gameView(before)` only (`test/sim.ts:224`). `delivered` returns `KERNEL` or `ELAPSED`, and both use the same `gameView` (`flows.ts:207`). (4) holds: `view.ts:76,83` uses `bodyOf`, which is `world.body` for the player.
- **Byte-identical (5).** Head and base compared with `cmp` on the same base-compiled artifacts. All SAME: toolbox_showcase `--seeds 2 --days 1` (70.5 s on the base, 10.3 s on the head), and cellar, status, senses and curse samplers at `--seeds 4 --days 3`.
- **`bin/mutate_diff.sh origin/main`.** 7 run, red-narrow 6, SURVIVED 1 (`shared.ts:57`). This matches the PR table. The survivor is a true equivalent: `sensed` is module-private, and both of its consumers re-check `perception` or `concealment` (`shared.ts:237`, `:246-247`).
- **Planted mutants (7 status test files).** Each one turned the suite red.
  - A body-agnostic `keys` cache: 6 tests fail.
  - Dropping `of !== world.cartridge`: `status.test.ts` "a condition is a debuff…" fails.
- **PR red controls, rerun.** Both fail as claimed.
  - The base `shared.ts` against `status_readers.test.ts`: the new test fails.
  - The base `sim.ts` against `flows.test.ts`: "one GameView per step" fails.
- **Freeze controls (the developer's two "left" nits).** Planted: `Object.freeze` on each cached ref, and a deep freeze of the step's view in `flows.ts` `run`. With both in place, the 32 test files that import `status/shared`, `play/flows` or `play/sim` (311 tests) pass, the status and senses sims stay SAME, and the showcase sim does not throw. No in-repo code writes through either object.
- **Tests.** No fixtures or frozen answers were touched. `status_readers.test.ts:113` counts reads, but the count is the regression itself (a re-sort on every call), so it is not a change detector. `flows.test.ts:82` uses `chapters` reads as a stand-in for views, which ties it to `view.ts` internals. If that ever drifts, the test fails loudly instead of passing silently, so I accept it. Steps 7 and 8 (composition, Book UI) do not apply.

## Findings

1. **Nit**: the PR body ("stale if a cartridge was edited in place… identity is now checked") and `shared.ts:48`. The identity check catches a replaced cartridge, not an in-place edit. Scenario: query a state, then add `c.statuses[x]` to the same cartridge object, then query that state again. The new status is missing until the next state. Every in-repo in-place edit (`theft.test.ts:187`, `status_room.test.ts:150`, `showcase_fixture.ts`) happens before compile or `newWorld`. This is an author-side edge, so the fix is to correct the wording.
2. **Nit**: `flows.ts:182`. A `Policy` that mutated its `view` would now change the `view` that `checked`'s invariants read. The freeze control shows that no in-repo policy or observer does this. It is acceptable as is.

Open item, not a finding: 58 s against the 90 s limit leaves about 35% headroom on an idle M-series. Under the documented M1 load (30-70), the report may still time out.
