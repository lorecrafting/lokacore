# Review: showcase plan 2, the combat district brief (loka-y6yg, PR #368)

- PR #368, branch `docs/showcase-plan-2`, head `c2af11bcfc52fd4cf2283092507c0d53ea127930`, against `main` `d9dd596d`. Docs only (the brief and the matrix); the record is kept at the PM's request.
- Governing: [SHOWCASE.md step 1](../SHOWCASE.md#how-a-batch-adds-a-district) (buildable with installed mechanics; engine needs are toolbox findings), [mechanics.md](../system/mechanics.md) rows 1, 2, 4, 6a, 6b, 6c, 8, G2, G6, G9, W8, death@1, combat@1, C4.
- Reruns: `elixir bin/check_docs.exs` at the head: 0 broken links (as the PR body says). PR-body claim "avoids loka-lpq6 by construction" is not backed (finding 7).
- Verdict: **CHANGES REQUIRED**: three should-fix and four nits, all doc edits. No step needs engine code.

## Must be true

1. Every field the brief names exists on `main` with a sampler precedent, and the capability diff is complete.
2. Unarmed, the player still lands nothing anywhere (social 2-3); the sword is the striking profile only while its skill is usable.
3. Every expected number follows the rules: hp, damage with derived str, resistance order, bleed 1800/900, XP thresholds, party credit, pack rotation and credit, drop order, cue range, death return.
4. hp minimum 0 moves no existing pin; no attackable NPC has hp minimum 1 (loka-2lvx).
5. Steps that cannot be built yet (loka-6ql4) are gated, in the brief and in the matrix.

## Verified

- (1) `round_attack.ts:233-240`: the wielded weapon strikes only when its skill is usable, else `player_attack`; the derived table applies to whichever strikes. Lesson with no `lesson_payment` and one `skill.acquire` is accepted (`cartridge_skills.ts:90-95`); `skill_blade` is implicit (`fact.ts:110`).
- (2) Warden declares `attributes` (cha only), so its attack reads str at the start 10 (`attributes/shared.ts:81-87`): bonus 0, chance 0 stays 0. G2 order gives loss 0 at resist 100.
- (3) `hit_chance` would lift `player_attack` too (row 2). Correct to omit.
- (4) Asserted hp in showcase pins never goes below 7 (`showcase_world.test.ts:75,79`, `showcase_body.test.ts:113`, `showcase_social.test.ts:302`); hp drains exist only on `fell_top`/`the_fold`; no simulator or recorder uses this cartridge.
- (5) Only the Warden has an `attack` today (min 0).
- Capabilities: the diff to `main` is exactly `population`, `sense_cue`, `speech`.
- Numbers: steps 2, 3 (bleed tick +1050, expiry +1950), 6, 7, 8, 10 (+1050, +1950, end +2100), 11 (cursor starts at the attacked goblin, `rule.ts:53`), 12 and the sandbox all follow the rules. Dead NPC cues drop from the view (`senses.ts:68`).

## Findings

1. **Should-fix, `docs/showcase/combat-district.md:104`.** The signpost says "Every kill earns experience". Step 11 (`:175`) pins goblin B's kill at no experience (loka-lpq6). A player reads a promise the pin denies. Fix: drop the clause or say "the last foe of a pack".
2. **Should-fix, `combat-district.md:167`.** "no mv change past 100" is wrong. Each move costs 1 mv (engine default, `mechanics.md:51-53`; the cartridge has no `movement.cost`) and Flee 2 (`flee_multiplier` 2). After inn to yard, north and Flee, mv is about 96. The poultice is then edible as ordinary food and restores 1. A build pin written from the brief would assert a false value.
3. **Should-fix, `docs/SHOWCASE.md` matrix rows "combat x loot x levelling x death" and "scars x death x same-body return".** Their pins include step 8, the death in the goblin pit. `:193` defers the pit while loka-6ql4 is open. Only the target-choice row is gated, so the build slice could mark these `built` with no death step. Fix: gate them too, or move the death to the boar (unarmed, 1 per round, no pack), which also shows the bleed cleared and the scar kept on return.
4. **Nit, `:75-82`.** `sign_hub` opens "Three roads leave this inn" and the inn description says "three roads meet" (`text.json:354,365`). The brief rewrites only the fourth-road sentence. `map_positions.json` also needs the five new rooms with unique coordinates (`cartridge_knowledge.ts:55-66`).
5. **Nit, `:92`.** The tilt boar is "as the boar". If it is its own definition, `boar_gore`'s `npc_present {npc: boar}` and the `kills` entry miss it: no wound and no XP in the sandbox. Name the reaction `when` and the kills entry for it.
6. **Nit, `:24`, `:203`.** Only Wat declares hp; Nell and Bess have none. The pin "false after a shout from the inn" needs a branch from before the yard shout, since `gil_warned` never reverts.
7. **Nit, PR body.** It says loka-lpq6 is avoided by construction, but step 11 is built on it (70, then 80). The body reports no `/code-review` result.

## Question

- Step 6 runs death credit, `fact_changed`, `quest.resolve`, `quest_resolved` and `experience.grant` inside an elapsed round job. `levelling_sampler` only runs this chain from a Move. `proposal.ts:234-244` gives reactions the elapsed command's actor, so it should hold; the build pin decides.

## Re-check at `cf4b731944ea6362cdd3c64577cd83a2e56bbd80` (fix commit `cf4b7319`)

Verdict: **APPROVE**. Only the fix commit was reviewed. Read-only; no tests run.

- Finding 1, fixed: the signpost now reads "A kill that ends a fight earns experience (in a pack, the last goblin standing)", which matches step 9 (loka-lpq6).
- Finding 2, fixed: no step pins an mv value. Moves cost 1 mv and Flee costs 2; step 8's "mv +1" holds below the maximum.
- Finding 3, fixed: the death moves to an unarmed boar fight (step 6), and only step 9 waits for loka-6ql4. Every matrix row's step numbers match the new steps: death 4-8, senses 1 and 8, pack 9 (gated), allies 4, scars 6, bleed 6 and 8, speech 2-3, lesson 2, 5 and 8, Warden 10.
- Nits 4-7, fixed: the hub text and map positions, `tilt_boar` (own definition, `kills`, `boar_gore` `any` leaf), Wat, Nell and Bess, the inn-shout branch, and the PR body (lpq6 named; `/code-review` stated as not run).
- New numbers checked against the rules:
  - Step 4: hp 10 to 9.
  - Step 6: the boar hits 2 for hp 7, 5, 3, 1, then 0 at +750, the last loss clamped. The bleed tick at +1050 never lands. On the return, hp is 10 and mv 100 (`world.death.restore`). The return clears every status except the permanent `gored` (W8). The levelling row (experience 30, str allocation) persists. The removed sword is a held root, so it moves to the corpse (death@1). The boar stays at 8 (gain 0).
  - Step 7: the boar never re-engages. G11 says only a declared `hostile` with `engage` engages on an ordinary move, and the boar declares no disposition.
  - Step 8: damage 3 gives boar 5, 2, 0 and hp 8 then 6. Bleeding opens generation 2. At str 10 the fight is four rounds and ends at hp 2. The variant ticks at +1050 and +1950 and expires at +2100.
  - Step 9: hp 6, 5, 4, 3, 2 and experience 70.
  - Step 10: the toll gate is closed, so Flee has one candidate (west).
  - The stale generation-1 bleed job may fall due on a step-8 round. That job is inactive, so it writes nothing, and loka-x2gv's narrowing (status tick and round on one body share a group) covers it.
