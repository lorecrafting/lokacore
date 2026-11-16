# Review: Editor E2 shell, fix round and owner walk (PR #631, loka-wfrgk.10)

- PR: [#631](https://github.com/lorecrafting/lokacore/pull/631), branch `editor/e2-shell`
- Reviewed commit: `9803cfc79bd40df0ece34b7089fae00245ebd51f` (fix round after the [first record](2026-11-05-e2-shell-review.md))
- Governing: [authoring editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md), [GUI editor design §11, row E2](../rnd/gui-editor-design-2026-11-04.md), [editor chrome rulings §3, §5](../design/editor-chrome-rulings.md), [prose in the Book rulings](../design/prose-in-the-book-rulings.md) (E5), `br show loka-wfrgk.10`, [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice and none of the first record.
- CI at reviewed head (`gh run list --commit 9803cfc79...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.

## Must be true (written before the diff)

1. Cmd-K text rows come from `/find`; a slower reply to an older query is dropped.
2. The space fix is in the shared `inbook.ts`; its test is red without it.
3. The duplicate-`~` test is red when the `items` filter is removed.
4. The feed follows rulings §3: a `you` row uncoloured with a dim `you`; an outside row with a 2 px `outside` bar and a semibold `outside`.
5. No regression: the origin guard holds, no new route, no raw hex, no protocol change.

## Dispositions of the first record's findings

| # | Finding | Disposition | Proof |
|---|---|---|---|
| 1 | Palette text rows only from SSE `text` | Fixed: `palette.tsx:9-13` `useFound` calls `/find`, `shell.ts` `words()` keeps text.json hits | Live: Cmd-K "lectern" lists text rows (titles, descriptions, narration) under the two action keys; "church" lists the room, the reaction, the `~` and text rows. Mutants red: `text.json:` guard removed; trailing-comma strip removed |
| 2 | Duplicate-`~` test green without the filter | Fixed | Mutant red: `shell.ts` `!(key in todo)` filter removed |
| 3 | Feed rows coloured whole | Fixed: `right.tsx` | Live computed style: `you` row border transparent, `you` `rgb(92,89,82)` weight 400 (`chrome.light.dim`); outside row border `rgb(122,59,176)` (`chrome.light.outside`), `outside` weight 600 |
| 4 | Nits | Filed loka-wfrgk.21, loka-wfrgk.22 | Accepted |
| 5 | 103 NO-TESTS rows | Accepted | See mutants |
| 6 | A space closes the field | Fixed: `inbook.ts` cancels the field's space keyup (cause: RN-web Pressable button) | Test red with the keyup listener removed and with `' '` swapped for `'x'`. Live: a 43-character line with spaces, commas and an apostrophe stays open and saves |

## Mutants at this head

- `bin/mutate_diff.sh origin/main` (25 minutes, no timebox rows): 173 mutants, 55 red-narrow, 1 red timeout, 10 SURVIVED, 106 NO-TESTS, 1 NOT-UNIQUE. Consistent with the PR's table at `040e5122b`.
  - SURVIVED: nine in `prose_rules.ts:95-110`, the CSS numbers and `paper()` moved unchanged from `inbook.ts` (accepted in the first round); `shell.ts:170` `>=` → `>`, equivalent (at equal times both give 0).
  - NO-TESTS: the panel `.tsx` components and hooks (no harness; the walk below covers them) and five rows in `kernel/ts/play/author.ts` (the timings on the stream).
- Hand mutants, each red against the file that imports it, tree restored after each:

  | Mutant | Result |
  |---|---|
  | `shell.ts` `items` duplicate filter removed | red (author_shell) |
  | `shell.ts` `words` `text.json:` guard removed | red (author_shell) |
  | `shell.ts` `words` trailing-comma strip removed | red (author_shell) |
  | `inbook.ts` field keyup listener removed | red (inbook) |
  | `inbook.ts` space key swapped for `x` | red (inbook) |

- Claims rerun: "Cmd-K finds Book words" backed (live and by test); "red on main's inbook.ts" backed (listener mutant).

## Owner walk (real Chrome, showcase cartridge with one planted `~` title)

1. Shell opens; three columns, Book strip at 0.75, phone/tablet toggle, reload badge, timing, Hold.
2. Selecting `church` fills the inspector; "Play from church" sends the Book there with one `[data-loka-selected]` mark.
3. Cmd-K "church" → `~ room.church.title`; the field opens in the Book; typing a line with spaces, commas and an apostrophe keeps it open; Enter saves; the feed shows the `you` row.
4. Palette Undo: the title is `~` again, feed "put back text.json:1484"; a second Cmd-Z: "Nothing of yours to put back."
5. Hold: "Held · 0 waiting".
6. Cmd-\ folds the left column (rail present); Shift+Right on the right divider: 296.
7. Reload: left stays folded, right 296, selection `church`.
8. Dark: loaded under `prefers-color-scheme: dark`, `.dark` is set and the chrome renders `rgb(31,32,35)` (`chrome.dark.bg`); the Book strip keeps its own paper (rulings §5). The palette is dark too.

Origin guard (`inbook.ts:246`, `panel.tsx`): a page on the LAN address framing the Book posted `hello`, `edit`, `select` and `key`: no field, no mark, no reply. Holds. A loopback page on another port is accepted by the regex (filed nit, first record); not exercisable live because the Book's single-instance lock refuses a second tab.

## Findings

No blocker. No should-fix. Friction, ranked by cost to the owner (the owner is the sole author, so author-side guards are Beads nits):

1. **Nit (Beads, E5, on main), `mobile/app/author/inbook.ts:119-120`.** A `~` field opens with the caret after the `~` (`selectAllChildren` then `collapseToEnd`). Cmd-K → `~` → type → Enter saved `"~St Wenna's Church, cold and dim, under rain"`: the Book title shows a stray `~`, and the line leaves Still to write (`kernel/ts/play/todo.ts:57` counts only a bare `~`; probed live: `/story` lists the bare title and drops the leading-`~` one), so nothing flags it. (The inspector showed `~ 1` for a while after the save against the Book's `~ 0 here · 0 in cartridge`: a stale `/story`, loka-wfrgk.22.) Every `~` filled through the palette needs a Backspace first. Fix: when the words are exactly `~`, leave them selected so typing replaces them; still "`~` as written" until the first keystroke.
2. **Nit (Beads), `tools/author-panel/src/App.tsx:231`.** A `~` row for a line not on the page opens the owner's editor through `/open` (E5 "Past this page"). In the shell the hierarchy's "Play from" exists; the palette could offer it before the editor. Cost: one VS Code switch per `~` elsewhere.
3. **Noted, `tools/author-panel/src/centre.tsx:17`, `shell.ts:162`.** A one-line edit showed `prose 1807 + 107 = 1914 ms` in warning colour (the whole compile against the 300 ms budget; PM ruling, loka-wfrgk.16).
4. **Nit, `tools/author-panel/src/palette.tsx:13`.** `/find` runs on every keystroke; the `live` guard keeps the result correct, so this is load only.
5. **Nit, `kernel/ts/play/author.ts:75,111,148,186`.** Five NO-TESTS rows in the kernel's author server (stream timings); `author.test.ts` does not reach them.

## Verdict

APPROVE WITH NOTES. Findings 1 and 2 to Beads (E5 and the palette); 3 is a standing PM ruling; 4 and 5 are nits.
