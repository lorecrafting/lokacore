# Review: Editor E6a, Room inspector card and the Book's add-here (PR #649, loka-wfrgk.3)

- PR: [#649](https://github.com/lorecrafting/lokacore/pull/649), branch `editor/e6a-room`
- Reviewed commit: `480b71603197d880c086b92d6c17e78223e23d61`
- Governing: [gui-editor design §11 and the E6a row](../rnd/gui-editor-design-2026-11-04.md), [owner editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md) (edit where it shows, no modes, cards hold no logic), [editor chrome rulings §7](../design/editor-chrome-rulings.md), [E4b review, items carried to E6](2026-11-05-e4b-generic-card-review.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 480b7160...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body, six open items ruled below.

## Verdict: CHANGES REQUIRED (rebase; two should-fixes before E6b-E6d copy the pattern)

## Must be true (written before the diff)

1. Every write goes through E4a `useCard` (`POST /change`, `POST /undo`); no new route or write path; Undo restores the file byte for byte.
2. Hold and refusals show at the field; a refused draft writes nothing.
3. An added mechanic is written at its least valid value; new words are `~` only (agents write no prose).
4. The generic baseline shrinks by exactly the `rooms.*` paths, and the gate's red control fails on a room path sent back to the generic card.
5. Add-here is author-only: the player build carries none of it, and `inbook.ts` keeps its origin guard.

## Checks that held

- Writes: card add, remove and form edits post only `/change`; Undo posts `/undo`. Walk: add `dark`, Undo, file byte-identical (dark scheme).
- `minimal` (`kernel/ts/play/card.ts:200-223`): `sanctuary` wrote `true`, `dark_description` wrote `{"prose":"~"}`. This resolves E4b item 5 for rooms.
- Baseline: 51 lines removed (17 `rooms.*` paths x 3), none left. `elixir bin/red_controls.exs` exits 0 with `ok editor gate: room-card`.
- Author-only: `panel.tsx:37` loads `inbook.ts` only when `EXPO_PUBLIC_LOKA_DEV_CARTRIDGE` is `1`; `metro.config.js` throws on a production build with it set. The `LOCAL` origin guard is kept (`inbook.ts:265`).
- Focused tests pass: `test/card.test.ts` and `author/inbook.test.ts`.
- PR claims rerun: (a) the `card.ts:202-222` and `inbook.ts:245,267` rows are red-narrow: held. (b) "16 NO-TESTS rows": the run shows 17 (nit 5).

## Mutants

`bin/mutate_diff.sh origin/main` gave 45 rows: 28 red-narrow, 17 NO-TESTS (panel `.tsx`, which has no runner), 0 survived, no TIMEBOX. Three hand mutants were all red:
- `minimal` returns `0` in place of `minimum`.
- `required` is replaced by `Object.keys(props)`.
- `asked = true` at `inbook.ts:256`.

## Findings

1. **Should-fix**: `tools/author-panel/src/App.tsx` conflicts with `origin/main`, where #646 added `story` and the palette's story items to `useWiring`. Failure: the PR cannot merge as it stands. Rebase it, and CI must pass on the new head.
2. **Should-fix (pattern)**: logic sits in the React file, `tools/author-panel/src/edit/cards/Room.tsx`. It covers `add` (the present-field guard, the least value and reveal-only; `:53-60`), `remove` (`:111-114`) and the room check for add-here (`:64`). These are 17 NO-TESTS rows, and the owner plan says cards hold no logic. Failure: E6b-E6d copy the file, and a regression in any of these (for example, `add` overwriting a present field) passes CI. Move them to `card.ts` as plain functions with `node:test` cases. In the same change, have `RoomForm` (`:134-168`) reuse Generic's form block in place of copying it (open item 5).
3. **Should-fix**: on a room with `details`, the card is wider than the inspector. At 1600 px the exit edit buttons and Remove sit off-screen (`e6a-review-light-1-select.png`; the dark run scrolled the page sideways to click them). The cause is unstyled rjsf output (E4b item 4, still open). Failure: the author cannot see this slice's exit edits without scrolling sideways. Constrain the card to the panel width (`min-w-0` / `overflow-wrap`).
4. **Tracked (Beads, designer batch)**: `book-ui.md` "Author mode (dev only)" is not amended for the add-here note. The note covers the description's first line and runs past the page edge (`e6a-review-*-3-add-here.png`).
5. **Nit (open item 1)**, `Room.tsx:111`: after Remove, the field stays revealed, so the Add menu omits it until remount. It can be re-added through the form checkbox (walked).
6. **Nit (open items 2 and 3)**, `inbook.ts:256` and `Room.tsx:61`: the menu arms on any click outside the note. The stale-list case did not reproduce: after a Book click and a hierarchy select of `chest`, the note was empty.
7. **Nit (open item 4)**, `Room.tsx:97`: with the map closed, an exit button does nothing and says nothing. With the map shown, a refusal appears only in the map footer (`wooden_door needs both faces`), not at the card.
8. **Nit (open item 6)**, `Room.tsx:59`: add offers capability-gated fields. Picking `dark_description` writes it, and the world goes `not compiled` (`light` not locked) until it is removed. The diagnostic does show at the field. A pick with no least value only reveals the field (accepted).
9. **Nit**: the PR body says 16 NO-TESTS rows; the run shows 17.

Deviations accepted:
- No NPC or item files through `/new` here. The owner plan generates menus from the registry. Carry "NPC here / item here" (rnd doc) to E6b in Beads.
- The `.loka-note` background holds the rulings' dim-on-card contrast (4.91).

E4b carried items: item 5 is resolved for rooms. Items 2 (the top `Errors` list) and 4 (unstyled rjsf) are still open in the walk shots; they carry to E6b-E6d.

Walk: real Chrome, light and dark, world copy of `barrier_sampler` (deleted afterwards). Screenshots `e6a-review-{light,dark}-*.png` are in the session scratchpad.
