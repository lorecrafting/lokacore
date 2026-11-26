# Review: Map edits on full-ref exits (PR #806, loka-hcnlh.74)

- PR #806, branch `fix/mapedit-object-exits`. Reviewed at `e0f44ee3dc17ff9bd88d8bfd0ea26bee11955369`.
- Governing: editor-map-and-story-rulings.md "Left to E3b", gui-editor-design §3 (cited in the `mapedit.ts` header).
- Why a record: shared kernel/ts/play code (PM brief).
- CI at the head (`gh run list --commit e0f44ee3d…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Every read of a source exit's `to` in `mapedit.ts` accepts both shapes: a short key and a full ref `{cartridge_id, cartridge_version, kind, key}`.
2. Delete removes the far face whatever shape either face uses. One-way and Barrier find the far room from a full ref.
3. No write turns an existing full ref into a short key. A new face may be short, because the compiler expands short refs.
4. The new test goes red when the fix is reverted, and undo stays byte-identical.

## Checks run (detached worktree at the head; no servers)

- `npm run test:files -- test/author_mapedit.test.ts`: 24 pass.
- `bin/mutate_diff.sh origin/main`: red-narrow 4/4 (`:47`, `:92`, `:104`, `:122`). This matches the handback's 4/4, which was run at 80334756f.
- Red control: with `mapedit.ts` set back to origin/main, the new test fails (`Error: [object Object] is not on the map`) and the other 23 pass. Confirmed.
- Hand mutant: `:92` changed back to `doc.exits?.[back(dir)]?.to === a.key`. The new test fails (AssertionError on e's keys).
- Shape: Delete only deletes. Barrier writes the sub-path `exits.<dir>.barrier`, so `to` keeps its shape. Only One-way's draw-back (`:103`) writes a new face, and that face is short (Finding 1).
- Claims rerun:
  - "An exit can only point into its own cartridge": backed. `lib/loka/content/exits.ex:21` checks `to` with `reference/6`, and `refs.ex` `resolve/4` requires a matching id and version, else UNRESOLVED_REFERENCE.
  - "mobile `author/` reads of `.to` are compiled": backed. `mobile/app/author/build/room.tsx:164` reads `r.exits` of a compiled MapRoom (`e.dir`).
- Other source readers: `tools/author-panel/src/edit/cards/Room.tsx:102` already handles both shapes. drop/generic/outlineedit/keys/mapwire/shell/author.ts do not read `exits`.
- Size allowance 540 → 561: agreed. The ceiling is 750 (1.5 × 500), and the one-scaffold reason still holds because the undo test needs the shared state.

## Findings

1. **Nit**, `kernel/ts/play/mapedit.ts:103`: when One-way draws the far face back next to a full-ref near face, it writes a short `{to: a.key}`, so that pair mixes shapes. Short refs are expanded at load (`exits.ex:15`; not compiled here), and Link (`:79`) already writes short keys. Accepted.
2. **Nit**, `mapedit.ts:99,:119`: a full-ref `barrier` prints `[object Object]` in two refusals. `:100`: an exit with no `to` gives "undefined is not on the map". Both deferred by the developer, and that is agreed under the owner rule that author-side edge cases are nits.
3. **Nit**, `mapedit.ts:47`: `toKey` ignores `cartridge_id`, so a foreign ref would match a local room with the same key. Such a source cannot compile (`exits.ex:21`), so this is author error only. Accepted.

Out of scope: area-bundle exits (`mapedit.ts:51`), filed as loka-hcnlh.77.
