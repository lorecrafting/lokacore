# Review: hidden passages and search, toolbox row 11 (loka-kgd.26)

- Local branch `toolbox/m4-hidden`, head `b0f4eae371949c13328e29d0381e5c69cb27f295`, diff `origin/toolbox/batch-m4...b0f4eae3` (26 files); no PR. Protocol and kernel_api change (`room.schema.json`, `invalid.json`, 1.45), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row 11 and Traps](../MECHANICS-TOOLBOX.md#traps), [mechanics.md row 11](../system/mechanics.md#hidden-passages-and-search-toolbox-row-11), [cartridge.md declarations](../system/cartridge.md#hidden-passage-declarations), brief and PM ruling in Beads `loka-kgd.26`.
- Hosted CI on the head: ci 38033716198 and book-e2e 38033716183, both success.
- Verdict: **CHANGES REQUIRED** (two should-fix items from the PM ruling).

## Must be true

1. Before discovery, the commanded character gets nothing about a hidden face: no exit, scan, map link, quest-journal direction or NPC narration that names it.
2. A forged Move through it is `not_found`, and no direction-dependent admission runs first.
3. Discovery is per character, through fact@1 and an ordinary recipe. There is no new op, row or leaf.
4. Compiler and loader refuse the same cases: fact reference, `equals` type, barrier on a hidden face, kernel_api floor 1.45.
5. PM ruling: both kernels refuse patrol and expedition routes over a hidden face at compile time, and fleeing NPCs exclude hidden faces.
6. Opt-in: Chapter 1 and corpus bytes are unchanged.

## Proof

- Baseline: `hidden_passage.test.ts` and `d10_knowledge.test.ts` pass; `content_hidden_passage_test.exs` passes.
- Mutants, all red: A, drop `hidden` in `movementPlan` (`sequence.ts:110`); B, drop it in the map links (`knowledge.ts:29`); D, drop it in `sight` (`rule.ts:47`); C, drop the Elixir BARRIER_MISMATCH (`barriers.ex:78`).
- Items 2-4 and 6 hold. The diff touches no cartridge outside `hidden_sampler`. Elixir `Refs.reference` gives the same FACT_TYPE_MISMATCH as TS `typedValue`. Player `flee` excludes hidden faces because `escapeDirections` (`flee.ts:30`) calls `movementPlan`.

## Findings

1. **should-fix** (PM ruling): no route check in either kernel. `cartridge_expedition.ts:54` and its Elixir twin accept an expedition edge `hall -east-> study` over a hidden face; patrol routes likewise. Failure: `quest_journal.ts:88`/`:108` shows `direction: east` before the search. mechanics.md records this as an open "known limit"; the ruling requires a compile-time refusal.
2. **should-fix** (PM ruling): NPC flight ignores `hidden`. `flightExit` (`combat/behavior.ts:112`) and population `refuge` (`population/behavior.ts:191`) can choose the hidden east face. Failure: `round_flow.ts:155` narrates `enemy_fled[east]` to the player before discovery. Fix: filter flight with `hidden(world, room, direction, world.character)`, add one test, and update the mechanics.md "Hidden face" bullet.
3. **nit**, mechanics.md "Sampler" bullet: it says the hall leads east to a stairhead and south to the study. The hall has only `north` and the hidden `east`; gallery goes east to stairhead, and stairhead goes south to study (`rooms/*.json`).
