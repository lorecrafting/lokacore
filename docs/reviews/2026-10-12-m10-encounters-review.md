# Review: toolbox row 9, random encounters (loka-kgd.117)

- Written 2026-10-12 08:40 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Branch `toolbox/m10-encounters`, head `4ccc77e3de02016221c105387ec8ad0fb9235bd9` (spec `6c715ed4`, code `4ccc77e3`), diffed against `63e5c276` (`toolbox/batch-m10`). No PR (batch model). Installed `kernel_api` 1.71 to 1.74.
- Governing: [Random encounters](../system/mechanics.md#random-encounters-toolbox-row-9) (added here), [Encounter declarations](../system/cartridge.md#encounter-declarations), [C3 population contract](../system/mechanics.md#c3-bounded-living-hounds-selected-contract), toolbox row 9, Beads `loka-kgd.117` (brief; PM accepted every default: roll only at a wander boundary, no genesis birth, one birth per chance, resume never spawns, W12 forward rule).
- Hosted `ci` and `book-e2e` in progress on the head at hand-back (`gh run list --commit`); the PM watches CI.
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; two nits).

## Must be true

1. A plan without `chance` behaves, hashes and births exactly as before (ecology `births` filter unchanged).
2. An encounter plan births nothing at genesis; slots start at generation 0.
3. Exactly one `uniform(rng, 100, 8)` per opportunity (wander boundary, not suppressed, an eligible slot); none otherwise; a roll below `chance` births only the first eligible slot.
4. The drawn RNG state is returned on the decision, whether or not it births, and later crossed sub-steps of the same advance draw from it.
5. Replacement-due, off-hour night and suppression-resume occurrences never draw or birth.
6. `chance` below `kernel_api` 1.74 is refused in both kernels at the manifest `at_least`; the schema bounds it to an integer 1..100.
7. No Elixir runtime decides population jobs, so no differential is owed (ADR-074).
8. The cartridge owns the rate and chance; the engine holds only the percent scale and the draw budget.

## Checks

- (1) `eligible` (`kernel/ts/src/mechanics/population/settle.ts:38-41`) is the De Morgan negation of the old skip test; ecology path calls `births` unchanged. Hounds, population composition, d9 suppression and replenish tests green. No Ashmere file touched; the Ashmere ledger row is unchanged (`ledger.test.ts` green).
- (2)-(5) `encounter` (`settle.ts:48-67`) checks boundary and eligibility before drawing, returns `world.state.rng` untouched when there is no opportunity, and the post-draw state otherwise; `runPopulation` passes it to `accepted` (`shared.ts:213`), and `proposal.ts` sets `p.rng = ran.rng` per crossed job and rebases `now()` on it. `resumePopulation` uses target 0 for an encounter plan (`shared.ts:233`). Genesis count 0 (`shared.ts:101`).
- RNG expected values: re-derived with my own Python xoshiro128** 1.1 + rejection `uniform(100)` from the reference algorithm: `[1,2,3,4]` rolls 20 → `[7,0,1026,12288]`; `[1,1,1,1]` rolls 60, 60, 20 → `[2560,513,262145,5242880]`; `[1,7000003,1,1]` rolls 25, 25 → `[1451102211,3584001536,7000003,2801664688]`. All match `kernel/ts/test/encounter.test.ts`; none computed by the kernel under test.
- (6) TS floor `cartridge_population.ts:20-24`, Elixir floor `lib/loka/content/population.ex:60-71` (same parser shape as `derived.ex:138`); `invalid.json` rows for 0, 101 and `"25"`; `validate.test.ts` and `contracts_test.exs` green.
- (7) `lib/` has no population decider: only op legality (`lib/loka/core/invariants_population.ex`, `creation.ex`), and an encounter birth uses the existing generation 0 → 1 slot transition ecology already uses above the genesis target. `bin/contracts.exs` declares no population differential. TS-only claim holds.
- (8) `chance`, `wander_interval`, `replacement_delay` live in `cartridges/encounter_sampler/populations/bandits.json`; engine literals are 100 (percent scale, as loot drops) and 8 (draw budget, a safety budget).
- W12 rule: spec-only forward rule (mechanics.md Random encounters, "W12 forward rule (M12)"); `population_count` does not exist yet in `kernel/ts/src`, `lib` or `protocol`. Explicitly out of scope for code.
- Import cycles: `madge@8 --circular` on `kernel/ts/src`: 88 at base and head, no new cycle.

## Mutants (each `timeout 90`, restored after)

| Mutant | Result |
| --- | --- |
| `roll <= plan.chance` (settle.ts) | killed: "two hours rolling 25, 25" |
| boundary gate removed from `encounter` | killed: "a slot not yet due…" |
| `accepted(..., born.rng)` dropped (shared.ts) | killed: 4 tests (b, c, e, …) |
| resume target `targetAt` for encounter plans | killed: "a suppression resume…" |
| Elixir floor `[1, 73]` (`mix test --force`) | killed: `content_encounter_test.exs:7` |
| `slots.find` → `slots.findLast` | **survives** (nit 1) |

Focused runs: `node --test` encounter, ledger, hounds, population_composition, d9_suppression, replenish, validate: 45/45 pass; `mix test` content_encounter + contracts: 10/10 pass.

## Findings

1. **nit** `kernel/ts/test/encounter.test.ts:124-133`: the cap-2 test asserts only the bandit count, so birthing the last eligible slot instead of the first (spec: "the first eligible slot only") passes. Scenario: `slots.findLast` births slot 2 at night; at day slot 2 is above `day_target` while slot 1 is empty. Fix: also assert slot 1 generation 1, slot 2 generation 0.
2. **nit** `kernel/ts/src/mechanics/population/settle.ts:64`: `if (!rng) throw` is unreachable; `State.rng` is a required `RngState` (`runtime/decision.ts:81`) and `uniform` already rejects a malformed state. Fix: delete the guard and the `KernelError` import.

## Departures

None claimed beyond the brief; the PM defaults are implemented as stated.
