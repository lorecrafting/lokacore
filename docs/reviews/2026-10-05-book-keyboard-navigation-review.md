# Book keyboard navigation review — 2026-10-05

PR #200, reviewed commit `f80ac75d6f63eade2859dd5e57476f019a0a7621`.

Verdict: **CHANGES REQUIRED**.

## Requirements derived before the diff

From [Book UI, Minimap, Map and presentation controls](../system/book-ui.md#minimap-map-and-presentation-controls) and the [owner decision](../decisions/owner-decision-book-keyboard-navigation-2026-10-05.md): unmodified arrow keys select compass exits, Page Up/Down select vertical exits, and only offered exits act through the footer's captured action/refusal path. Missing exits do nothing. Keys are inactive away from World and during scene, combat, pending save, catch-up or fault; editable controls and dialogs retain their keys. Handled keys prevent page scrolling.

## Findings

- **R200-1 — blocker — `mobile/app/book/keyboard.test.ts:52`:** The fake target's `closest()` ignores the selector. Removing `input, textarea, select` from `Footer.tsx:71` leaves the focused test green, although an arrow in a real input would now walk and prevent cursor movement. Use a selector-aware DOM target or a real input event so the claimed editable-control break makes the test fail.
- **R200-2 — blocker — `mobile/app/book/Book.tsx:213`:** The World eligibility gate has no effective test. Replacing `keyboardEnabled={!pending && !fault && !p.screen.catchingUp}` with `keyboardEnabled={true}` leaves the keyboard and Book polish tests green. In a pending-save World with a north exit, Arrow Up would invoke an action and interfere with the pending retry. Exercise a mounted Book footer in a pending-save state so this break fails.

Production mapping, unavailable-exit refusal, no-exit handling and the current gate match the cited spec on inspection. A Page Up-to-north mutation failed the focused keyboard test as expected. The focused keyboard test passes on the restored head; the full app suite passes (386 passed, 1 skipped). The two mutants above stayed green and were restored without committing code changes. Ponytail Review: lean production diff; no simpler equivalent found.
