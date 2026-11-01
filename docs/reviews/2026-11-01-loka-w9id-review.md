# Review: unattackable NPCs, PR #550 (loka-w9id, kernel_api 1.135)

- PR [#550](https://github.com/lorecrafting/lokacore/pull/550) `engine/peaceful-npcs` at `945f07161813fa73954c43ae4cff690870d22ff8`.
- Governing: `br show loka-w9id`, audit B1 in `loka-vduxr`, [combat@1](../system/mechanics.md), [save pin](../system/save.md), [review count](../WORKFLOW.md).
- Reviewer: independent; authored none of the work.
- **Verdict: CHANGES REQUIRED.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success.
- A second opinion is required: the slice changes `protocol/entity.schema.json` ([Review count](../WORKFLOW.md)).

## Must be true

1. A flagged NPC cannot be hurt by any player-started route: Attack offered, Attack sent directly, spell, thrown item.
2. Nothing else starts hurting it: reaction, group or pack round, companion joining, an NPC attacking it, a schedule.
3. The offer and the executor read one admission query.
4. A flagged NPC with no hp does not fault on any route.
5. Existing content: hashes and transcripts unchanged.
6. Player-visible text comes from an authored key only.
7. Elixir and TypeScript agree (candidate C: TS decides, Elixir compiles and refuses).
8. A save from before the flag still loads.

Results: 1 and 2 fail (findings below); 3 to 7 hold; 8 holds with the limit under "Save".

## Findings

**blocker** `kernel/ts/src/mechanics/scripted_action/spell.ts:143`. `damage` reads only `target.hp`, not `unattackable`. Run on the spell effects sampler with the wight flagged: Attack absent and refused `invalid_target`, flamma offered `available: true`, cast accepted, hp 8 to 4 to 0, the second cast emitting `entity_died` with the caster as killer or credit, a third cast refused `invalid_target`. No fight opens because `fightBack` reads `attackRefused`, but the protected NPC dies at the player's hand. The brief lists spell as a route, and the issue's model is "can't be hurt". No throw command exists; a scripted action with a damage step reaches the same `effect` path (`rule.ts:277`, read). The PR leaves this open and `docs/guides/writing-the-game.md:206` documents it. No test covers it. Fix: `|| target.unattackable` in that guard, with a test; a PM ruling that the guide's sentence is the intent would move this to a note.

**should-fix** `kernel/ts/src/mechanics/scripted_action/spell.ts:80` (mechanism `status/job.ts:174`). An hp-draining status on a flagged NPC ticks and kills: a flagged wight warded with `per_tick -3` on hp went 8 to 5, and from 2 to 0. Routes: an aimed status spell (run) and a reaction's `status.apply` (read; same tick). The issue says poison should work for every NPC, so PM ruling needed: refuse the player-aimed route at least, or document it.

**nit** PR body cites `spell.ts:118` for `damage()`; that line is `fightBack`, `damage` is at :135-143.

**nit** `/code-review` ran at f43b1b0fd, later commits not re-reviewed; run it in the fix round.

**question** The issue also asks for switching in play, a shared refusal reason and a showcase story. None shipped, and the PR says so for switching. Does `loka-w9id` stay open, or are they split out?

## Routes closed (read and run)

- Attack offer and direct command: probe, and `fear.test.ts`. No-hp flagged NPC: Attack, damage spell, status apply and ticks all without a fault (probe).
- NPC attacks: `round_attack.ts:65-69` foes strike only the body. Companion: allies strike only the opponent. Schedule: opens no encounter (read); `hostileAt` reads `attackable`.
- Pack: refused at compile, including through `extends` (probe); no runtime guard beyond the target's own `attackRefused`.
- An NPC child inheriting the flag with an engage line: refused (probe). A non-boolean flag: refused by schema (probe).

## Tests and claims

- Narrow mutants via `bin/mutate.sh`, 7 of 7 red-narrow, matching the PR table: `shared.ts` (flag, ally, `attackRefused`), `view/combat.ts`, `disposition.ts`, `standing.ex` (`bad?`), `combat.ex`. The two compile checks fire on planted violations in `content_unattackable_test.exs` (49 passed with the explain tests).
- Focused green: `transcripts`, `group`, `schedule`, `c4_pack`, `content_showcase`, `release_pin`.
- No cartridge or frozen fixture changed; the seven `mobile/app/stories/live/*.sql` diffs are `kernel_api` only (diff empty for all seven after normalizing 1.134 to 1.135).
- Claims rerun, both backed: no non-test Book file names `'attack'`; toolbox_showcase's ally `gil` has no engage and its engage NPCs are `warden` and `watchman`.
- Composition record present; capability code names no mechanic or content. Nothing to delete.

## Save

A save pinned to 1.134 is refused at its pin with Start over under 1.135, by contract (`docs/system/save.md`, `release_pin.test.ts`); this holds for every kernel_api bump. The state itself is compatible: no new row or required key, and absent reads as attackable.

## Not run

`bin/mutate_diff.sh` and the full suite (brief). Explain rows and the schema key rename were not mutated by this review (PR table only).

## Re-check at `f3eda121807399e8a063540ff1fcbc1698d53379`

**Verdict: APPROVE WITH NOTES**, at `41cb943272b90e33c237478bf0bb63831959dfe9` (f3eda1218 plus the reviewer's test-only [small should-fix](../WORKFLOW.md#small-should-fix)). CI at f3eda1218: ci, book-e2e and graph-diff completed, success. CI at 41cb94327 when this was written: graph-diff success; ci and book-e2e in progress, not waited on.

Dispositions, run on the head:

- Blockers closed: a flagged NPC stays at 8 hp under aimed and named `flamma`; an aimed hp-draining status adds no row (`spell.ts:80`, `:160`).
- NPC with hp and no `attack`: flamma takes it 8 to 4, as before. The guards read `target.unattackable` only.
- Non-draining status (tick 0, tick +2, resource mana, plain) still lands on a flagged NPC.
- Reactions: `effect`'s one caller is `rule.ts:277`, so a reaction's `status.apply` does not reach the guard. Guide and `mechanics.md` document it (PM ruling). Read, not run.
- Hashes: `bin/regen.sh` at f3eda1218 exited 0 and left the tree clean. No transcript, cartridge, fixture or `contracts.gen.ts` changed since 945f07161. Focused `spell_effects`, `aimed_spells`, `fear`, `npc_status`, `transcripts` and `npm run typecheck` green.

Mutants on `spell.ts` by `bin/mutate.sh`: 4 of 6 red; the `key === 'hp'` and `per_tick < 0` to `<= 0` mutants survived at f3eda1218, a blocker under reviewer step 3. Closed in place by the reviewer's push 41cb94327 (+9/-6, `spell_effects.test.ts` only, no src change): 6 of 6 red. The small-should-fix lane names should-fixes, not blockers: the PM confirms the diff has no logic change and accepts it there, or calls a fix round.

Open items:

- Cast at a flagged NPC: accepted, line plays, mana 10 to 9, no effect. Allowed, not a finding: the same as an hp-less NPC (10 to 9, probed) and as `lux` with nothing to light. Refusing it is new admission; it joins `loka-zmqs` item 1 (`cannot_be_hurt`, no mana).
- `standing.ex:20`: nit. An area-bundled flagged NPC with `engage` compiles silently (reading of the `[]` pattern, shared with `shapes`, not run); the line never plays because `attackable` stays false. No state harm; follow-up.
- `combat/shared.ts:33`: no finding. An ally with `engage` is a dead line by the same query; a compile check is optional and goes with the same follow-up.
- `fear.test.ts:331`: no finding. The slice left `hostileAt`'s arrest branch unchanged, and flagged group members and population members are refused at compile (`combat.ex:203`, `standing.ex:56`).
- In-play switching: not built, stated in the PR body. The issue text asks for it, so closing loka-w9id needs a follow-up issue for it; none exists yet (`br search` on "attackable", "peaceful"). `loka-zmqs` item 2 (shared `attackable`) is done by this PR: update it.
