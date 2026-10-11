# Review: showcase slice C, the combat district (loka-y6yg.3, PR #369)

- PR #369, branch `toolbox/showcase-c`, head `56fde2efb5a29d1bf181851a3d05cb6e4cd49955`, against `main` `cf2242fa`.
- Governing: [combat-district.md](../showcase/combat-district.md) (plan 2, #368) and its [review](2026-10-10-showcase-plan-2-review.md); [SHOWCASE.md](../SHOWCASE.md); mechanics.md rows 1, 2, 4, 6b, G2, G6, G9, W8, death@1. PM decision: the `bounty` choice is hidden once the raider is dead.
- Verdict: **CHANGES REQUIRED**: one blocker (two mutants survive), one should-fix (PM decision not applied), one nit.

## Must be true

1. Steps 1-8 and 10 give the brief's numbers. Step 9 and the sandbox pack are not built, and both the plan and SHOWCASE.md say so.
2. Unarmed, the player lands nothing. The Warden takes sword hits for loss 0. Social 2-3 are unchanged.
3. hp minimum 0 moves no body, world, social or recap pin, and no attackable NPC has minimum 1.
4. `gored` never changes hp, and it survives death. `bleeding` is cleared on return.
5. Every matrix cell marked `built` has a pin that fails when its rule is removed.
6. PM decision: nobody can accept a bounty that can never resolve.

## Runs (scratch worktree, own `_build`)

- `mix test test/loka/content_showcase_test.exs`: 1 passed. A recompile of the source equals the pinned `sha256` and canonical bytes, so the hash repin is justified.
- `node --test` showcase_combat, showcase_body, showcase_world and showcase_social: 47/47. `mobile/app/book/showcase_recap.test.ts`: 2/2.
- Mutants (fixture recompiled for each):
  - Warden without `resistances`: combat 10 red. This matches the PR body's claim.
  - Kernel `status/shared.ts:157` keeps no permanent status on return: combat 6 and 8 red.
  - `bleeding` `tick_every` 1050: combat 6-8 red.
  - Boar without `immune`: **green**.
  - `bounty_done` without `when`: **green**.
- Own red control: a `leave` choice planted in `aldous_lesson` makes the compiler refuse with `OUTCOME_MISMATCH` at `choices.learn.receive`. This confirms the deviation.
- PR body claim rerun: the purse seeds match `kernel/ts/test/loot.test.ts:70,75` (rolls 60, 20 and 50, 86).

## Findings

1. **Blocker, `kernel/ts/test/showcase_combat.test.ts:222-262` (and `docs/SHOWCASE.md:50`).** Two content rules have no pin.
   - Removing the boar's `immune` (`npcs/boar.json:20`) leaves the suite green. The "bleed status x cure x immune" cell is marked `built` with nothing that checks immunity.
   - Removing `bounty_done`'s `when` (`reactions/bounty_done.json:6`) also leaves it green. The `when` matters: without it, attacking the raider before taking the bounty faults the round (`precondition_failed`; probe run). The fight can then never end.
   - Fix: after the player's hit in combat 8, assert the boar holds no active status. Add a fresh-world branch that kills the raider before the bounty is taken: the round is accepted and `raider_slain` is true. That branch also serves finding 2.
2. **Should-fix, `cartridges/toolbox_showcase/dialogues/aldous_talk.json:18`.** The PM decision is not applied. A probe accepted `bounty` after the raider died, and the quest stayed active through two days.
   - `DialogueChoice.availability` takes only times (`contracts.gen.ts:89`), so the gate has to be the dialogue policy plus key order, as `aldous_lesson` already does.
   - Give `aldous_talk` the policy `fact_compare raider_slain false`, and add a later-keyed `leave`-only dialogue.
   - Update `combat-district.md:157-158`, `sign_combat`'s "Take Aldous's bounty before you go" and the PR body disposition. Pin it: after combat 4, Talk offers no `bounty`.
3. **Nit, `text.json:428` (`sign_body`).** With hp minimum 0, a player idle on the frost fell without a cloak dies after 19 game hours (probe run). Under `real_elapsed` rate 50 that is about 23 real minutes, including time away. The brief accepts this (`:15-20`), and the letter run (social 11) loses only 1 hp. The sign's "your body pays by the hour" does not say the cold can kill, while the hub sign says "Nothing here is a trap".

## Deviations: decisions

- `aldous_lesson` with `learn` only: **confirmed** (compiler refusal reproduced above).
- `gored` with `tick_every` 60 and `resource` hp: **confirmed**. A permanent status has no job (`status/shared.ts:124`, `job.ts:21`). A probe ran a death, the return and three days: hp stayed at 10 and `gored` stayed active. The Book row shows the label only (`mobile/app/book/model.ts:29-33`).
- The poultice as a room item: **confirmed**. Item locations are only room, npc, item and template.
- `tilt_boar` without a cue: **confirmed**. `tilt_yard`'s only exit leads to `gate_yard`.
- Generic `combat.npc_hit` and `combat.npc_miss`: **confirmed**. The pins assert keys, not text.
- Manifest 1.48 with `sense_cue` and `speech`: **confirmed**. `population` and `target_choice` are left out with the pit.
- Cartridge-wide hp minimum 0: **confirmed**. Every existing pin is green. Exposure can now kill an idle player (nit 3), which the brief accepts.
- Warden `physical` 100: **confirmed** (combat 10; the mutant above).
- Step 9 and the sandbox pack after M8: stated honestly in `combat-district.md:178,187-205,215` and in the SHOWCASE.md intro and pit row.

## Re-check at `49158ac76426f8d145e5593a5f40d222d3075ccb` (fix commits `7d60a1f4`, `49158ac7`)

Verdict: **APPROVE**. Only the fix commits were reviewed. Pins: exs 1/1; TS showcase combat, body, world and social 48/48; recap 2/2.

- Finding 1, fixed:
  - `showcase_combat.test.ts` combat 8 asserts that `activeStatuses` on the boar is empty.
  - New combat 11 kills the raider (Gil's blow, no bounty taken) and asserts that the fight ends, `raider_slain` is true, the journal is empty, experience is 10 and Talk opens the lesson.
  - Mutants rerun: the boar without `immune` fails combat 8. `bounty_done` without `when` fails combat 11 (`precondition_failed`).
- Finding 2, fixed:
  - `aldous_talk` has the policy `raider_slain false`.
  - The new `aldous_yard` has the policy `raider_slain true` and offers Leave only. Its key sorts after `aldous_talk`, so Talk opens it only once the raider is dead.
  - Combat 4 pins that Talk opens `aldous_yard`.
  - Own mutant: `aldous_talk` with an empty policy fails combat 4.
  - The plan (`:106-107`, `:116-121`, `:156-162`), `sign_combat` and the PR body are updated.
- Nit 3, fixed: `sign_body` adds "a long enough bill is paid with your life". The plan 1 quote is synced, and the hash repin matches the source (exs green).
