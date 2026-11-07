# Review: author panel, palette Undo brings back a palette Delete

- PR: #687 `fix/editor-delete-undo-2026-11-06` (loka-wfrgk.92, P1)
- Reviewed commit: `7e0f76cea90f46847a42e84566746657b8aeef35`
- Governing: [cartridge.md Editor write path](../system/cartridge.md) (`/delete`, `GET /journal`, `/undo {id}`, 409 when
  a file changed since), [WORKFLOW review stance](../WORKFLOW.md#review-stance),
  [small should-fix](../WORKFLOW.md#small-should-fix); author-error guards are nits
- Independence: authored none of the slice; detached review worktree at the head
- CI at head (`gh run list --commit 7e0f76cea…`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (1 fixed, 2 open, 4 accepted)
- Verdict: **CHANGES REQUIRED** (one should-fix with a logic change, so a fix round; the rest are nits)

## Must be true (written before the diff)

1. Palette Undo right after a palette Delete restores the file byte for byte through `/undo {id}` of that entry.
2. A refused undo (409) is shown, never silent.
3. Undo targets the right entry: never a Book edit the Book itself would also put back, never a second undo of the same delete.
4. When the newest entry is not a delete, the Book Cmd-Z relay stays as before.
5. Test expectations independent of the code; red control shown.

## Checks that held

- (1, 3, 4) `author.ts:40-47`: `GET /journal` is newest first (`write.ts:266`); `what` is `delete <file>` or
  `delete <section> <key>` (`write.ts:121/:147`) so a root-file row delete is undone too; `/undo` journals
  `undo delete …` (`write.ts:172`) so a second Undo relays to the Book (test step 4). The server's own write
  updates the cache (`write.ts:59`), so a delete makes no `outside` entry behind it.
- (2) `refused` at `author.ts:15` alerts on `!ok`, shared with `drop`.
- (5) `panel.test.ts:592`: expected bytes read from the showcase copy before the delete; the 409 is a routed
  answer, the restore is checked on disk.
- Cites: `author.ts:15/:40/:45`, `App.tsx:291`, `inbook.test.ts:309-316` (Book Cmd-Z) land on the named code.
- Real-Chrome walk on `7bfd6bc42`, not the head: the last commit only merged two identical alerts into
  `refused` (5+/3- in author.ts); the ci job runs `panel.test.ts` in stable Chrome on the head and exercises
  the same Delete, 409, Undo path. No rerun needed.

## Mutants

`bin/mutate_diff.sh origin/main` at head: 5 run, same table as the PR body (App.tsx:291 two red-narrow;
author.ts:16 two SURVIVED, author.ts:45 relay SURVIVED, no Book in the harness). Hand mutants against the
palette Undo test, both red-narrow:

| Mutant | Result |
|---|---|
| author.ts `{ id: last.id }` -> `{ id: last.id + 1 }` | red-narrow |
| author.ts `startsWith('delete ')` -> `startsWith('undo ')` | red-narrow |

## Findings

1. **Should-fix, fix round (logic)**, `tools/author-panel/src/App.tsx:291` with `mobile/app/author/prose_rules.ts:58`
   and `mobile/app/author/inbook.ts:191`. Keyboard Cmd-Z after a palette Delete goes to the Book's `putBack`.
   Scenario: the owner edits a line in the Book (`edits` holds it), palette-deletes a definition, presses Cmd-Z.
   The Book pops the prose edit and `/undo`s it; the journal's newest entry is now `undo edit …`; the palette
   Undo row relays Cmd-Z (`author.ts:44`) and pops the next edit. The deleted file is unreachable from the
   GUI (only git or the in-memory journal has it) and a prose edit is reverted as well. With no prior edit the
   Book says "Nothing of yours to put back." and the palette row still works, so the loss needs one earlier
   Book edit, which the prologue session will have. Fix shape: route keyboard Cmd-Z through the same
   check (in `putBack`, read `/journal` and undo a newest `delete` entry first, or stop relaying Cmd-Z and
   call `undoDelete` from the panel). Beads title says "Undo does not restore it"; the owner's Undo is Cmd-Z.
2. **Nit**, `author.ts:41`: newest-only check. After Delete then any Book edit, outside save or `/change`, the
   palette Undo cannot reach the delete. Deliberate ("Undo the last edit"); the file stays in the journal.
   File in Beads as "journal list / undo an older delete" if the owner wants it.
3. **Nit**, `author.ts:41`: no `r.ok` on the journal fetch. A 403/500 answer is a string, `[last]` takes its
   first character, `.startsWith` throws, the Undo does nothing silently. Local server only.
4. **Nit**, `author.ts:46`: two concurrent Undo calls both read the same delete; the second gets 409 and alerts
   "Changed outside" though the file is back. `palette.tsx:36` closes on the first Enter, so this needs a
   re-opened palette within one round trip.
5. **Nit**, `panel.test.ts:613`: step 4 waits the full 5 s for a file that must not vanish; a shorter settle
   with the same assertion keeps the check.

## Disposition

Finding 1 needs a fix round (logic change, more than the small-should-fix shape). Findings 2-5 are nits:
file 2 in Beads or leave as a known limit; 3-5 at the developer's option in the fix round.

## Fix round at d9985337551461ff6435be97acf0900f66473102

Commits reviewed: `1a814cd3d`, `d99853375` (plus `9595583b5`, the first record). CI on the head:
ci, book-e2e, graph-diff all success (`gh run list --commit`).

| Finding | Disposition |
|---|---|
| 1 keyboard Cmd-Z loses the delete | Fixed. `mobile/app/author/inbook.ts:192` `putBack` reads `/journal` and `/undo`s a newest `delete` entry before popping `edits`; its only caller `onKey` (direct press and the `op:'key'` relay at `inbook.ts:268`) reaches it, so all three Cmd-Z paths meet the check. Test `inbook.test.ts:318` asserts undo ids `[9, 7]` (delete first, then the page edit). |
| 2 newest-only | Accepted nit, in Beads (later write hides an older delete). |
| 3 no `r.ok` | Fixed. `tools/author-panel/src/author.ts:41-43` refuses on `!r.ok` with the body or statusText; `panel.test.ts` routes a 500 and asserts the alert. |
| 4 double Undo false 409 | Fixed. `inbook.ts:33,220` `putting` chains presses so the second reads the journal after the first undo. |
| 5 5 s settle | Accepted nit. |

Hand mutants (fresh detached worktree at the head, `node --test author/inbook.test.ts`):

| Mutant | Result |
|---|---|
| inbook.ts:220 `putting = putting.catch(() => {}).then(putBack)` -> `putBack()` (no serialisation) | red-narrow |
| inbook.ts:197 `{ id: newest.id }` -> `{ id: newest.id + 1 }` | red-narrow |

The PR's `mutate_diff` rows for inbook.ts:195/196/200 are red-narrow; its panel rows were BASELINE-RED in
the developer's worktree and cleared by hand (red-full), matching my first-round runs.

Known limits, already in Beads, not findings here: a second Cmd-Z after a put-back says "nothing to put
back" because the Book page reloads; a failed undo always reads "changed since".

**Verdict: APPROVE.**
