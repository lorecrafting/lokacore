# Review: Builder Room sheet Join, up/down exits on any level (PR #826, loka-hcnlh.85)

- PR #826, branch `builder/85-updown-exits`. Reviewed at `5697e9bc0fd8929e34f69cb1c32d5864cc28050e`.
- Governing: [book-ui.md, Room sheet](../system/book-ui.md) and [in-game-builder-mode §4.4, §4.7](../rnd/in-game-builder-mode-2026-11-19.md) (Room sheet exits; no hidden gestures, loka-wfrgk.123). Parity source: the panel's `linkTo` (`tools/author-panel/src/mapwire.ts:44`) and `AddExit` (`tools/author-panel/src/edit/cards/Room.tsx:121`).
- CI at the head (`gh run list --commit 5697e9bc0…`): ci, book-e2e and graph-diff succeeded.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Join writes the exit and its reverse face (`BACK[dir]`) through the shared `ed.link`, on any level, with no layout cell needed. The panel does the same.
2. An unknown key refuses with `No room <key>`, and nothing is sent. An empty field sends nothing. A taken reverse face refuses and puts the first face back.
3. Exit shapes stay as #806/#807 left them: a short-key `{to}`, `exitsAt`/`exitsOf` for bundled rooms, and `exits` created when absent. Undo restores the files.
4. Only free sides are offered. `run()` and the Move field behave as before.

## Checks run

- `joinTo` (`roomedit.tsx:239-258`) calls only `ed.link(r, dir, b)`. Items 2 (put-back) and 3 come from the unchanged kernel and are tested there:
  - put-back: `kernel/ts/test/author_mapedit.test.ts:124`
  - bundled room: `:594`
  - byte-identical undo: `:623`
- Self-join refuses (`mapedit.ts:83`).
- `field` equals the old Move style (`inRow` = `text` with `paddingHorizontal: 0`), so the look is unchanged.
- `bin/mutate_diff.sh origin/main` (fresh detached worktree): 3 run, red-narrow 3, no TIMEBOX. This matches the handback.
- Hand mutants against `author/roomedit.test.ts`, all red-narrow:
  - `.trim()` dropped
  - `ed.link(…, true)`
  - the draft read from the Move key `r.key`
  - `rooms.find` matching any other room
- The PR body's cites `roomedit.tsx:239`, `:254`, `room.tsx:212` and `roomedit.test.ts:239` resolve.
- book-ui.md sentence: it describes what shipped (the field, one `Join <dir>` per free side, the refusal, empty sends nothing) in the order the sheet mounts it. The words are builder chrome, not player-facing, and are unmarked like the neighbouring `＋ <dir>` and `Move to area`. It is fit for the PM to accept as decided small spec text.

## Findings (all author-side nits; owner rule 2026-11-04)

1. **Nit:** `roomedit.tsx:254`. After a successful Join the typed key stays in the field; the panel clears it on success and keeps it on a refusal (`Room.tsx:131`). A second Join then repeats the old key, which usually refuses because the reverse face is now taken. Nothing wrong is written.
2. **Nit:** `roomedit.tsx:248`. When every side has an exit, the row shows a field with no button. The panel's `AddExit` returns null instead.
3. **Nit:** `roomedit.tsx:241` has no `autoCapitalize="none"`. On native, `Loft` refuses as `No room Loft`. Accepted as the stated follow-up across every field.
4. **Nit:** `contents.tsx:87` and `find.tsx:71` repeat the new `field` style. They could import it.
5. **Question:** §4.4 lists a "target picker" for exits. The panel offers a datalist of room keys; the Book has a bare field. Is a typed key enough for this slice?
