# D7 deer final primary source review — APPROVE

**PR:** #253. **Exact source/evidence head reviewed:** `776742a611bd5194ac2cdd26968ac76dfcb0333a`. I authored none of the D7 source or plan. The hosted CI and Book E2E runs both completed successfully at this exact head (runs `37520645339` and `37520645227`). This record is a primary review; the separate save/protocol opinion remains its own gate.

## Requirements derived before the diff

The [D7 brief](../briefs/chapter-one/d7-deer-brief-2026-10-05.md), [PM decision](../decisions/pm-decision-d7-deer-2026-10-06.md), archived three-deer row and active [mechanics](../system/mechanics.md#d7-bounded-deer-and-delayed-sight-flight-planning-contract), [cartridge](../system/cartridge.md#d7-deer-planning-declarations), [composition](../system/protocol.md#d7-sight-flight-composition-planning-contract), [save](../system/save.md#d7-deer-recovery-planning-contract) and [Book](../system/book-ui.md#d7-deer-sight-and-hide-details-planning-contract) require three independent cap-one pairs at the named birth homes, reciprocal legal two-room wander, +300 generation-bound sight flight, +150 attack opportunity, death-only one-hide/corpse transfer, +172800 replacement, and ordinary target/Take projection. At equal due time, either ordered round/sight outcome must be safe: a surviving round may hand only its matching encounter closure and successor cancellation to the later sight group; unrelated cross-group writes still fault. Saved pending, fled, dead and replay states must retain typed refusal and exact release-pin behavior.

## Review and verdict

**APPROVE. No open primary findings.** I inspected the final diff against `eaf6f280`, including three plan declarations and typed roles, paired creation/death custody, player entry and checked population arrival sight bindings, current generation and legal refuge checks, equal-time round handoff and portable composition/invariant checks, actual GameView/Book interaction, and the final independently derived v036/API1.31 pin. The previously found loader/saved-validator mismatch is fixed in both admission paths. I inspected the real-SQLite and browser proof in the retained evidence and confirmed both hosted runs were `success` at the exact reviewed SHA. The separate save/protocol reviewer owns the independent deeper persistence/contract opinion.

I tested the test in this detached review checkout: removing `slot.generation !== sight.generation` from `activeSight` made `generation mismatch makes a sight occurrence harmless` fail. The mutant incorrectly emitted `entity.transfer` and `population.slot` after `job.complete`; the controlled expected answer was only `job.complete`. After restoring source, that focused test passed. The developer's retained controls also cover duplicate hide transfer and stale round cancellation. Source status was restored before the record commit.

The composition stays within existing population, movement, combat, death, custody and authority primitives. Ponytail Review: Lean already. Ship. No additional dependency, generic behavior framework or redundant test was found in the reviewed path. This approval does not replace final exact-head save/protocol review or PM merge checks.

## Required Codex Astra foundation review at `776742a6`

```text
VERDICT: CHANGES REQUIRED

1. D7-01 | P1 | kernel/ts/src/foundation/compose_sight.ts:135
   sightCompletion selects the first later sight completion without matching the encounter’s deer. Reproduced with both deer in Drowned Oak, two missed attacks against Willow deer, and equal-time order round → Oak sight → Willow sight: the valid Willow handoff faults precondition_failed because validation selects Oak’s job. Elapsed settlement rolls back and repeats the fault. Match the exact member/binding; the same selection defect exists in invariants_sight.ts:125 and deer-save.ts:114.

2. D7-02 | P1 | kernel/ts/src/mechanics/population/behavior.ts:145
   Harmless sight completion clears the slot even when a later same-time population arrival must bind it again in another writer group. Reproduced: let Willow deer flee into Drowned Oak at 65100; enter Drowned Oak at 68100, then immediately return north. At 68400, Oak sight clears its binding before Oak population wanders into the player’s room and schedules fresh sight. Final composition faults conflicting_write on Oak’s population_slot, rolling back elapsed settlement. Coordinate these lawful equal-time operations while preserving unrelated conflict refusal.
```

The developer's [round 1 fixes and retained red controls](../evidence/2026-10-06-d7-deer-round1/README.md) address these findings. The approval above applies to its stated head; fresh exact-head rechecks remain required for the fix head.
