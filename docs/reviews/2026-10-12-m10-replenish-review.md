# Review: toolbox row 19b, replenish primitive (loka-kgd.85, batch M10 wave 1)

- Written 2026-10-12 07:16 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12ef2).
- Local branch `toolbox/m10-replenish`, head `e50a20dcc1287afb00c446ae7abca1a26705e3c2`, base `ab4413033ecc3ed7f302947b1135a8471912c2b7` (3 commits, 39 files). Brief: Beads `loka-kgd.85` notes; PM rulings in the `loka-kgd` comment of 2026-10-12 06:32 (kernel_api 1.71; identity set as `harvest.items`, any authored holder, no `when` gate accepted).
- Governing: [Replenish](../system/mechanics.md#replenish-toolbox-row-19b), [Replenish declarations](../system/cartridge.md#replenish-declarations), [tool-gated harvest Regrowth](../system/mechanics.md#tool-gated-harvest-toolbox-row-19), [contract lessons](../lessons/contracts.md).
- Hosted CI on the head (`gh run list --commit`): `ci` 38215673032 and `book-e2e` 38215673013, both success.
- Developer self-review: Beads `loka-kgd.85` comment 2026-10-12 06:57 (one pass; Pi has no `/code-review`).
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix).

## Must be true

1. No item is minted: a run only emits `entity.transfer` of authored items, plus `job.complete`/`job.schedule`.
2. Only listed items directly in `from` move; `to` never ends above `cap` listed items; at most `count` per run.
3. A run can never wedge time: a full target, empty reserve or unmovable item moves nothing and still reschedules (spec "Run").
4. Fixed grid at due + `every`; a crossed due time runs as its own drain step; one long wait equals stepwise waits.
5. A cartridge without `replenish` mints the same ids and pins; jobs seed after `firstClock`.
6. Both kernels refuse the same content (floor 1.71, template, from = to, unresolved), with schema fixtures for every bound.

## Findings

1. **Blocker**: `kernel/ts/src/mechanics/containment/job.ts:51-52`. The move count ignores the destination's free capacity, and compose refuses an over-capacity or cyclic transfer (`foundation/compose.ts` `capacity_exceeded`, `containment_cycle`). The fault fails the whole `run_job`, so every later Wait or elapsed advance across that due time faults the same way, for good. Probed on the sampler artifact, with waits to 3600 and 7200 both faulting: (a) crate `capacity: 1` holding `apple_01` with an entry `{items [stone], from store, to crate, cap 1}` gives `capacity_exceeded`. Players reach this state by Put into a refilled chest, or by Sell to a restocked shop NPC with `capacity`: non-listed items fill the capacity, so `cap` cannot bound it. (b) `to` a non-container item (capacity 0) gives `capacity_exceeded`. (c) `to` an item that is itself listed gives `containment_cycle`. This breaks requirement 3. It also makes the developer's residual risk and the spec sentence at `docs/system/mechanics.md:2516` ("cap bounds the target, so content keeps cap within it") wrong: the target does not receive the move, the clock wedges. Fix: clamp the moves by `world.capacities[to]` minus everything directly in `to`, budgeted, as `commerce/shared.ts:58-64` does. Have both kernels refuse a non-container `to` item and a `to` listed in `items`. Add a test with a full container target that still advances time. Then amend the Known-limits sentence.
2. **Should-fix**: `kernel/ts/src/content/cartridge_replenish.ts:24` and `lib/loka/content/replenish.ex:59`. A holder that names a `spawn_template` NPC (or a template item) resolves, but it has no entity (`runtime/fresh.ts` `place` filters them out). The probe with shelf `to` set to a spawn-template NPC loads, then every wait faults `evaluator_error`. Fix: report UNRESOLVED_REFERENCE (or SCHEMA_VIOLATION) for a holder with no placed entity, in both kernels, with one twin test row.
3. **Should-fix**: `protocol/cartridge.schema.json:2014` `ReplenishPlan` has no case in `protocol/fixtures/invalid.json`. Brief acceptance E asks for cap 0, an unknown field, and the schema mutant sweep. Dropping any of the 7 `required` entries, `minItems`/`maxItems`, the `cap`/`count` bounds, `every`'s minimum or `additionalProperties: false` fails no test. Fix: add hand-written invalid cases until the sweep leaves no survivor.

## Departures

- `containment/job.ts` plus the lint allowlist entry (`lint/rules/ts-rule-module-imports.yml`): **accepted**. It follows the `bleed|status|quest/job.ts` precedent for job runners that `schedule/rule.ts` imports, widens the allowlist by exactly one path and adds a valid lint case.
- `compiler.ex` size allowance 338 to 340: **accepted**. The two lines are the required `Replenish.check` call and the section row.
- Harvest stock allowance (`exchanges.ex`, `cartridge_exchange.ts`; not in the brief): **accepted**. Without it the sampler's store ore fails B5's start-in-room check. Both kernels have it and both twin tests cover it.
- Developer residual risk ("an item container at capacity still receives moves"): **rejected as stated**. It is finding 1: the move faults and wedges time.
- Toolbox row 19b and the row 19 cite fix are absent. The batch plan puts table edits in the batch PR, so this is not a finding.

## Proof

