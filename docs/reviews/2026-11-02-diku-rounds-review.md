# Review: opt-in Diku rounds, PR #590 (loka-kgd.197)

- PR [#590](https://github.com/lorecrafting/lokacore/pull/590) `combat/diku-rounds` at `aa96696233075e71919fb9cd7d49fcbd17b3cbb8`.
- Governing: [mechanics.md Diku rounds](../system/mechanics.md), [cartridge.md Diku rounds](../system/cartridge.md), [owner decision 2026-11-01](../decisions/owner-decision-diku-rounds-2026-11-01.md); the PM's rulings (a) and (b) from the brief.
- Reviewer: independent; I authored none of the work.
- CI at this head (`gh run list --commit`): ci completed/success, book-e2e completed/success.
- The PR body reports the developer's `/code-review medium` result.

## Must be true (written before the diff)

1. An opt-out cartridge keeps its bytes, hash, transcripts and GameView.
2. Attack runs round 1 with no `job.complete`. The successor is due at clock + interval. A fatal round 1 closes the fight with no successor.
3. Each round makes one `uniform(2)` initiative draw, within the eight-draw budget.
4. `{attacker}`/`{target}` bindings exist only with initiative.
5. Tiers fire when `100*loss >= at*max`. Conditions fire when `100*(cur-min) >= at*(max-min)`.
6. The condition line describes the foe the player struck. It is omitted when that foe died and comes before the death line.
7. A missing job is valid in a save only for a closed round-1 row in an initiative world.
8. Elixir and TS compose the same way (`occurrence`). Content validation matches the schema.
9. kernel_api is bumped (1.150).

## Checks that held

- (1) Fixtures only gain cases. Of the hash fixtures, only `toolbox_showcase_hash.json` changes, and that cartridge opts in. No other cartridge's transcripts change. `diku.test.ts` test 5 covers a world without initiative.
- (2) and (7) The successor is at clock + interval. `openingKill` is limited to `causation_id === root.id`, so a later due job in the same proposal gets no opening credit. `saved.ts:34` holds. Hostile engage and fightBack still schedule their job.
- (3) The occurrence fallback holds. A missing job reaches compose only through a same-delta open, or a closed saved row that cannot advance. Mutant `occurrence` -> `undefined` (`compose_rows.ts`): 4 of 87 tests fail.
- (5) Narrow mutant `playerFirst` `=== 0` -> `=== 1` (`round_attack.ts:49`): 8 of 87 fail. Mutant `openingKill` `initiative !==`: 8 fail.
- PR claims rerun: "Focused kernel tests: pass 87" (I got 87/0 on the same ten files). The `saved.ts:100`/`:105` cites point at the lines named.
- (4) Bindings come only from `naming()` under initiative (`round_flow.ts:265-276`); see the should-fix on `{target}`. (8) `occurrence` in both kernels (`compose_rows.ts:14`, `compose_job.ex`); `COMPOSES` adds `death` only, left open by the developer. Composition record present; capability code names no content. (9) `world.ts:110` kernel_api `1.150`.
- (3) Draw budget, worst case: initiative 1 + player 2 + foe 2 + ally 2 = 7 <= 8; `allyFits` is `draws <= 6`; loot draws the world RNG afterwards. Holds.
- Warden (probe 5): no test or quest needs him alive except social 2-3, which seeds every round to a miss. If he dies, `warden_lets_pass` can never be set, but the tollhouse is still reachable from the mill through `tollhouse_door` (`rooms/mill.json:10`, `force_tollhouse_door`). The docs record the change (`hub-and-first-districts.md:308`, `combat-district.md:227`). Accepted.
- Showcase step changes (probe 6): combat 6 and 8 move every time by one interval because round 1 now runs at the Attack. The combat 8 purse comment derives its seeds from numeric-vectors `rng_steps`. Combat 9 keeps its intent (switch, kill credit 70/80).

## Findings

**blocker** `kernel/ts/src/mechanics/combat/round_flow.ts:284`: `condition()` reads the encounter's `npc_id` after the round. In a pack, `successor` has already promoted the next member by then. Probe: showcase combat 9 unswitched, the player kills goblin A while B is at 6/6. The lines are `combat.player_hit_50, combat.condition_100, combat.npc_died`, so "A goblin is in excellent condition." describes B and comes right before A's death. This breaks ruling (a) and the mechanics.md rule "No line when the foe died". `kernel/ts/test/showcase_traps.test.ts:343` pins the same wrong case (`condition_100 // B's, the new foe's`, after A fled). Fix: take the foe from the round's player `attack_result` target, never the next member; no line on its death. Change traps:343.

**blocker** `round_flow.ts:248` (tiers) and `:289` (conditions): ruling (b) is not met. My mutant `100 * e.loss` -> `101 * e.loss` stays green on all 87 focused tests. A `>=` -> `>` slip at a 100 cut would also go unnoticed for any foe with max >= 101. Fix: add a foe with hp max >= 101 to `diku_sampler` or a test fixture, and assert a tier line and a condition line on both sides of a cut. The brief's ban on changing hp covers the showcase, not a sampler.

**blocker** `kernel/ts/src/mechanics/combat/credit.ts:123`: replacing `root.payload.type === 'attack'` with `true` survives all 87 focused tests, and my `mutate_diff` row `credit.ts:123 === -> !==` is SURVIVED. The PR body's "credit, rule and round: red" is not backed for this line. Credit exists to reject counterfeit attribution. A proposal from a non-attack root, carrying a forged `attack_result` and a death whose `causation_id` is that root, would skip the `jobRan` check. Fix: add one counterfeit case to `combat_credit.test.ts`.

**should-fix** `round_flow.ts:265-276` with `mechanics.md:2876`: without initiative `naming()` gives no bindings, so a `conditions` text containing `{target}` renders the brace literally (`fillSlots` leaves unbound slots). The spec says the condition line binds `{target}` and that conditions work without initiative; `diku.test.ts` test 5 pins no binding. Fix: bind `{target}` on the condition line always, or amend the spec.

**question** `saved.ts:34`: suppose a later version of a cartridge drops `initiative`. A save holding a closed round-1 row with no job would then fail to load. Is that intended?

## mutate_diff rerun (head, MUTATE_MINUTES=30)

76 mutants (47 run): red-narrow 14, SURVIVED 6, NO-TESTS 26, NOT-UNIQUE 3, TIMEBOX 27 (unrun: rule.ts:84, saved.ts:35-45, invariants_creation.ts:270, combat.ex:45/46/67, compose.ex:227, line_words.ts:104/106). Matches the handback on credit.ts:123, round.ts:66/84 SURVIVED and round_flow NO-TESTS. round.ts:84 disposition (writer_group) accepted. rule.ts:59/61 SURVIVED in the finder; the handback claims hand rows red, not rerun by me. For round_flow I hand-ran only the tier and condition `101` mutants (both survive); the other round_flow rows rest on the handback's hand runs (18 red, 5 survived).

**Verdict: CHANGES REQUIRED.**
