# Review: world.death.revival and the Wayside Shrine keeper, PR #599 (loka-kgd.206)

- PR [#599](https://github.com/lorecrafting/lokacore/pull/599) `death/wayside-shrine` at `5a104deae4fb947811a01ede07d6379b0db25878`.
- Governing: [mechanics.md death@1, Revival and Waking line](../system/mechanics.md) (:840, :2201), [cartridge.md Revival declarations](../system/cartridge.md) (:1010).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff all success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. `revival {lines, seconds}` is presentation only; the death restore and save bytes do not change.
2. Every revival line resolves in text. The schema bounds lines and seconds, and a malformed block gets a diagnostic, not a crash.
3. The keeper speaks once per player death and never for an NPC death, with lines 1, 2, 3 and then 4 repeating.
4. Per the owner's intent (relayed by the PM), the player wakes first, then the keeper speaks.
5. The re-recorded transcripts change decisions only where the shrine changes them.

## Checks that held

- `{seconds: 10}` with no lines gives `SCHEMA_VIOLATION` at `cartridge.world.death.revival.lines`, not a FunctionClauseError.
- `bin/mutate_diff.sh origin/main`:
  - `view.ts:113` `&&`→`||` is red-narrow here (the PR reported BASELINE-RED).
  - `death.ex:53` is NOT-UNIQUE ×2.
  - A hand mutant at `death.ex:53` (drop `not`) is red: `content_penalty_test` 3/4.
- PR claim rerun: renaming `keeper_tally` so that it sorts before the line rules turns `shrine_keeper` test 1 red (lines 2, 3, 4, 4, 4).
- Transcripts, compared on normalized payloads: only `walk_combat` differs. The death gains `fact_changed keeper_greeted`, and the `down` and `west` moves are inserted. This matches the PR.
- c4_pack_flight and hounds: with seed 4, each still asserts its own job order.
- Focused TS: 48 pass.
- Parity: text keys are checked only by the Elixir compiler, the same as `narration.woke`.

## Findings

1. **Blocker.** The keeper's line comes before `death.woke`.
   - Code: `kernel/ts/src/mechanics/death/lines.ts:33`. The spec, mechanics.md:2201, puts woke last.
   - Book: `arrival()` (`mobile/authority/local-story/combat-receipt.ts:12`) splits the receipt at woke. So the keeper's greeting lands on the fight page in the boar pen, before "You gasp and sit up", and not in the shrine's room log.
   - Test: `shrine_keeper.test.ts:29` (`lines.at(-1) === 'death.woke'`) pins the wrong order.
   - Fix: wake before the `entity_died` reaction lines. This changes the engine and the spec, so it needs a second opinion. The PM can instead split it out and rule.
2. **Should-fix, for the PM or owner.** `cartridges/toolbox_showcase/text.json:1463` still says "When you fall you wake at the inn". This is player prose, so the owner writes it.
3. **Question.** The GameView carries `revival` whenever it is authored (`view.ts:113`), not only after a death. GameView is stateless, so this is defensible, but it needs a PM ruling.
4. **Nit.** The keeper rules have no presence check (`keeper_line_1.json:22`). If the shrine moves (`food.test.ts` sets it to `crossroads_inn`), the keeper speaks from an empty room.
5. **Nit.** The shrine hangs off `shore_steps` (up), while its prose says "stands back from the crossroads". The inn has no free exit, so this is a PM call.

## Verdict

**CHANGES REQUIRED** (finding 1).

## Fix re-check

Reviewed `git diff 5a104deae d8ffe8feb` only. Head `d8ffe8feb184498d3a934b335769b644fa7f1313`.

- **1, fixed.** `proposal.ts` `creditDelivery` sets `wokeAt` at the first delivered player `entity_died`, before its reaction lines. `closing()` in `death/lines.ts` splices the end lines at `wokeAt`. The spec at mechanics.md:848 and :2202 says the same. Tests: `shrine_keeper.test.ts:25` and `service.test.ts:352` (Book `arrival()` slice `[player_died, woke, revived_1]`).
- **2, fixed.** The sign reads "wake at the Wayside Shrine", in the PM's words.
- **4, fixed.** `npc_present keeper` is on `keeper_line_1..4`, tested at `shrine_keeper.test.ts:41`.
- **5, fixed.** The prose says "stands above the shore steps".
- **3:** PM ruling, not reopened.

Proof:
- **Fixtures.** The canonical diff is the four `npc_present` items and the two strings. All 30 transcripts and the 7 story `.sql` files change only the content hash.
- **Size.** The `proposal.ts` allowance goes from 347 to 349, which matches the file's 349 lines: the `wokeAt` field plus one line in `creditDelivery`.
- **Mutants**, each restored afterwards:
  - M1, drop the `wokeAt` line: red in penalty, showcase_combat, shrine_keeper and service.
  - M2, `i <= w` changed to `i < w`: red in penalty.
  - M3, strip `npc_present` from the pinned canonical: red at `shrine_keeper.test.ts:41`.
- **CI** (`gh run list --commit d8ffe8feb`): ci, book-e2e and graph-diff are all success.

**Verdict: APPROVE.**
