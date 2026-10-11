# Review: toolbox row 29b, spell effects (loka-kgd.99)

- Branch `toolbox/m8-spell-effects`, head `4f718391124b365412122438953259ea48fc6e73`, diffed against `toolbox/batch-m8` `697ae0a2` (43 files). No PR (batch model). Contract slice: three `RecipeStep` ops, action_recipe@1 composing status@1 and death@1, kernel_api 1.55.
- Governing: [toolbox row 29b](../MECHANICS-TOOLBOX.md#ranked-toolbox), [spell effects](../system/mechanics.md#spell-effects-toolbox-row-29b), [status readers](../system/mechanics.md#status-readers-toolbox-rows-sr1-sr2-and-sr3), [spell declarations](../system/cartridge.md#spell-declarations), [composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.99`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (two blockers, two should-fix, one nit).

## Must be true (written before the diff)

1. Effect steps load only on spells, only at kernel_api >= 1.55, only with their owner declared; both loaders give the same code and path.
2. The `statusStep` move does not change reactions: holders, once-per-holder, writer-group join, `status_applied` order, applied line.
3. A spell's `status.apply`: a dead or immune holder takes nothing; a first application emits `status_applied`; a refresh is silent; once per holder in a spell.
4. `damage`: G2 resistances, no crit, stops at 0; at 0 the death sequence runs (caster is killer), and the encounter closes when the NPC is the only opponent. An NPC without hp, or one killed earlier in the same spell, takes nothing.
5. `light.ignite` is the ignite verb's transition; when it cannot ignite, it writes nothing and the spell still succeeds.
6. `cast` is admitted in a fight and does not break the round job's writer groups.
7. Cartridges without effect steps keep their behaviour.

## Proof

- Focused baseline green: `spell_effects`, `spells`, `damage`, `light`, `elements`, `writer_groups`, `targets`, `reaction` tests; `npm run typecheck`; `content_spells_test.exs`, `content_spell_effects_test.exs`.
- Red mutants: statusStep without the once check (`status.test.ts`, 2 vs 1), `first` always true (refresh heard), no `closeEncounter` on a sole kill, spell damage without `resisted`, `dealt` without tags (`damage.test.ts`), `cast` removed from the fight list, the TS SCHEMA_VIOLATION and 1.55 floor, the Elixir `placed` and 1.55 floor, and the Elixir `damage` leaf ref.
- Green mutants: `slain` removed, `!target.hp` removed, `!again` removed (B1, B2, S2). The resistance clamp 100 to 99 also stays green, but `dealt` already had that gap, so it is not this slice's finding.
- Item 2 holds: `holdersOf` + the shared `statusStep` has the same body as the old one (diff read hunk by hunk), and the status mutants above fail the reaction suites.
- Claims rerun: CI green at the head holds. "`resisted` is extracted from `dealt`" holds: same formula, `combat/shared.ts` `resisted`.

## Findings

- **B1 (blocker)** `kernel/ts/src/mechanics/action_recipe/spell.ts:60`: nothing tests the `slain` guard (spec: "one an earlier step of the spell killed, takes nothing"). Remove the guard, then cast a spell with `damage` 16, `damage` and `status.apply {npc: wight}`: the result is `entity_died, status_applied, …`, so the status lands on the NPC that was just killed. `spell_effects.test.ts` stays green.
- **B2 (blocker)** `spell.ts:96`: the no-hp guard has no test (the brief asks about it). The loader accepts `damage` on an NPC without `hp`. Without the guard, `cast flamma` gives fault `evaluator_error`. Fix: one test that the cast is accepted and writes nothing. One small test can cover both B1 and B2.
- **S1 (should-fix)** `kernel/ts/src/commands/actions.ts:187`, `docs/system/mechanics.md:2348`: a cast spell with a `duration` faults in a fight. Setup: no `time_policy`, no regen (as in `standing_sampler`), engaged, round interval 150. `flamma` with duration 150, where the round's blow hits the wight, gives `conflicting_write` on the wight's hp. Any spell with duration 300 (also `lux`) gives `nonfuture_job`. No recipe was admitted in a fight before this slice. Fix: refuse `duration` on a spell, or keep `cast` in a fight only for spells without a duration, or state the limit.
- **S2 (should-fix)** `spell.ts:56-57`: nothing tests the `again` guard. If it is removed, `lux` with two `light.ignite {orb}` steps gives fault `precondition_failed` on fuel.
- **N1 (nit)**: no `/code-review` result is reported (no PR body; commit `b894e9da` says "self-review" but gives no result).

## Open item (exists before this slice, not a finding)

- A `status.apply` followed by a recipe `duration` that is at least the status's `tick_every` gives fault `precondition_failed` on the status row. A reaction on `action_completed` does the same (reviewer control), so the spell path only inherits it. The PM decides whether to file it.
