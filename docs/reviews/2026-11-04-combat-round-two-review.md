# Review: Combat round two, PR #596 (loka-kgd.202 a and b)

- PR [#596](https://github.com/lorecrafting/lokacore/pull/596) `combat/round-two` at `1c258ff5b75a02d62e767e02c04e28add32062c7`.
- Governing: [mechanics.md Diku rounds, Condition line](../system/mechanics.md#diku-rounds-loka-kgd197), [owner decision Diku rounds](../decisions/owner-decision-diku-rounds-2026-11-01.md).
- Reviewer: independent; I authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff queued.
- The PR body does not report the developer's `/code-review` result.

**Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. Every line a round receipt tells (strike, tier, volley, condition, dodge, block, shot) is routed to `combat_lines`, in every round, also after a cold reopen.
2. The condition line comes right after the last strike at the round-start `npc_id`; if nothing struck it, after both opportunities; always before any death or closure line.
3. With no foe hp row reached, or a dead foe, there is no condition line.
4. The Book's per-receipt round split (`mobile/app/book/logs.ts` logMark) is unchanged.

## Findings

- **S1, should-fix.** `kernel/ts/src/mechanics/combat/round_flow.ts:300-304`. Only the player-swing branch is pinned. These mutants survive the focused suites (diku, showcase_combat, c4_pack, narration_routing):
  - first strike instead of last (`at === 0 &&` guard);
  - `entity_died` lookup inverted (`=== -> !==`, :300);
  - reduce seed `0 -> 1` (:303).
  
  Failure scenarios:
  - Gil (ally) strikes the boar after the player, and a regression puts the condition between the two strike lines. This contradicts "after the last strike".
  - The boar kills the player and nothing struck it, and the condition lands after `player_died`. This contradicts "before any death".
  
  Fix: add a diku case with an ally strike, and one with a player death and no strike at the foe.
- **N1, nit.** The PR body lacks the `/code-review` result.
- **Question.** A pack's `primary_changed` round puts the condition at the end, for the round-start foe. This predates the PR and matches the spec.

## Probes

- Real showcase tilt-boar fight (openGame, sqliteHost, elapsed pulses), 6 rounds:
  - At the head, every strike, tier, volley and condition line is in `combat_lines`.
  - With `narration.ts` at origin/main, from round 2 on, `player_hit_*`, `npc_hit_*` and `condition_*` are routed to the chronicle. The owner's report is reproduced, and the claim is confirmed.
- Round 6: the boar strikes first and kills the player. The condition comes after the boar's strike and before `player_died`. This is correct.
- Every other combat key is covered by `keys`, pack keys, status binding or the bleed rules: `combat.narration` holds dodge, block, shot_hit/miss and the volley keys, and tiers hold shot_hit.
- `logs.ts` logMark is untouched and splits per receipt.

## Mutation

- `bin/mutate_diff.sh origin/main`: 13 run, red-narrow 9, SURVIVED 4.
  - :300 and :303 survive; see S1.
  - :305 `< -> <=` and `0 -> 1` are equivalent unless `entity_died` is event 0.
- Hand mutants:
  - Drop `swung ||`: 6 diku tests fail. This reproduces the PR's claim.
  - Drop the conditions spread (narration.ts:103): narration_routing fails. This reproduces the PR's claim.
  - Drop the tiers spread (:100-102): it fails.
  - First strike instead of last: survives (S1).
