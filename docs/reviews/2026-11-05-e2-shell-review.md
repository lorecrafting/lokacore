# Review: Editor E2, the three-column shell (PR #631, loka-wfrgk.10)

- PR: [#631](https://github.com/lorecrafting/lokacore/pull/631), branch `editor/e2-shell`
- Reviewed commit: `664d695c2054c10b065eba8d60fd0716f97cad30`
- Governing: [GUI editor design §11, row E2](../rnd/gui-editor-design-2026-11-04.md), [editor chrome rulings](../design/editor-chrome-rulings.md), the accepted ideas on `br show loka-wfrgk.10`, [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 664d695c2...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: reported in the PR body.
- PM rulings accepted, not raised: the 300 ms prose budget stands, the whole compile is measured, and an over-budget edit shows as over (resident compiler: loka-wfrgk.16). Author-side edge guards are nits.

## Must be true (written before the diff)

1. The shell is author-only. A player build holds none of it.
2. There is no protocol change and no new write route. The SSE message gains only `timings`.
3. The postMessage origin guard holds on both sides of the bridge.
4. The hierarchy, Book, map slot and inspector share one selection.
5. The layout survives a reload, with widths clamped to the ranges in the rulings.
6. Every old panel tab and section still exists.
7. The chrome follows the OS scheme and uses only tokens.
8. Cmd-K, Cmd-E, Cmd-., Cmd-\ and Cmd-/ work, whether pressed in the panel or relayed from the Book frame.
9. Timings are honest: an over-budget edit shows as over.
10. Cmd-K reaches keys, text keys, `~` lines and commands, as the accepted E2 idea requires ("on find.ts and todo.ts").

## Checks that held

- **Old panel coverage:** nothing is lost.
  - Project: title (with the hash in its title attribute) and all six tabs.
  - Console: Compile, Counts, Unconfirmed, Feed and Source.
  - Centre: Hold, the reload badge and the timing.
- **Routes:** no route was added. `/new` and `/open` are existing E1 routes. The SSE message gains only `timings`.
- **Chrome walk** (real Chrome at the head, showcase cartridge):
  - Selection: selecting `crossroads_inn` in the hierarchy marks its Book line, presses its row and fills the inspector.
  - Cmd-K: `~` lists the unwritten title. Enter opens its Book field. The edit then failed: typing "Crossroads Inn" saved `"Crossroads "` (finding 6).
  - Timing: `prose 948 + 85 = 1033 ms`, shown in warning colour.
  - Folding: Cmd-\ folds the left column. Cmd-/ relayed from inside the Book folds the right column.
  - Reload: the rail, the selection and the Book mark all come back.
  - Dark: the OS dark scheme sets `.dark`.
- **Focused tests:** `author_shell` and `author_chrome` 8/8; `inbook` and `prose_rules` 26/26.
- **Origin guard:** the live cross-origin probe did not complete, because the window it opened never loaded the Book. The evidence is the LOCAL mutant below.
- **Hand mutants** (in place of a `mutate_diff` rerun, as the brief allowed; the handback's mutant table ran at `040e5122b`, not at this head; each mutant was reverted after its run):

  | Mutant | Result |
  |---|---|
  | `inbook.ts` LOCAL guard removed | red |
  | `selects` without the trailing `.` | red |
  | `loadOf` off by one | red |
  | `shell.ts:117` duplicate filter removed | survives (see finding 2) |

- **Claims rerun:**
  - "Lists a `~` twice": not backed (finding 2).
  - The origin-guard test: backed (the LOCAL mutant goes red).

## Findings

1. **Blocker, `tools/author-panel/src/App.tsx:201`.** The palette's text rows come only from `diag.text`, the latest SSE prose overlay. That overlay holds only the keys of the last prose push, and a structural compile empties it. Book words are therefore unfindable. In the walk, Cmd-K "signpost" returns no rows, and "Hob" finds only the npc key. This misses must-be-true 10.
   - Fix: feed the text rows from the existing `/find` route.
2. **Should-fix, `kernel/ts/test/author_shell.test.ts:81-98`.** The test checks the duplicate only through `rank('~')`, which drops every non-todo row. With the `shell.ts:117` filter removed, it stays green 6/6, yet any other query lists a `~` key twice.
   - Fix: assert on `items(...)` or on a non-`~` query.
3. **Should-fix, `tools/author-panel/src/right.tsx:41-43`.** The feed colours whole rows `text-primary` or `text-outside`. Rulings §3 asks for a different treatment:
   - a "you" row has no colour, and the word `you` is `dim`;
   - an outside row has a 2 px `outside` bar, and the word `outside` is in `outside` at weight 600.
4. **Nits (Beads):**
   - `App.tsx:180`: Cmd-E sends the bare key (existing `/open` semantics).
   - `App.tsx:198`: an out-of-order `/story` reply can win. The next compile heals it.
   - `inbook.ts:246`: the guard accepts any loopback port and does not check `e.source === parent`. New in E2: any loopback page holding a window reference can post `edit` with any key. For a key not on the page, that opens the owner's editor through `/open` from the Book's own origin, so the Origin check passes. Loopback is the stated trust boundary, so it stays a nit.
   - `shell.ts:57`: `load()` does not validate `tab` or the booleans (author edge).
   - `App.tsx:231`: Hold runs through a DOM `click()`.
5. **103 NO-TESTS rows: not a blocker.** No panel component harness exists, the `.tsx` cards hold no logic beyond the tested `shell.ts`, and the walk covers them.
6. **Should-fix, cause not isolated: a space closes the Book field.** In the walk, a field opened from Cmd-K closed on the first space and saved the words typed so far: "ab c" saved `"ab "`, and "Crossroads Inn" saved `"Crossroads "`. The field's keydown handles only Escape and Enter, but two E2 changes sit on this path:
   - the new `edit` message opens the field (`inbook.ts:249`);
   - `reapply` now toggles `data-loka-selected` on lines.

   This was not tested on main.
   - Fix round: reproduce on main with a double-click and "ab c". If only the palette-opened field closes, it belongs to E2 and gets fixed here. Otherwise file it as a Beads bug against E5.

## Verdict

CHANGES REQUIRED: finding 1. Findings 2, 3 and 6 go in the same fix round. The nits go to Beads.