- Focused runs: `node --test replenish harvest_tool` 9/9, `schedule*` 22/22, `mix test test/loka/content_replenish_test.exs` 1/1.
- Mutants, all red: cap ignored (`room = r.count`) fails 2; no drain step (`crossed = false`) fails 1; count ignored fails 1; TS template check dropped fails 1. Elixir with `--force`: from = to check dropped, template clause dropped, `refilled` always empty, floor 1.70: each fails.
- Probes: scratch test on edited sampler artifacts (capacity, non-container, cycle, spawn-template `to`), as above; deleted afterwards.

## Recheck: fix commit `1185e67e`

- Written 2026-10-12 07:57 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12f1a).
- Head `1185e67e45a2939d0171d47082a75b5251b29a4e` (one fix commit on `e50a20dc`). Hosted CI on the head (`gh run list --commit`): `ci` 38220264425 and `book-e2e` 38220264446 in progress at writing.
- Verdict: **CHANGES REQUIRED** (one should-fix, R1).

### Dispositions

- **F1 resolved, with R1 left.** `free()` (`kernel/ts/src/mechanics/containment/job.ts:43-51`) counts everything directly in `to` against `world.capacities[to]`, one query step per row, as `commerce/shared.ts:58-64`; `room = min(cap - held, free)` (`:72`). Mutants, each red on `replenish.test.ts`: capacity ignored, no decrement, min dropped.
- **F2 resolved.** `placed` (`kernel/ts/src/content/cartridge_replenish.ts:34-39`) and `placed?` (`lib/loka/content/replenish.ex:76-79`) refuse a spawn-template NPC, a template item, a non-container item holder and a listed item holder. Each condition dropped, red: TS 4/4, Elixir 4/4 (`mix test --force`), plus the Elixir template-location guard.
- **F3 resolved.** 9 `ReplenishPlan` cases in `protocol/fixtures/invalid.json`. In-memory sweep over `DEFS.ReplenishPlan` against `validate`: 14/14 red (7 `required`, `minItems`, `maxItems`, `cap`/`count` min and max, `every` min). `additionalProperties` survives because `foundation/validate.ts:94` treats declared properties as closed; accepted. The 65-item case is the only one that catches the `maxItems` mutant and follows precedent (65-element cases for `StatusDefinition`, `AudiencePolicy`, `ActionContribution`): keep it.
- **Schema diff vs `e50a20dc`:** one line, the `ReplenishPlan` description only. `contracts.gen.ts`, `contracts.gen.md` and `system-graph.gen.json` follow it.

### Finding

- **R1, should-fix:** `kernel/ts/src/content/cartridge_replenish.ts:39`, `lib/loka/content/replenish.ex:79`. The listed check catches only `to` itself, not a listed container that holds `to`. Probe on the sampler: `apple_01` set to `container: true, capacity: 2` (it sits in `crate`) and `shelf` set to `{items [crate], from store, to apple_01}`. It loads, then the wait to 3600 faults `containment_cycle`, so every later wait faults too (must-be-true 3). Players reach the same state with a Put of the target into a listed container. Fix: when `to` is an item, refuse any listed item that is a container, in both kernels (this covers the current listed-`to` check), with one twin row. Alternatively, skip the ancestors of `to` in the run.

### Departures

- Container/listed rule on `from` as well as `to`: **accepted**. It is stricter, it only refuses harmless content, the code needs no end parameter, and docs and the schema description say so.
- `runReplenish` split (`free()` extracted for the 40-line limit): **accepted**.
- `containment/job.ts` plus the lint allowlist, and `compiler.ex` 338 to 340: still **accepted**. The fix changes neither.

## Recheck 2: fix commit `59dfea52`

- Written 2026-10-12 08:03 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12f1a).
- Head `59dfea52b81845c7220da900af0e8c370e2d8a49` (one commit on `1185e67e`); delta reviewed only. Hosted CI: the PM watches it.
- Verdict: **APPROVE**.

### Dispositions

- **R1 resolved.** When `to` is an item, both kernels refuse the entry if any listed item is a container: `nests` (`kernel/ts/src/content/cartridge_replenish.ts:21,41`) and `nests?/3` (`lib/loka/content/replenish.ex:64,83-85`). This replaces the listed-`to` check. The rule is complete: a non-container item holds nothing (`runtime/decision.ts:160`, capacity 0), and a room or NPC cannot sit inside an item, so only a listed container can nest an item target. The round 1 repro (`apple_01` made a container inside `crate`, `shelf {items [crate], from store, to apple_01}`) is now refused at load with SCHEMA_VIOLATION at `shelf.to`.
- Mutants, each red: TS `nests` always false, `nests` applied to `from` too, `nests` ignored in `placed`. Elixir with `--force`: `nests?` always false, applied to `from` too, ignored in `placed?`. Focused runs pass: `replenish.test.ts`, `validate.test.ts`, `content_replenish_test.exs`; `tsc --noEmit` is clean.
- **Docs and schema.** `docs/system/cartridge.md` Replenish declarations, `mechanics.md` Opt-in and the `ReplenishPlan` description all state the new rule and drop the listed-holder wording. The schema diff is the description line only, and the generated files follow it.

### Departure

- The round 1 refusal of a listed `from` item is dropped: **accepted**. A run moves only listed items directly in `from`, and `from` is never directly in itself, so a listed reserve never moves. With a room or NPC target no cycle can form. The "loads" row in each kernel pins it, and the `from`-side mutant fails it.
