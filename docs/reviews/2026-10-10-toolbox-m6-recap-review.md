# Item review: toolbox row W27, away recap (loka-kgd.59)

- Local branch `toolbox/m6-recap`, head `eaecb81fcd3e49e6775c471b48407f76b033b6ed` (includes PM commit `eaecb81f`), base `origin/toolbox/batch-m6` `89a277c8`; no PR. Manifest and GameView schema plus `kernel_api` floor change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row W27](../MECHANICS-TOOLBOX.md#ranked-toolbox); [book-ui.md Away recap](../system/book-ui.md#away-recap), [mechanics.md row W27](../system/mechanics.md#away-recap-toolbox-row-w27), [cartridge.md declarations](../system/cartridge.md#away-recap-declarations) (amended in this slice); [label in name](../system/book-ui.md#minimap-map-and-presentation-controls); [Book UI agent rules](../BOOK-UI-COMPONENTS.md#agent-rules-for-book-ui-code).
- Hosted CI on the head: ci and book-e2e success (PM).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, three nits).

## Must be true (written before the diff)

1. The threshold is a cartridge number (real minutes), opt-in, no engine default; floor 1.47 in the TS loader and the Elixir compiler; Chapter 1 and corpus bytes unchanged.
2. A settlement at or over the threshold opens the next World page with one collapsed block of grouped lines with counts; a shorter one shows its lines as before.
3. Nothing is stored; no save, receipt or command change.
4. No World line is lost or duplicated across hold, flush (press during catch-up), settle and clear.
5. The block is an accessible control named per label-in-name.

## Proof

- (1) `recap_after` is authored only in `cartridges/recap_sampler`; no frozen fixture changed (only new `protocol/fixtures/invalid.json` cases). Red controls: TS floor `'1.47'` to `'1.1'` fails `kernel/ts/test/recap_after.test.ts`; Elixir floor `[1, 47]` to `[1, 1]` fails `test/loka/content_recap_test.exs` (`--force`). Elixir builds no GameView, so it has no `recap_after` twin to diverge.
- (3) No change under save, store or receipt code.
- Mutants on `mobile/app/book/recap.ts`, run with `book/recap.test.ts`: accumulate replaced by overwrite fails it; `|| s.retry` removed fails it; count starts at 1 fails it; threshold forced to `>= 0` fails it. **Survivors:** flush removed from `pressedAway` (`recap.ts:44`); the room-change drop removed from `resetLogs` (`logs.ts:97`).
- (5) `Tap` gives role button and the label (`pages.tsx:36-37`); "While you were away, show/hide" puts the shown text first. book-ui.md sets no expanded-state rule, so none is asked for.
- Trial merge with batch head `73abdead` (row 46): nine textual conflicts, all appends at the same anchors (labels, two lint regexes, three docs, three generated files). Resolved by keeping both sides and regenerating with `elixir bin/contracts.exs`; then `contracts.exs --check`, `tsc --noEmit` (mobile), `recap.test.ts`, `presenter.test.ts` and `recap_after.test.ts` all pass. The sync still has to resolve them by hand.
- PM commit `eaecb81f`: `recap: undefined` comes before `...shell`, so a story can still set it. Accepted.
- Claims rerun: the Beads note's "Chapter 1: no field, pins unchanged" holds. Its "red controls on ... flush" does not hold (see B1).

## Findings

