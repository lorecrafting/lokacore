# Review: E1 guard refusals and Sedge/Tobin witnesses (batch D) — 2026-10-07

- Scope: local branch `e1/guard-refusals` (not pushed), `git diff cad4e3a3 fa0f1799`; spec commit `efc827e2`. For draft PR #288.
- Reviewed exact head: `fa0f1799`.
- Governing rules: [owner decision, E1 branch evidence](../decisions/owner-decision-e1-branch-evidence-2026-10-07.md) (b); [E1 policy branch evidence](../system/architecture.md#e1-policy-branch-evidence); the PM decision (2026-10-07, reported to the owner) on controlled refusal dispositions, as quoted in the brief; [review stance](../WORKFLOW.md#review-stance).
- **Verdict: CHANGES REQUIRED** (one blocker: a test gap).

## Must be true (written before reading the diff)

1. A refusal row is a disposition. It never adds to the witnessed set, and the spec gives no credit for a guard that stays false.
2. In each cited case, every other admission condition holds, only the named guard is true, and the talk is refused with that guard's code.
3. The recorder fails when a cited case is missing, was accepted, or was refused with another code. The final replayed step is the one that counts.
4. The row-to-case binding is checked by machine.
5. Sedge and Tobin are witnessed under the existing rules. Exactly the 14 claimed paths move.

## Results

- `node --test test/e1*.test.ts`: 48/48 pass. `npm run typecheck`: exit 0.
- `e1_cases.ts`: exit 2, 32 cases, pending 81, witnessed 557, dispositioned 10. Compared with the `cad4e3a3` list (95 pending), exactly the 14 claimed paths left the pending list and none were added. The 10 rows are disjoint from the witnessed set. The 4 Sedge/Tobin paths are in `witnessed_obligations`.
- Isolation probe (leaf values from `holds` just before each refusal): in all 7 cases only the named `quest_state` child is true, and its `any` parent is true. Both Wisp cases have `light_off` = true and `fen_wisp_discovered` = true. `refusal()` (`actions.ts:184-222`) and `talk` (`rule.ts:71-75`) can also return `invalid_state` for missing ancestry, combat or a pending choice. `refuse()` rules out the last two, and ancestry is chosen in every recipe.
- Sedge: the root `fact_compare` is positive and the talk is accepted. Tobin `restart`: an accepted choice after the patrol fails. Both use the existing rules.
- Mutants (throwaway worktree, since removed):
  - `checkRefusals` ignoring the code: the new test fails. Caught.
  - A planted wrong code in the JSON (`not_present`): the recorder exits 1 with `refusal …maud_offer…/items/2`. Caught.
  - A planted accepted step after the peg-active refusal, on clean code: the recorder exits 1 (`null` vs `invalid_state`). Caught.
  - Mutant A (`e1_cases.ts:125`, setting `final` only on a rejection): `e1_obligations` and `e1_cases` tests pass 20/20. Mutant A combined with the planted trailing accepted step: the recorder exits 2 with `failure: null`. **Missed.**

## Findings

- **E1-D1 blocker**, `kernel/ts/test/e1_obligations.test.ts:385`. The "accepted" replay never refuses, so its `final` is null whether or not replay resets `final` on an accepted step. Mutant A survives the suite. The test comment claims to catch "a step other than the case's last one". Failure scenario: a later edit makes `final` sticky, and a recipe gains a trailing step that re-admits the guarded talk. That row stays dispositioned although the case's final step was accepted. Fix: replay a run that refuses and then accepts, and assert `final === null`.
- **E1-D2 should-fix**, `kernel/ts/test/e1_cases.ts:165-167`. `checkRefusals` never reads `path`. A row for `maud_offer/policy/root/item/items/2` that cites `refuse-peg-active` passes both `checkDispositions` and `checkRefusals`; I ran this. The same holds for a peg `items/3` row that cites the active case. The PM decision requires the binding to be checked by machine. Today only the row-to-code link is checked, and the row-to-guard link is not. Cheap fix: `replayCase` also returns the final command's dialogue key, and the check requires `dialogue/<key>/` in the path. The 10 current rows are correct (probe above), so this is not a blocker.
- **E1-D3 should-fix**, `kernel/ts/test/e1_refusals.ts:42,54`. `light_off` is `!illuminated`, and `illuminated` reads only lit sources the player holds (`src/mechanics/light/shared.ts:69-77`). It does not read the clock or the room. So the clock assertion and the "unchanged clock and room keep the dark" comment guard nothing, and the recipe never asserts the dark. Failure scenario: a content change makes the `accept` or `answer` choice light a carried source. The refusal is still `invalid_state` (now with `light_off` false), and the Wisp rows still pass. Fix: assert `light_off` (for example `!illuminated(...)`) just before `refuse`, and correct the comment.
- **E1-D4 should-fix**, `docs/system/architecture.md:369`. The new sentence cites no decision. The only cited record says that a refusal-based PM proposal was "not adopted". AGENTS.md says a new decision adds its record to `docs/decisions/`, and no record of the 2026-10-07 PM decision exists. The spec text itself matches the brief: it is a disposition, grants no credit, and adds the minimum field `refusal: {case, code}`. Failure scenario: a reader or a later reviewer takes this paragraph to contradict the owner record. Fix: add the PM decision record and link it from this sentence.
- **Nit**, `kernel/ts/test/e1_paths.ts:128`. The shared `ferry` helper has 2 callers, and 6 or more inline copies of the same invoke remain (for example `e1_dialogue_circuit.ts:46`, `e1_epilogue_talks.ts:30`). The helper is acceptable. Consolidating the copies is optional.
- **Nit**, `kernel/ts/test/e1_refusals.ts:9`. `state` duplicates the `debt` lookup in `e1_debt.ts:20`. The duplication is harmless.

## Disputed items

- Path-to-dialogue binding: yes, the recorder should check it. See E1-D2.
- Duplicated ferry and quest helpers: these are nits, not blockers (see above).
- `a_wick_offer` and `a_aldric_offer`: out of scope, per the brief.

## Fix round 1 — head `b8a5e845` (commits `e8832ada`, `b8a5e845`)

**Verdict: APPROVE WITH NOTES.** D1 through D4 are closed. One should-fix (E1-D5) is outside this diff and goes to the PM.

- Results:
  - E1 tests: 48/48 pass. Typecheck: exit 0.
  - `e1_cases.ts`: exit 2, 35 cases, pending 76, witnessed 557, dispositioned 15.
  - Against the round-0 run, exactly the 5 new Wick and Aldric paths moved and none were added. The witnessed set is unchanged.
- D1 closed. The test now replays a run that refuses and then accepts, and asserts the result is null (`e1_obligations.test.ts:386`). Re-applying the round-0 mutant (a refusal stays recorded after a later accepted step) turns that test red.
- D2 closed. `checkRefusals` now requires the case's final step to carry the dialogue key from the row's path, `path.split('/')[3]` (`e1_cases.ts:176-182`). A mutant that compares the case's action with itself turns the test red. The spec at `architecture.md:373-374` now says the refusal must come from the dialogue the row's path names.
- D3 closed. The Wisp case asserts `light_off` just before the refusal (`e1_refusals.ts:57`), and the comment is corrected.
- D4 closed. The new record [pm-decision-e1-controlled-refusals](../decisions/pm-decision-e1-controlled-refusals-2026-10-07.md) is linked from the spec and the decisions index. It keeps owner decision (b) and grants no credit.
- The `state` nit was declined. Accepted.
- Wider scope (a), the action key in the E1 host:
  - Production decides a step with the invoked action key (`local-story/invocation.ts:173`), and the host and replay now do the same.
  - Byte identity: in all 32 earlier cases, every step's command, decision, state hash and receipt hash, and every finish digest, are identical to the round-0 run.
  - Every non-elapsed step records an `action_key`.
  - Removing `action_key` breaks replay for exactly `refuse-wick-active`, `refuse-aldric-active` and `refuse-aldric-resolved`. Unkeyed, the Wick command instead opens `b_wick_turn_in`.
- Wider scope (b), the 3 new cases: the leaf probe (values from `holds` just before each refusal) shows each case isolates its guard.
  - Wick active: only `items/0` (active) is true.
  - Aldric active: the `missing_child` conjunct is true, and only bell `items/0` is true.
  - Aldric resolved: the conjunct is true through its resolved branch, and only bell `items/2` is true.
  - The 5 rows match their cases.
- **E1-D5 should-fix (outside this diff; for the PM)**, `kernel/ts/src/runtime/world.ts:119-120`. The ponytail comment says an unkeyed replay of a host trace can differ only when two actions match one Command, and that none does. The Wick and Aldric talks are such a case: unkeyed, a keyed `invalid_state` refusal of `a_wick_offer` re-decides as an accepted `b_wick_turn_in` choice. Failure scenario: a player's refused Wick offer in a production host trace replays as an opened turn-in, so the replayed state diverges. Fix: file a Beads issue to store the action key in the host trace, or correct the comment's claim. This does not block the E1 test slice.

- Follow-up `00e5a8cf` (milestone branch): **APPROVE**. It changes types only: `action?: Key` in `checked`/`AUTHORITY_KERNEL.step`, the two casts dropped, one cast at the invocation read, and a comment joined onto one line; no behaviour change. Size gate exit 0 (`sim.ts` within 515), typecheck exit 0, E1 tests 50/50.
