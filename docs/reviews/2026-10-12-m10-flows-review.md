# Review: M10 balance tool 2, measured flows (loka-kgd.107.2)

- Written 2026-10-12 08:24 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12f2b).
- Branch `toolbox/m10-flows`, head `a3d6107e`, diffed against `ab441303` (`toolbox/batch-m10`). No PR (batch model). Commits `92dd1476` (spec), `c4ee80f1` (spec amendment: plain kernel `step`), `a3d6107e` (code).
- Governing: [Measured flows (balance tool 2)](../system/cartridge.md#measured-flows-balance-tool-2) (added here), Beads `loka-kgd.107.2` brief (A-E, red controls), study `docs/rnd/balance-diagnostics-2026-10-11.md` §5, §12, §13.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker: the coin rate that `.107.3` gates on is not pinned by any test; two should-fix).

## Must be true

1. Extracting `offers` from `offered` keeps every draw: `sim.test.ts` green, `sim_seeds.json` unchanged.
2. The worker tries the ranked types in order, then the least-visited move, then a wait to the next hour; ties go by the seed's generator; the same inputs give byte-identical output.
3. Coin is the player body's currency rows only; a gain is `in`, a loss `out`, labelled `<type>:<key>`; items are the item entities directly in the body.
4. The run ends at start + D days, when nothing is accepted, or at 5000 steps. A command is not repeated within one game hour, and the skip resets each hour.
5. `coin.per_hour`, `coin.supply` and `populations` are what the spec says, since `.107.3` and `.107.8` read them.
6. The CLI exits 1 with the diagnostic on a refused artifact.

## Proof

- At head: `flows.test.ts` 5/5 (8 s with compile), `sim.test.ts` 23/23 (500 seeds); `sim_seeds.json` is not in the diff. `offers` returns the whole ancestry list and `offered` picks once from it (same single `int(n)` draw).
- Red controls re-run by the reviewer: in/out swapped (A red), rank replaced by an unordered filter (B red), repeat skip removed (skip test red; the CLI test then runs for 249 s, which is the runaway the developer fixed). I did not re-run the `offers` draw control (D).
- Surviving mutants (each 5/5 green): `net / elapsed` changed to `net / (elapsed + 1)` (`flows.ts:155`); supply `player` read from `purses` (`flows.ts:107`); the hourly reset removed (`flows.ts:145`).
- At head the CLI on the showcase (3 seeds, 1 day) takes 1.3 s.
- Invariants on accepted steps only (scratch, not committed): calling `checked` on the accepted candidate inside `first` raised no failure and gave byte-identical output on the showcase, `ashmere_missing_child`, `harvest_sampler` and `standing_sampler`. Showcase 3 seeds × 1 day went from 1.67 s to 2.97 s (1.8×).

## Findings

1. **Blocker.** `kernel/ts/test/flows.test.ts:47`: no test pins `coin.per_hour` or the `coin.supply` values. Only `by_source`, the last hour of supply and hour 0 of populations are asserted. A wrong rate (`flows.ts:155` divided by `elapsed + 1`) or supply reading the purses (`flows.ts:107`) passes 5/5. `.107.3` builds its coin/hour gate on this number. Fix: in A's scripted policy add a one-hour wait after the sale, then assert hand-read values. Standing sampler: player starts with 10 and Peg's purse with 0, so, if buy and sell pass no time, expect `per_hour` "-3.00" and supply rows `{0,10,0}`, `{1,7,3}`.
2. **Should-fix.** `kernel/ts/play/flows.ts:145`: nothing catches a skip that never resets. Remove the reset and the suite stays green. Then a repeatable faucet (the same harvest `target_id` every hour) runs once per run instead of once per hour, and income is under-measured without any signal. Fix: in the skip test, count the idle policy's calls. With the reset, scan is played every hour, about 2 calls per hour; without it, about 1.
3. **Should-fix.** `kernel/ts/play/flows.ts:161-170` and `docs/system/cartridge.md:476` (amendment `c4ee80f1`) drop invariant checks entirely. The original spec said every step keeps every registered invariant, and the brief reused `checked`. The simulator covers the showcase only up to 64 commands, while the worker plays a whole day. Failure scenario: an item duplicated by a late job shows up as extra `take` inflow, with no signal, and a gate is built on it. The amendment's cost argument holds only per candidate. Fix: call `checked` (`{step: stepFn, gameView}`) on the accepted candidate and throw on failure (4 lines, measured 1.8×). Amend the spec line to "every accepted step keeps every registered invariant".

## Departures

- (1) Extra candidates (shop sells, choices, harvest notices): accepted. They are available GameView offers that `offers` does not list, and the spec now names them.
- (2) Elapsed delivery for real-elapsed worlds: accepted. Wait is refused there, and the showcase test reaches hour 24 through it.
- (3) B checks candidate order over 8 seeds: accepted. `first` plays the first accepted candidate, so the order is the property, and the rank mutant turns it red.
- (a) Plain `step`: the speed-up is real, but the guarantee should come back on accepted steps (finding 3).
- (b) No coin on the showcase is a world fact, not a tool bug. `play/ledger.ts` lists only two faucets, `shop_sell` of `bread` (Nell) and `hall_bread` (Bess). Both breads start held by those NPCs (`items/bread.json`, `items/hall_bread.json`), both purses start at 0, and the supply is the player's 10. A worker that never buys cannot earn, so `.107.3` cannot gate showcase coin/hour above 0 without a faucet in content.

Residual risks: the worker never buys, so buy-and-resell loops are not measured. On `standing_sampler` every seed ends at hour 2, because a dialogue choice starts combat; `per_hour` then covers that short span (the spec documents early ends).

## Recheck: fix `69a955ff` (merge `befec775`)

- Written 2026-10-12 08:33 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12f2b).
- Scope: `a3d6107e..69a955ff`, the code it touches, and `first`/`delivered` callers. Merge `befec775` changes no flows file: `flows.ts`, `flows.test.ts` and `sim.ts` are unchanged, and its `cartridge.md` hunks are other slices' sections (ledger notes, group, replenish).
- Verdict: **APPROVE WITH NOTES**.
- F1 resolved. The literals are hand-checked: `standing_sampler/resources.json` pennies start 10, `npcs/peg.json` pennies 0, bread buy 4 / sell 1, so `{0,10,0}` then `{1,7,3}` and -3.00 over one hour. Mutants `net/(elapsed+1)` and supply player←purses each fail A (60 s alarm).
- F2 resolved. 48 = 24 × (scan + wait). Mutant with the hourly reset removed fails the skip test.
- F3 resolved, untested (note). Only the accepted candidate replays through `checked`, which throws on failure, and the spec line was amended. A test would need a test-only kernel hook, which AGENTS.md forbids, or a broken engine. Accepted: the wiring is 2 lines and the alternative costs more than it buys. Removing the `if (r.failure)` throw would pass the suite.
- Cost: `flows.test.ts` 11.9 s wall (8.2 s at `a3d6107e`, compile included); showcase 3 seeds × 1 day 2.9 s. Acceptable for a dev-time report not run in CI beyond this test.
- CI on `befec775` was in progress at writing.
