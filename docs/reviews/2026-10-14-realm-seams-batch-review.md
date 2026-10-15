# Review: Realm seams batch (loka-kgd.150, PR #386)

- PR #386, branch `toolbox/batch-rs`, head `85e84069f5bdfd10548dd0ade9d6180dacd712f0` (ci, book-e2e, graph-diff green). Slices RS-1 to RS-6, RS-8 and row 38 (loka-kgd.150.1 to .7, loka-kgd.133); RS-7 deferred.
- Governing: [Realm seams decision](../decisions/owner-decision-realm-seams-2026-10-13.md) (seams 1 to 9, brief checklist); [audit](../rnd/realm-seams-audit-2026-10-13.md); [reviewer stance](../../.claude/agents/reviewer.md); AGENTS.md "Writing tests".
- Verdict: **CHANGES REQUIRED**: one missing red test on new reaction logic (finding 1). The code at the head is correct as read.
- Written 2026-10-14 by anthropic/claude-fable-5-1 (batch reviewer).

## Must be true (written before the diff)

1. Rule 1: no `world.character`/`world.body` read under `kernel/ts/src` outside `runtime/` and `view/` except frozen markers; the lint goes red on a planted read.
2. `actorOf(world, body)` returns the character only for the admitted body; `admitted(world)` is the one remaining single-character site, in `runtime/`.
3. Rule 2: `SUBJECT` total over the 28 triggers; the delivery actor comes from the subject, else the event's `actor_id`, never the listener; `quest.resolve`/`fail` on a world subject ends every holder, on a character subject only that character; `quest.activate` with no admitted-body subject writes nothing.
4. Jobs (bleed, wage, population sight) run without reading `world.character`.
5. `gameView(world, actor)`: byte-identical for the player; a bodiless actor gets an empty view, no fault.
6. RS-8: both loaders refuse a schedule-case `when` reading a player-scope fact at the same path and code; the showcase re-pin follows a scope change, nothing else.
7. Transcript and hash fixtures untouched except the ruled showcase re-pin.
8. RS-6 doc clauses present; checklist items 1 to 9 answered per slice.

## Check against the list

1. Met. `ast-grep scan --error kernel/ts/src` exit 0; one marker left (`kernel/ts/src/mechanics/schedule/behavior.ts:51`, the NPC schedule `when` evaluated as the player, RS-8's named leftover); `bin/lint_red_controls.sh --core-only` ok for all eight rules.
2. Met. `runtime/decision.ts:187-193`. Mutant 4 below.
3. Met. `reaction.ts:180-214` (SUBJECT, 28 rows), `:340-349` (`deliveryActor`), `:292-308` (`ending` filters holders by `own`), `:136` (`npc ||` skips activation). Finding 1: the `:136` guard has no red test.
4. Met with one overstatement. Bleed derives `owner_id` by `actorOf` on the bleeding body; population sight stores `player_id` from the mover or `seerIn`; the wage job stores nothing and pays `admitted(world)[0]` (`mechanics/escort/job.ts`, `ponytail:` line; `docs/system/mechanics.md:2715` "a wage job row stores no character; the Realm stores its payer in the row"). The RS-3 brief allowed this (a save-row change is out of scope). Finding 3.
5. Met. `kernel/ts/test/view_actor.test.ts:11,19`; focused view tests green.
6. Met. TS `content/cartridge_schedules.ts` `playerFacts` and Elixir `content/schedules.ex:44-68` emit `FACT_SCOPE_UNSUPPORTED` at `...when.root.fact`; `schedule_cases.test.ts:179-185` and `content_schedules_test.exs:57-66` pin the same path. Showcase: `letter_burnt`, `warden_knows` to instance scope (PM ruling), hash re-pinned (one commit `96245b16`).
7. Met. `git diff --stat origin/main...85e84069 -- protocol/fixtures` lists only `toolbox_showcase_hash.json` (4 lines); raid_sampler content is new.
8. Met. `mechanics.md:2661` credit contract, `:654` NPC entrant activates nothing, `:2870-2875` row 38 with checklist; CHECKS.md:31 lint clause; Beads notes hold the per-slice answers.

Focused run (raid, reactions_sampler, schedule_cases, world, view_actor, water, derived; `content_schedules_test.exs`): green.

## Mutants (bin/mutate.sh, narrow suites)

| Mutant | Narrow suite | Result |
|---|---|---|
| `reaction.ts:136` `if (npc \|\| questOf(...))` -> `if (questOf(...))` | raid, reactions_sampler | **SURVIVED** |
| `reaction.ts:348` `Boolean(named && !character)` -> `Boolean(named)` | raid, reactions_sampler | red |
| `cartridge_schedules.ts` `includes('player')` -> `includes('instance')` | schedule_cases | red |
| `decision.ts:188` `actorOf` returns `world.character` for any body | view_actor, world, raid | red |

RS-1 red control (`bin/lint_red_controls.sh --core-only`, plants `world.character` in `movement/rule.ts`): red as expected, run once.

## Findings

1. **blocker** (one test), `kernel/ts/src/mechanics/reaction.ts:136`: dropping `npc ||` keeps raid and reactions_sampler green (mutant 1). Break: an NPC on a `daily_schedule` walks into the raided village; the entrant has no character, so `actor` falls to `cause.actor_id ?? root` (the player, `:343`) and `hold_the_gate` activates for the player who never entered, with `when` read as the player. The raid_sampler NPCs have no schedule, so no present case reaches the guard. Fix: in `raid.test.ts`, patch the compiled cartridge (the `(c) => ...` pattern of `schedule_cases.test.ts`) so the defender or a second NPC walks into the village during the raid, advance across that hour, assert `gate(w)` is `[]`. Beads `loka-kgd.150.7` note "NPC-entrant no-op test -> batch review list" deferred it here.
2. **should-fix** (docs or follow-up, no code), `docs/system/mechanics.md:654` and `:2870`: "an NPC entering activates nothing" is stated, but the `when` of such a rule is still evaluated as the root player (`reaction.ts:125` with `actor` = root). Scenario: `called_to_hold` with `when npc_present {defender}` is true or false by the player's view, not the entrant's. The PM accepted the mismatch; one clause in the reaction@1 section ("for an NPC entrant the `when` reads as the root command's actor; the Realm reads it as the subject") keeps the next author from relying on the entrant.
3. **nit**, PR body (and RS-3 title loka-kgd.150.4): "jobs store their character" overstates the wage job, which pays `admitted(world)[0]` and stores nothing (check 4). Reword to "bleed derives, sight stores, wage pays the admitted set (Realm: stored payer)".
4. **nit**, PR body: no `/code-review` result reported (the Beads notes carry per-slice self-reviews; `loka-kgd.150.7` names RS-4 items handed to RS-2/3).
5. **nit**, `kernel/ts/src/mechanics/schedule/behavior.ts:51`: the frozen `world.character` read stays after RS-8; with player-scope facts refused at the loader it can no longer change a result, so it could become `holds(at, undefined, ...)` or a world-only evaluator when the Realm lands. Not in this batch's scope.

Claims rerun: "48 markers -> 1 marker left" (grep: one marker, `schedule/behavior.ts:51`); RS-1 red control ok. Not probed: TS `c.facts[refString(...)]` against Elixir `resolve/4` for a `fact_compare` naming an imported module's fact (both loaders use the same lookup as their other fact checks).

Checks 1 to 9 of the brief checklist: each slice's Beads notes answer them; row 38's answers are in `mechanics.md:2874`.
