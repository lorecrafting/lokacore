# Review: batch M15 head, PR #413 (loka-kgd.170)

- PR [#413](https://github.com/lorecrafting/lokacore/pull/413), branch `toolbox/batch-m15`, exact head `0eaa437b838621391f27395994a87fa94b3a189d` (merge of `origin/main` `d3b09d658`).
- Scope: row 47 death penalty contract second look (`loka-kgd.171`, kernel_api 1.109), FD6 Chronicle fix round 1 (`loka-kgd.143`), the main merge.
- Governing: [mechanics.md Death penalties](../system/mechanics.md#death-penalties-toolbox-row-47), [row 4 Write](../system/mechanics.md#experience-and-levelling-toolbox-row-4), [cartridge.md death penalty declarations](../system/cartridge.md#death-penalty-declarations), [save.md Levelling recovery](../system/save.md#levelling-recovery), [WORKFLOW Review stance](../WORKFLOW.md), slice record [2026-10-16-m15-47-penalty-review.md](2026-10-16-m15-47-penalty-review.md).
- Written 2026-10-16 by anthropic/claude-opus-5-5 (Opus, not Fable, at high usage). Verdict: **APPROVE**.

## Must be true (written before the diff)

1. Loss is `floor(xp × percent / 100)`, floored at the threshold at or below xp, so a death never costs a level (PM ruling); a 0 loss writes nothing.
2. One `levelling.set` for `owner_id`, folded with same-proposal grants by `oneWrite`.
3. Both composers relax only "experience may not fall"; allocated still may not fall.
4. Loader and compiler refuse alike: penalty below 1.109, experience without `world.levelling`, unknown narration key; schema bounds.
5. `items: kept` leaves roots on the body; NPC deaths never read the penalty.
6. Opt-in: no other cartridge hash moves; old saves replay unchanged.
7. FD6: nothing stored; day from `time.advance` ops; combat lines excluded; milestones from `story_point_reached`; no kernel change.
8. Merge: MECHANICS-TOOLBOX row 47 from the batch, G10 from main; 1.109 sits above main's 1.108; gen files current.

## Checks

| Item | Result |
|---|---|
| 1, 2 | `kernel/ts/src/mechanics/levelling/shared.ts` `lose`: floor = last threshold ≤ xp; equal value writes `[]`; `write` reads the prefix `expected`. `penalty.test.ts` covers 32→30 and 101→100 with the line (slice nit fixed). |
| 3 | `kernel/ts/src/foundation/compose_levelling.ts` and `lib/loka/core/compose_levelling.ex` drop the same term. |
| 4 | `cartridge_death.ts` floor `'1.109'`; `lib/loka/content/death.ex:155` `[1, 109]`; `protocol/fixtures/loader_floors.json:1436` 1.109 above 1.108 (`:1426`). |
| 5 | `sequence.ts` `transferRoots` returns `[]` only for a player with `kept`; all five `deathSequence` callers pass a prefix or applied world. M14 arrest is not a death; no interaction. |
| 7 | `narration.ts` `chronicle`, `book/chronicle.ts` `days`; fix round 1 (`d386b7f39`) calendar and open-transaction tests present. Combat-line limit is documented in mechanics.md Lines. |
| 8 | `git show --remerge-diff`: resolution as stated. `elixir bin/contracts.exs --check` 0, `bin/features.exs --check` 0, `bin/review_index.sh` 0, tree clean. |
| Focused tests | TS penalty, loader_floors, levelling(_composition) green; Elixir content_penalty, loader_floors, content_levelling 0; mobile chronicle (authority, book), recap 0. |

## Mutants (restored after each; tree clean)

| Mutant | Result |
|---|---|
| A `shared.ts` levelUp `<` → `<=` | red: penalty.test.ts "a death at 50 lowers experience to 45 once" |
| C `death.ex` narration check forced true | red: content_penalty_test "penalty refusals match the TS loader" |
| D `narration.ts` `lines > combat_lines` → `>=` | red: chronicle.test.ts "accepted receipts with World lines…" |
| E `book/chronicle.ts` milestone add dropped | red: book chronicle.test.ts "…a milestone marked" |

## PR body claims rerun

- "contracts and docs checks 0": backed (row 8).
- "/code-review medium … results in the slice Beads notes": backed (`loka-kgd.171`, `loka-kgd.143` handback notes name fixes and open items).

## Findings

None.
