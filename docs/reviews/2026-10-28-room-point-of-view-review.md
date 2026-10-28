# Review: room point of view, arrival and flight lines (loka-glj8, PR #477)

- Branch `toolbox/room-point-of-view`, reviewed head `9026f8e548a6d1efa9aea468ca6ff971d3c35048`.
- Governing: [owner decision 2026-10-24](../decisions/owner-decision-room-point-of-view-2026-10-24.md), [book-ui.md Line placement and Combat closure](../system/book-ui.md), [interaction-patterns.md "Each room speaks from its own point of view"](../design/interaction-patterns.md), PM rulings in the loka-glj8 brief, AGENTS.md "Writing tests", [WORKFLOW review stance](../WORKFLOW.md).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **CHANGES REQUIRED** (two should-fix items to fix now).

## Must be true (written before reading the diff)

1. A move opens the reached room's log with "You arrive from the <dir>.", where <dir> is the reached room's own visible exit back to the origin; no such exit gives "You arrive."; up and down read "from below" and "from above".
2. A flight leaves "You flee north." in the fight room's log; the reached room opens with "You run in from the <dir>.".
3. A death, in a fight or not, leaves "You fall." in the room where it happened; the recovery room's log opens with "You wake at the inn." (PM ruling).
4. Third-person forms exist for every new line; the terminal client and Storybook use the same words.
5. The ended Combat page keeps every line of the closing receipt (book-ui Closure).
6. Conformance fixtures change only in narration, with a dated IMPORT.md amendment if they are re-frozen.
7. No save, hash or schema change; old receipts with `{direction}` still read.

1, 2, 4, 5, 6 and 7 hold. Conformance projects only `text_key` and participants, so no re-freeze or amendment is needed (portable_abi and lantern_proof pass). 3 does not hold (finding 1). A relocation breaks 1 (finding 2).

## Findings

1. **Should-fix, fix now.** `mobile/authority/local-story/narration.ts:47` (`combat_lines.length &&` gate) and `combat-receipt.ts:10-13`. A death outside a fight (for example, bleed) sets no arrival, so the old room's lines stay in the recovery room's log. That breaks PM ruling 3. The third `cut(...)` case in `narration_routing.test.ts` pins the rejected behaviour as `[undefined, undefined]`. The developer's mutant 24 is roughly this fix, and that test killed it. Fix: let the woke key set the arrival without `combat_lines`, then flip that expectation. Also check the press path in `received.ts`, where `place(s, said, …)` takes `routed[0]` uncut. Trade-off for the PM: once the line is cut, "You fall." stays visible only in the live-region announcement. The old room's log is cleared and there is no closure page.
2. **Should-fix, fix now.** `kernel/ts/src/mechanics/movement/sequence.ts:81`. On an arrest after a move, `from` is computed for `there` (market_row), but the body ends in the cell. Probe at the `showcase_economy.test.ts:343` step: `narration[0] = {key:"movement.moved", bindings:{from:"south"}}`, so the cell's log opens with "You arrive from the south.". That line names an exit of a room the player never stayed in. This is a regression from this PR: the old "You go north." was true wherever the body ended. Content that reaches it: the `toolbox_showcase` and `trial_sampler` guards. Fix (behaviour, not new wording): give no `from` when the body does not end in `there`.
3. **Follow-up (question on reachability).** `mobile/app/book/received.ts:121`, where `routed[1]` goes to combatLog. My probe shows that after a flight into another fight, the new fight's page shows "You flee north.". The room log correctly opens at "You run in from the south.". The combat_flow "another fight" test filters only on 'south', so nothing pins this. `routeProgress` engages only when the move is ordinary, so it may be unreachable in shipped content.
4. **No finding.** `presenter.ts:102`: run-in on the ended Combat page conforms to the Closure clause ("every line of the closing receipt, whatever its key"). Drop that follow-up.
5. **Nit.** `received.ts:119-120`: the comment says the room log takes lines "up to a room change only", but the code pushes the lines from the arrival on.
6. **Nit.** PR body mutant table: it claims "all 25 red" but lists 23 rows. #13 and #19 are absent, yet row 15 says "same as 13". The listed run does not back the claim.
7. **Accepted deferral.** The NPC directional lines: `entity_entered_room` carries no direction, and both docs mark them as a target.

## Evidence

- The focused kernel tests pass, exit 0: barriers, hidden_passage, play_recipes, play, play_gate, portable_abi, lantern_proof, showcase_economy.
- The focused mobile tests pass, exit 0: combat_flow, combat, item_detail, polish, recap, presenter, narration_routing, smoke, status.
- Mutants (bin/mutate.sh), all four red-narrow:
  - FROM below/above swapped;
  - `slice(last.arrival - 1)` in logs.ts;
  - the line_words form order swapped;
  - `roomIds[...] === here` dropped in sequence.ts.
- Cites rerun and matching: combat-receipt.ts:10, received.ts:121, logs.ts:238, presenter.ts:109, sequence.ts:89.
- The PR body reports the `/code-review medium` result.
- The Storybook fixtures differ only in narration bindings (`{"direction":"west"}` to `{"from":"east"}`).
