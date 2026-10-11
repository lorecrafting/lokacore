# Review: M9 spell XP + fatal-blow reactions (loka-kgd.101, loka-kgd.105)

- Branch `toolbox/m9-spellxp`, head `a576ff078b9114ea9453ff9377f10420adc4427d`, diffed against `e56d1226` (`toolbox/batch-m9`). No PR (batch model). Installed `kernel_api` 1.58 to 1.60, no floor.
- Governing: [Spell effects, row 29b](../system/mechanics.md#spell-effects-toolbox-row-29b) (`mechanics.md:2363-2364`, amended here), [Party credit](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b) (`mechanics.md:2259`), [Status effects, row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1) (`mechanics.md:1811`, amended here), Beads `loka-kgd.101`, `loka-kgd.105`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker: a guard the suite does not pin).

## Must be true

1. A spell kill pays once (experience and `death_credit`), only when the root command is the player's own `cast`, the death's cause is that cast and the caster's body is the killer, with the corpse and fatal hp proofs; a status tick, bleed, drowning, NPC or reaction kill earns nothing through the cast path.
2. No double credit: a spell kill leaves no round that can credit the same death again.
3. A hit that leaves an NPC alive opens a fight only where Attack would (`attackRefused`), never while the caster fights, with the first round one interval after the cast ends (never inside its own advance).
4. A reaction status skips only a holder whose `entity_died` comes after the cause; a reaction on the death itself, a permanent status, a different holder and a holder whose death came first are unchanged.
5. Chapter 1 receipts unchanged; docs match the code.

## Proof

- Named files green at head (87 pass): `spell_effects`, `spells`, `combat_credit`, `levelling`, `targets`, `writer_groups`, `reactions`, `showcase_combat`, `death`, `death_content`, `c5_bleed_death`, `e1_creatures`, `transcripts`; `npm run typecheck` exit 0. No frozen fixture or expected answer touched.
- Mutants (reverted, worktree clean): killer check dropped (`credit.ts:88`) red; cause check dropped (`credit.ts:86`) red; `!slain` dropped (`spell.ts:101`) red; first round from `from` not `end` (`rule.ts:84`) red; `>` to `>=` and to `<` (`reaction.ts:170`) red (showcase 6-9); `!lasting` dropped (`reaction.ts:214`) red.
- Survivors: `attackRefused` dropped (`spell.ts:103`), finding 1. `engaged(world, body)` dropped (`spell.ts:103`): equivalent in shipped schema; it differs from `attackRefused` only for a `retarget`, which needs a target in a roster (`active_ids`), and rosters hold only spawned members while a spell names authored NPCs (row 29b limit, `mechanics.md:2368`).
- Probes: bolt hit then in-fight bolt kill credits 10 experience once, closes the encounter, leaves no pending encounter job (point 2). Only spell damage (`spell.ts:137-138`) and a round (`round_attack.ts:158-159`) set a non-null `credited_character_id`; status tick, drowning and bleed (`status/fatal.ts:51`, `water/expiry.ts:30`, `bleed/job.ts:31`) set none, and no round runs inside a cast (a `duration` cast is refused while engaged), so only the cast's own damage meets `spellKill` (point 1).
- Writer groups and ordering: `opened`'s ops carry `writer_group: 0`, the cast's group; the first round is due at `end + interval`, after the cast's own `time.advance` (mutant `rule.ts:84` red, point 3).
- Cites rerun: `diedAfter` runs once per delivery in `react` (`proposal.ts:234`); `opened` is in `disposition.ts:81`, engage's room equals `containers[npc]` because `hostileAt` filters on it (`disposition.ts:68`), so engage is unchanged. Merge with `toolbox/m9-readers68` is clean in `disposition.ts`; `world.ts` conflicts on `kernel_api` (1.60 vs 1.61), a batch-sync item.

## Findings

1. **blocker**, `kernel/ts/src/mechanics/action_recipe/spell.ts:103`: removing `attackRefused(world, actor, hurt)` leaves every named file green. Scenario: a bolt hits the wight in a sanctuary room (or from a seated caster, at an ally, during a scene) and opens a fight Attack would refuse. Reviewer probe: crypt marked `sanctuary`, `flamma` hit; real code opens no encounter, the mutant opens one (probe red). Pin one refused case in `spell_effects.test.ts`.