- **B1 blocker**, `mobile/app/book/recap.ts:44`; test `mobile/app/book/recap.test.ts:78`. Deleting `if (s.away) s.log.push(...s.away.lines)` leaves the suite green. Scenario: the player presses Look while a three-hour settlement is still catching up. The held tick and arrival lines vanish: they appear in neither the log nor the recap, and no test notices. The only press-during-catch-up test presses Go north, and the room change clears `s.log`, so a flush cannot be observed. Fix: press a same-room action during catch-up and assert that the held lines come first in the World log, in order, before the press's line. The room-change drop at `logs.ts:97` also survives. Its only realistic path is a background move of the player, so test it or state it as untested.
- **S1 should-fix**, cold reopen: `mobile/app/App.tsx:253-255`, `mobile/app/book/updates.ts:31`. `useElapsed` runs before the font gate's `return null`. On native, `useFonts` takes the runtime path (no expo-font plugin), so `loaded` is false on the first render. The effect calls `resume`, and the drain (up to 16 steps per pulse, `mobile/authority/local-story/elapsed.ts` `drain`) emits its state updates before the Book mounts and subscribes. Result: after a cold three-hour reopen in the sampler (about 24 boundaries), the first steps are never seen and `away.from` starts mid-settlement. The block shows wrong counts ("Maud leaves. (4 times)"), or the span falls under the threshold and nothing shows. Child-before-parent effect order helps only when the Book mounts in the same commit. book-ui.md's "Nothing is stored, so a reopen shows none" can be read either way. Either make the clock wait for the Book's subscription, or state in book-ui.md that a cold reopen's recap is best-effort or absent.
- **N1 nit**, `mobile/app/stories/AwayRecap.stories.tsx`: the catalogue row lists states "collapsed; open" but there is only one story (`Collapsed`). Agent rule 5 asks for one story per state.
- **N2 nit**, `mobile/app/book/recap.ts:38`: `s.recap` is not cleared when the room changes without a press (a background move). Scenario: a recap from the hall shows at the top of the next room's page.
- **N3 nit**, `protocol/manifest.schema.json` (`recap_after_minutes` description): "a safety bound keeping the logical-second threshold a safe integer" holds only while `rate` is at most about 1.49e10, and `rate` has no maximum. Reword the claim, or bound it.
- **Question**, `mobile/app/book/presenter.ts:92` `narrate`: with `recap_after` authored, every background receipt goes through `worldLines`. A short settlement then logs one entry per line instead of the one joined entry it logs without the field. book-ui.md says these lines go to the log "as without the field". Intended?
- Accepted limit: lines routed to a detail, a conversation or the combat log are not grouped. Both book-ui.md and mechanics.md document this.
- `/code-review medium` result reported in the Beads note (8 findings, 6 fixed, 2 disposed).

## Re-check, fix round 1 (head `527f053babb0aa1476f20332bb328e58ba0792bd`)

Scope: commits `e88e62cd`, `a0459d31`, `527f053b` only. Hosted ci and book-e2e are green on the head (PM). Verdict: **APPROVE WITH NOTES**.

- **B1 fixed.** The flush mutant (remove `s.log.push(...s.away.log)` in `pressedAway`, `recap.ts:43`) now fails `recap.test.ts`, caught by the new pebble test, which presses in place during catch-up. The room-change mutant (remove `s.away = s.recap = undefined` in `resetLogs`, `logs.ts:98`) fails it too. Keeping `s.recap` on a room change (N2) also fails.
- **S1 fixed.** `updates.ts:34` reports `subscribed(true)` after `subscribe`. Swapping the two fails the new cold-reopen test. `App.tsx` waits by setting `booked = recovered.current.booked || recap_after === undefined`; `resume` returns early while `!booked`, and `onBooked` starts it once. Both mount orders are covered:
  - Fonts not loaded: the Book mounts later, and `onBooked` resumes the clock.
  - Same commit: child effects run first, so `booked` is already true when App's effect runs.
  - Start over: React runs all passive cleanups before all mounts, so the old Book's `subscribed(false)` comes before the new `subscribed(true)`.

  Decision: no seam is needed. The logic is one flag set from two places plus an idempotent guard, and the Book side, which can go wrong (order), is tested.
- **Chapter 1 unchanged.** Without `recap_after`, `booked` starts true, so `resume` runs as before and `onBooked` returns at once. No Chapter 1 cartridge or fixture changed in the fix commits.
- **Short absence.** `away.log` holds the joined entries exactly as the log takes them without the field. Writing the line-by-line form to the log on settle fails the two-minute test, whose expected log comes from the same absence with the field removed.
- **N1 fixed** (an `Open` story). **N3 fixed**: the claim is dropped from `protocol/manifest.schema.json`. **Question** answered by the joined form.
- **N4 nit (new, in touched code)**, `mobile/app/App.tsx` `transition`: while `!booked`, going inactive still calls `pulse('pause')`, which catches up with no subscriber. Scenario: on a cold launch the app is backgrounded in the few milliseconds before fonts load; that settlement's lines are lost. The window is tiny, so no change is asked for.
