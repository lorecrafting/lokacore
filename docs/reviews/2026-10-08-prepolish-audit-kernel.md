# Pre-polish audit A: kernel (loka-v9q)

Base: `main` at `e38af110` (read-only detached worktree, removed). Reviewer: fresh agent, authored none of it.
Scope: `kernel/ts/src/mechanics`, `kernel/ts/src/content`, `kernel/ts/src/commands` and direct runtime callers.
Governing: [mechanics](../system/mechanics.md), [architecture: composition](../system/architecture.md#building-mechanics-by-composition),
[cartridge](../system/cartridge.md#compiler), [owner rules](../system/owner-rules.md#architecture-and-engine),
[AGENTS.md: mechanics vs numbers](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently).

**Verdict: HEALTHY WITH FINDINGS** (no blocker; two should-fix, four nits, two questions).

## Must be true (written before reading code)

1. Rules are pure, read the actor from the command, and refuse with the registered code per verb clause.
2. Capability code names no chapter, NPC, item or another mechanic's player verb; cartridge data owns every world number (owner rule).
3. Projection and execution share one admission predicate per verb (B4 lesson); raw ids cannot bypass darkness, custody or combat gates.
4. Invariants hold: one container per item, acyclic custody, bounded traversal charged to `query_steps` before allocation, faults vs rejections per spec.
5. Spec boundaries are exact: carry equality fits, bleed tick strictly before `ends_at`, schedules strictly later, night/day targets, D9 ingress needs a direct item root, flight strictly below threshold.
6. Loader twins agree with the compiler (`cartridge_*.ts` vs `lib/loka/content/*.ex`).

## Findings

| id | severity | where | failure scenario | fix | before polish? |
|---|---|---|---|---|---|
| A1 | should-fix | `kernel/ts/src/mechanics/population/shared.ts:103,242`; twins `kernel/ts/src/content/cartridge_population.ts:85-94`, `lib/loka/content/population.ex:70` | `hour >= night_start \|\| hour < night_end` assumes a midnight-wrapping window and neither compiler nor loader requires `night_start > night_end`. A plan authored `night_start: 1, night_end: 5` compiles and loads, yet `targetAt` returns `night_target` at every hour, so extra members spawn all day. `time_window` (policy.ts:50) handles both shapes. | one-liner: validate wrap in both twins, or reuse the time_window comparison | can wait for RC (chapter authors 20→6) |
| A2 | should-fix | `kernel/ts/src/mechanics/movement/shared.ts:47` | D9 Study ingress "at least one direct item root" has no test that fails when broken: mutant `if (holder === id) return undefined;` (an empty owned corpse grants ingress) survived `study_ingress`, `priory`, `d9_suppression`, `e1_routes`, `e1_world_witness`, `missing_child`. | small: one controlled test (fox allegiance, owned corpse in Study with its last root taken → `exit_closed`) | can wait for RC |
| A3 | nit | `kernel/ts/src/mechanics/expedition/shared.ts:76-77` | shelter cursor `3` is an engine literal duplicating the compiler/loader pin `route[2].to === shelter_room` (`cartridge_expedition.ts:71`, `expedition.ex:115`); a re-authored route silently disagrees with the engine until the pin catches it. | one-liner: derive the index from `spec.route`/`shelter_room` | can wait |
| A4 | nit | `population/shared.ts:99-101,240-242` vs `mechanics/calendar.ts:13`; `crow/shared.ts:108-110` vs `lookups.ts:26` | duplicated `hourOf` and `barrierState` logic; a calendar change fixed in one place misses the other. | delete, call the existing helper | can wait |
| A5 | nit | `kernel/ts/src/mechanics/containment/recovery.ts:37,39,53` | `budget_exceeded`/`precondition_failed` are returned as rejections (a receipt is written) where every other rule faults (e.g. `containment/rule.ts:55`). | one-liner | can wait |
| A6 | nit | `kernel/ts/src/mechanics/service/shared.ts:40-46` | `unaffordable` is checked before `already_paid`: an already-entitled player at 0 pennies tapping Rent reads "unaffordable"; nothing is charged either way. | swap the two checks | can wait |

Questions (no concrete chapter failure):
- Q1 `kernel/ts/src/commands/actions.ts:248-260` `hiddenTarget` omits `endpoint_id`, `corpse_id`, `detail_id`, `supply_id`; a transport/expedition detail placed in a dark room would be targetable by raw id. Current dark rooms hold no such detail.
- Q2 `kernel/ts/src/mechanics/movement/sequence.ts:113-117` water edges return before the `engaged`/`standing` checks: Surface while engaged is admitted by design (no NPC can be underwater) and Flee into water is refused by `water.admission`; confirm intended.

## Checked and found consistent with the spec

Shared admission (`refusal`/`accepts`/`visible`) used by rules, action lists and transport/service/food/bleed availability; carry equality and Put order; `reach(heldOnly)` for held books; bleed tick/expiry boundaries and refresh; combat initiative, defense order, sleep multiplier, flight `cur*100 < max*pct`; death custody, restore and position; transport fare waiver by actual owned nonempty corpse; commerce exact quote and ledger protection; liquid fill/pour/drink exactness; D11 pre-choice gate; escort travel/separation; patrol credit; expedition footprint failure; schedule strictly-later; deadline job; quest acceptance/resolution; fact ownership of reserved facts. No chapter, NPC or item name in capability code (`role: hound|deer|pelt|hide` is the protocol enum). Compiler/loader population checks agree (same gap, A1).

## Mutants (narrow, `bin/mutate.sh`, full command `true`)

8 narrow + 3 broader re-runs: red — population night `||`→`&&`, calendar `nextHour` `>`→`>=`, `reach` heldOnly dropped, bleed `expired` `>=`→`>`, carry `>`→`>=`, expedition shelter-once dropped (`e1_night_marsh`), service full-MV `>=`→`>` (`r9c_elapsed_jobs`); survived — A2. Baseline note: `deer`, `d9_suppression`, `study_ingress` shell out to `mix loka.compile` and need Elixir deps in the worktree.

Not checked: `content/cartridge_*.ts` beyond population/expedition/dialogue code lists (covered by the loader fixture corpus and cross-kernel test), `*/saved.ts` reopen validators (area B/C), view/runtime internals.
