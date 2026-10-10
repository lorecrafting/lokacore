# Review: loot tables and random drops, toolbox row 8 (loka-kgd.20)

- Local branch `toolbox/m3-loot`, head `e081208f` against `origin/toolbox/batch-m3` (no PR yet). Protocol (`entity.schema.json` `NpcDefinition.drops`) and `kernel_api` 1.43 change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md) item 5; levelling precedent).
- Governing: [death@1](../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation), [row 8](../system/mechanics.md#loot-tables-and-random-drops-toolbox-row-8), [drop declarations](../system/cartridge.md#drop-declarations), [toolbox slice process and traps](../MECHANICS-TOOLBOX.md#toolbox-slice-process), PM brief in `loka-kgd.20`.
- Verdict: **CHANGES REQUIRED**.

## Must be true

1. A cartridge without `drops` keeps bytes, hash, RNG state and behavior (opt-in).
2. One uniform(100) per entry, in table order, on the combat round's RNG; the after-state is committed; replay is deterministic.
3. A failed entry's item never reaches a player by any path; a passed one moves to the corpse; no item is created.
4. Both kernels refuse the same unsound declarations; every new check has a test.
5. Trap 5 does not apply (outcome, not variety).

## Proof

- Focused: `loot.test.ts`, `death_content`, `combat*` (31 pass); `content_loot_test.exs` passes.
- Seed rows recomputed with an independent Python xoshiro128**: rolls and final RNG states match all five rows.
- Mutants: `roll > chance`, reversed table order, `r.rng = died.rng!` dropped: all red. Elixir repeated-item check dropped: red. TS `npc.spawn_template` clause dropped (`cartridge_death.ts:73`): **green**.
- Only `round_attack.ts` passes an RNG to `deathSequence`; bleed, status and water kill `world.body` only.
- Opt-in: every other cartridge compiled with base and head `death.ex`/`checks.ex`: identical bytes. Fixtures only added to.
- Disputes: `Death.npc` wrapping `Services.npc` (`checks.ex:124`) accepted: one more pipe line puts `checks.ex` at 451 over its 450 allowance (`bin/check_size.exs`). Optional `rng` accepted: the only NPC killer passes it and a missing one throws.

## Findings

1. **blocker**, `kernel/ts/src/content/cartridge_death.ts:73`, `lib/loka/content/death.ex:48`, `docs/system/mechanics.md:1775`: drops load on an NPC with `hp.gain > 0`. Observed (sampler rat, gain 4, seed `[1,1,1,1]`): the dead rat holds the failed tail, is `living` again after the elapsed run, and `attack` is accepted (`engaged`); each re-kill re-rolls, so a 50% drop becomes certain. Contradicts "which nothing reaches". Fix: refuse drops unless `hp.gain` is 0 in both kernels, one test row each.
2. **blocker**, `cartridge_death.ts:73` and `death.ex:48`: the `spawn_template` clause has no test in either kernel (mutant green; without it a template rat with drops loads). Fix: one `spawn_template: true` row in `loot.test.ts` and `content_loot_test.exs`.

## Open

- Question: `loot.test.ts:95` replays from the seed (determinism), not a retried committed command; the receipt claim in mechanics.md rests on the generic replay path.
- `kernel_api` 1.43 collides with the G1 bump; toolbox row 8 status flip left to the PM.

## Re-check: fix round 1 (`fa025ad9`)

- Verdict: **APPROVE**.
- B1 fixed: `cartridge_death.ts:74` and `death.ex:49` refuse drops unless `hp.gain` is 0 (a missing `hp` still refused); `mechanics.md` and `cartridge.md` state the rule. Red controls: the gain clause reverted to the old hp check fails `loot.test.ts` and `content_loot_test.exs`.
- B2 fixed: `spawn_template` rows in both kernels; removing the clause fails each suite.
- Replay question: dispute accepted. The kernel step keeps no receipt store; the same-seed rerun pins committed state and RNG byte for byte.
- Focused `loot.test.ts` and `content_loot_test.exs` pass; `mix format --check-formatted` is clean. Hosted runs on `fa025ad9` were in progress at re-check (`e081208f` green).
