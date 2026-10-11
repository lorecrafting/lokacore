# Review: showcase plan 3, cause and effect in Low Wardle (PR #371, loka-y6yg.4)

- PR #371, branch `docs/showcase-plan-3`, head `26fb4b8b35095ca99159fc6d4f98c4a49938ee03`; reviewed against `origin/main` `64733950` (after #369). Docs only: `docs/showcase/cause-and-effect.md` (new), `docs/SHOWCASE.md`. Record kept per the PM brief.
- Governing: owner idea Beads `loka-lvno`; [mechanics.md](../system/mechanics.md) rows G3, G11, W3, W10, 46, 5/G5, W27; [Review stance](../WORKFLOW.md#review-stance) (docs-only: short review, no mutants).
- Hosted CI on the head: ci and book-e2e success (`gh run list --commit`). PR body reports `/code-review medium` (seven findings fixed).

## Must be true

1. Every step is buildable as content on `main`, with no engine change.
2. The timings hold: a one-game-day fuse; no letter deadline inside step 17; weather as stated.
3. Every proposed line follows the hard rules (no score, no "because you", no narrator adjective, detours not walls, asymmetric).
4. It composes with #369 (the Warden's resistances, combat 10, the shared files).

## Proof (all hold unless listed under findings)

- Fuse: `job.ts:46-47`, `expired = now >= ends_at` skips the tick, so duration = tick_every = 86400 is one job that emits only `status_expired`. G3 says an item status adds no line. `kindle.json`/`charred.json` are the precedent for `item:` and the trigger. `reaction.ts` `assignment`/`targetOf` (`fact.ts:45-46`) write a non-subjective player fact at the actor, so `warden_knows` lands on the player.
- W10 fallback: `schedule/rule.ts:111,126` (same room: no transfer, no `entity_entered_room`), so the recap pin stays Tam only. Tam's inline case is the shape precedent.
- G11: an NPC walking in engages no one. Gifts: the player's own take writes no trust. An encounter ends when the two are apart (`combat/shared.ts:117-118`).
- Dialogue: the first in key order wins (`dialogue/selection.ts:32,39`), so `nell_ash` opens before `nell_rumour`. Press: intimidate 0 to 1 to 2 (growth `[1,2]`, untaught), so it passes on the third try. Pick (growth `[1]`) and `strongbox_lock` rating 1 give two tries. Force: str 10 ≥ 1.
- Weather oracle (`showcase_social.test.ts:3-5` formula rerun): SOCIAL is day 1 = 2 (frost), day 2 = 3 (rain), so the claim holds. Only `fell_top` and `the_fold` are `exposed`, so the Warden takes no weather status on the green.
- Deadline: `carry_letter` lasts 60000 s, so step 15's no-accept is needed and burn resolves it. The clock arithmetic holds: 28.8 real minutes a day, a threshold of 25 game hours, and 07:00 to 13:00 in 7.2 real minutes.
- Toolbox findings 1 and 2 hold: reaction `apply` has no barrier op (`protocol/reaction.schema.json`), and `reaction.ts:113` `holds` passes no target.
- Combat 10 (`showcase_combat.test.ts:273-290`) still holds under `any(...)`, since it takes the standing -2 branch.

## Findings

1. **should-fix** `docs/SHOWCASE.md:3`: the branch conflicts with main (`git merge-tree` conflict). After #369, main reads "plan 2 ... is built but for its goblin pit", but the PR's line 3 still says plan 2 "is planned". A hand resolution that keeps the PR side reverts plan 2's status. Fix: merge main and keep main's plan 2 wording. Also, `cause-and-effect.md:5-7` "after PR #369 merges ... rebases onto it" is stale, and a rebase breaks Git hygiene.
2. **should-fix** `docs/showcase/cause-and-effect.md:188` (finding 4): the engage line "knows you for a troublemaker" is the payoff line of pattern 4 (step 17, and save B's "raises his cudgel"). It breaks the brief's own rule at line 21. `showcase_social.test.ts:109` pins only the key, so the brief should require the rewrite, not leave it as "may". The same applies to the existing `scene.letter_ash.2`, "The village will hear of this.": it announces the echo at the burn and answers the owner's "was I told?" question in advance. The brief should name it and either reword it or keep it as a deliberate choice.
3. **nit** `cause-and-effect.md:133`: combat 10 does not assert "the gate shut"; it pins the resistance and Flee.
4. **nit** step 17, "chance 0 both ways": the player hits (combat 10 asserts `hit: true, loss: 0`). Only the Warden's chance is 0.
5. **nit** `cause-and-effect.md:174` (finding 1): cite `loka-kgd.96`, which is now filed.
6. **nit** step 21: the burn route crosses `fell_top` on the frost day 1. The player is chilled at about 09:00, so the settlement also carries the chilled tick (about 11:00) and expiry (about 11:30) lines. An exact recap pin would find more than Tam and the Warden.
7. **nit** playtest (`:152,159`): on return (about 18:00 day 2) the Warden is at the gate, not on the green. "Wat stood at the gate" can only reach the player through Nell's line.

Question: from 13:00 to 14:00 the hostile Warden is on the green, so under G11 a player who walks onto the green then (the save B "be on the green at 13:00" step) is engaged there. Is that intended? It is a detour, but the brief does not say it.

Verdict: **CHANGES REQUIRED** (two should-fix findings; buildability, timings and the toolbox findings hold).

## Re-check at d09244bc

- Head `d09244bce36d9cad4c0280d84a2a82e0a405ea4e` (merge of `origin/main` plus fixes); fix diff `26fb4b8b..d09244bc` on `docs/SHOWCASE.md` and `docs/showcase/cause-and-effect.md` only. `git merge-tree` against `origin/main`: clean. `elixir bin/check_docs.exs`: 0 broken.
- Finding 1, fixed: `SHOWCASE.md:3` keeps main's plan 2 wording ("built but for its goblin pit") and the table keeps #369's rows; `cause-and-effect.md:4-6` no longer says "rebases".
- Finding 2, fixed: `cause-and-effect.md:20-22,195-200` make both rewrites required (Toolbox finding 4). No test pins the words: `npc.warden.engage` and `scene.letter_ash.2` appear only in `text.json:400,496`.
- Findings 3 and 4, fixed: `:139` (combat 10: a hit for no loss, Flee); step 17 says only the Warden's chance is 0.
- Finding 5, fixed: `:185` cites `loka-kgd.96` (open, filed).
- Finding 6, fixed: step 21 names the `chilled` tick and expiry lines (`statuses/chilled.json` exists).
- Finding 7, fixed: playtest return at about 18:00 day 2 with the Warden at his gate; Wat's visit is learnt from Nell.
- Question, answered: pattern 2 (`:69-73`) states the green engage as intended; step 18c checks it. Verified: `village_green` has five exits; `crossroads_inn` south leads to the green.
- Nothing new broken. Nit (no change needed): step 18's result column lists (a), (c), (b) out of order.

Verdict: **APPROVE**.
