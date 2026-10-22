# Review: Retire Ashmere 1, bundle the showcase (PR #423, loka-4hik.1)

- Branch `retire/ashmere-1`, exact commit `74febe2901ec221bbd74640e191f00dbb0671f42`, base `origin/main`.
- Governing: [owner decision: retire Ashmere](../decisions/owner-decision-retire-ashmere-2026-10-21.md), [AGENTS.md pre-production and Distribution](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently), [cartridge.md](../system/cartridge.md), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- **Verdict: CHANGES REQUIRED** (one blocker; the rest of the slice is correct).

## Must be true (written before the diff)

1. The app bundles the showcase through the same import path. Every app-bundle pin switches. Ashmere-explicit checks outside the app are left for phase 2.
2. The save file is keyed by the showcase content hash. A hash change opens a fresh file, not a `pinned_release_missing` refusal.
3. Old saves (Lantern, sampler, Ashmere) are never opened or deleted. Start over replaces only the current file and closes its handle first.
4. Explicit pin refusal and the release guard (`devCartridge` throws outside `__DEV__`) are kept.
5. E2e keeps reload, Start over and steady play, with literal expectations.
6. Browser coverage lost with the deleted e2e files is listed in a follow-up.
7. The docs agree: the decision record, its README line, owner-rules, cartridge.md and AGENTS.md Distribution.

## Checks run

- `chapter.test.ts` and `metro.test.ts`: 7 tests pass.
- Mutant A, release name `slice(0,15)`: killed.
- Mutant B, the remove callback skips `deleteDatabaseSync(NAME)`: **survives**.
- Mutant C, the remove callback deletes `loka-ashmere-missing-child.db`: **survives**.
- `elixir bin/check_docs.exs`: exit 0.
- Hosted `book-e2e` (run 39700262222): green. `tests/showcase.e2e.ts` ran both tests and passed. The walk ran `toolbox_showcase`.
- Hosted `ci`: in progress at review time.
- 1-3, 4, 5 and 7 hold.
  - The release `NAME` is at `mobile/app/App.tsx:47-49`. The remove callback at `:72-77` closes, then deletes `NAME` only.
  - A 64-bit hash-prefix collision is negligible. Its result would be an explicit refusal, not silent loss.
  - The weather enter reactions are scoped to `fell_top`, so the steady-play loop is unaffected.
- The PR body reports the `/code-review medium` result.

## Findings

1. **blocker**, `mobile/app/chapter.test.ts:29-31,73-74`.
   - **The claim:** the PR rewrote the header to claim it catches "opens/deletes an older save for the showcase, including Start over". It also seeded the Ashmere file for that purpose.
   - **The gap:** on a healthy save, `startOver()` takes `newGame` (`mobile/authority/local-story/session.ts:284`; `remove()` is at `:291`) and never reaches `remove()`. So the App.tsx remove callback is never exercised.
   - **Scenario:** a later "clean up the retired Ashmere file" edit to the remove callback silently deletes a player's old save on a corrupt-save Start over, and this suite stays green (mutant C).
   - **Rule:** AGENTS.md says a test passing with its header's break is wrong.
   - **Fix:** add a case that seeds the showcase-named file with non-SQLite bytes, presses `startOver()`, and asserts that:
     - the Lantern, sampler and Ashmere checksums are unchanged;
     - the showcase file now opens with the `toolbox_showcase` pin.

     This kills B and C.
2. **should-fix**, the follow-up `loka-4hik.3` and the decision record's lost-coverage list.
   - **The gap:** the list names three behaviours. The deleted e2e files also held the only browser checks of these generic Book mechanics:
     - a once-only picker not reopening after reload (`character_choice`);
     - the Combat page listing admitted helpers (`c4_pack`);
     - a Buy quote unchanged after reload (`practical_skills`);
     - a corpse Take persisting across reload (`deer`).
   - **Scenario:** a DOM regression in one of these passes hosted CI.
   - **Fix:** list them in `loka-4hik.3`, or name the node test that covers each.
3. **nit**, `mobile/app/chapter.test.ts:129-135`.
   - **The problem:** the exact entity list at Crossroads Inn is a content change detector.
   - **Scenario:** adding an item to the inn fails a save test.
   - **Fix:** the room title already proves that the showcase opened.
4. **nit**, `docs/system/owner-rules.md:38`.
   - **The problem:** "Chapter 1 is a frozen regression fixture until the toolbox showcase covers its play families" now reads against the new retire rule.
   - **Fix:** link the two rules or reword one.
