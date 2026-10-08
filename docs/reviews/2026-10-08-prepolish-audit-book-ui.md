# Pre-polish audit D: Book UI / presenter / app (loka-v9q)

Base: `main` at `e38af110`. Read-only area audit per the common brief; detached worktree, no code
edits, no Beads writes. Scope: `mobile/app` (App, SaveError, `book/`) against
[Book UI](../system/book-ui.md), [components](../BOOK-UI-COMPONENTS.md) and `docs/design`. Web is
the active target; native is paused.

Governing clauses: [world and status entry](../system/book-ui.md#world-and-status-entry),
[live action freshness](../system/book-ui.md#live-action-freshness),
[minimap/presentation controls](../system/book-ui.md#minimap-map-and-presentation-controls),
[chapters, scenes and recovery](../system/book-ui.md#chapters-scenes-and-recovery),
[shared elapsed status/completion boundary](../system/book-ui.md#shared-elapsed-statuscompletion-boundary),
[D11 character choice](../system/book-ui.md#d11-character-choice-interaction),
[Review stance](../WORKFLOW.md#review-stance).

## Must be true (written before reading the code)

1. Every control comes from the current GameView/ActionSet with its drawn token and context; a
   stale press is refused, redrawn, never substituted or optimistic.
2. Pending/refused/stale/fault results never read as success; pending shows "save not confirmed"
   and any later press retries the original attempt; a fault stays visible with Start over.
3. Save-open failures and press faults expose only the permitted recovery (Start over with
   confirmation); `save_corrupt` → Start over is reachable from both the shell and the Book.
4. Precedence: ancestry picker → scene → combat → chapter title → stack; details hidden under
   scene/combat; Contents is exactly Character, Equipment & Inventory, Map, Journal, Settings.
5. Keyboard movement acts only on World with no scene/combat/pending/catch-up/fault.
6. Labels/roles on every control, 44px targets, section headings; no raw code or TextKey as prose.
7. No presenter-invented game state (fuel, time, journal, benefits); comings/departures and
   detail routing come from confirmed boundaries once.
8. Nothing dead or duplicated that polish would build on.

## Checks run

- `node --test "book/*.test.ts" "*.test.ts"` at base: green (127 tests). `tsc --noEmit` could not
  be completed in the audit worktree (linked `node_modules` lacks skia/reanimated/e2e types);
  errors seen were all missing-module, none in app logic.
- Three throwaway probes over the real `book()` harness (deleted, never committed) confirmed D1,
  D2 and D4 below.

## Findings

| # | Severity | Where | Failure scenario | Fix | Before polish? |
|---|---|---|---|---|---|
| D1 | should-fix | `mobile/app/book/sections.tsx:58-62`, `Book.tsx:177-178` | `choose_ancestry` COMMIT acknowledgement lost → reply `pending`. Picker hides every choice button (`!p.pending && button`) and `Bottom` hides `Status` while `ancestry_choices` is set, so neither "save not confirmed" nor any pressable control exists; the elapsed clock also cancels on `pending` (`App.tsx:110`). Probe: labels `[]`, text only "Saving your choice…". Only a reload or an AppState resume replays the attempt. Violates [recovery](../system/book-ui.md#chapters-scenes-and-recovery) ("a later invocation retries the original attempt") and D11 "pending-save fencing". | small: keep the choice controls pressable while pending (any press resends the retained attempt) and show the pending line, or render `Status` on the picker | yes (polish rebuilds this page) |
| D2 | nit | `mobile/app/book/Book.tsx:203-211`, `:177` | Chapter title page shows "Back to World" and an enabled Contents button beside Continue (probe: labels `Continue, Back to World, Contents…`). "Back to World" clears the whole stack, dropping a restored notice/book route beneath the title that Continue would have revealed ([recovery rule](../system/book-ui.md#notice-board-details) "after the chapter Continue"). | one-liner: treat `chapter` like scene in `navigation`/`Status locked` | can wait for RC |
| D3 | nit | `mobile/app/book/Book.tsx:230-241` | `Fault` puts the fault message inside the "Start over" Pressable; `accessibilityLabel` replaces children, so a screen reader hears only "Start over" and never why (e.g. the save_corrupt message). Spec: "Fault details remain visible with Start over recovery", explicit labels. | one-liner: message `Text` outside the Pressable | yes |
| D4 | nit | `mobile/app/book/words.ts:66` | During catch-up a different press returns `conflict`; `replyLine` pushes "(conflict)" (also "(invalid)", "(unauthorized)") into the World log (probe confirmed). `words.ts` header promises no raw code as an answer. | one-liner: words for the three kinds | can wait for RC |
| D5 | nit | `mobile/app/book/pages.tsx:117-134` | World lists NPCs and loose items in one "X is here." list; [room page rule](../system/book-ui.md#world-and-status-entry) wants present NPCs and loose items as separate paragraphs/lists. Presentation drift only. | small (in polish) | can wait (polish) |
| D6 | nit | `mobile/app/book/Book.tsx:32`, `Footer.tsx:22`; `DreamPage.tsx:32` | Duplicate `small` style literal in two files (polish token move will have to find both); `!dream.available` note is unreachable (`dreamPages` slices an unavailable dream page before render). | one-liner each | can wait (polish) |

No blocker. Freshness, stale redraw, pending/refused routing, combat/scene precedence, keyboard
gating, Contents list, section returns, Start over confirmation and SaveError recovery gating
(`failed.startOver`) match the spec on reading and in the existing tests.

Already tracked, not refiled: tokens/paper duplication and day/night palette (loka-d04);
PageTurn/Turn coexistence and the Settings sound control (BOOK-UI-COMPONENTS#page-turn, polish
wiring, loka-78r); riddle tile width, locked Contents colour, NpcPage/Combat rebuilding `Sheet`
(catalogue "Polish" notes); UI blur (#254).

## Questions

- Q1 `presenter.ts:169,205-211`: a restored pending invocation's terminal completion (no
  `s.retry`) does not bump `generation`, so a button drawn before that confirmation can still
  refresh its token when its context is unchanged. The spec forbids refresh after any confirmed
  player invocation; in practice the action must still be offered, so no wrong result was found.
  Intended?
- Q2 `App.tsx:205`: web shows a blank page while OPFS opens (no loading state). Acceptable
  before polish?

## Verdict

HEALTHY WITH FINDINGS (one should-fix, five nits).
