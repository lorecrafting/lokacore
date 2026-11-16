# Review: editor drag a template into a room (loka-wfrgk.13)

- PR: #663 `editor/drag-template` (builds on #659 `bin/loka new --extends`)
- Reviewed commit: `dcdf22652e870dbd3351557df0c6754a4af389a6`
- Governing: [cartridge.md#author-preview](../system/cartridge.md#author-preview) (`/new`, Host/Origin guard),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance),
  [editor chrome rulings](../design/editor-chrome-rulings.md) (:131 `~` placeholder mark, :162 every control reachable by Tab)
- Independence: authored none of the slice; detached worktrees for mutants and an own author stack on ports
  19108/19109, real Chrome (browser-use)
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED** (two should-fixes; one is a logic change, so a fix round)

## Must be true (written before the diff)

1. `extends` is validated like `area`: no option injection, no traversal.
2. `GET /templates` reads only inside the cartridge (no symlink escape) and sits behind the Host/Origin guard.
3. The child lands in the room it was dropped on, with `extends` set; it compiles with the parent's fields.
4. One undo removes everything the drop created; a refused drop writes nothing.
5. The drop respects the map lock; the spec route list names the new route.

## Checks that held

- `extends`: `named()` regex plus `execFile` (no shell); `{extends:'--cwd'}` is 400 (write.test.ts).
- Live: `Host: evil.example` on `/templates` is 403. A symlinked `npcs/evil.json` and a symlinked area folder,
  both abstract, were not listed.
- Live drop of `wild` on `smithy` wrote `npcs/wild_1.json` (`extends: wild`, `room: smithy`). The compiled
  artifact has `npc/wild_1` with `wild`'s hp, attack and room smithy. One palette undo removed it.
- `corpse` on area room `green` wrote `areas/yard/items/corpse_1.json` with `location.room: green`. Undo restored
  the file list.
- Refused drop (`goat` from area barn onto yard room `green`): footer shows the `mix loka.new` refusal, and the
  file list is unchanged.
- Dark mode: the chips are legible.
- mutate_diff: 33 mutants, 29 run; every write.ts row and `freeKey` red-narrow. SURVIVED: areamap.tsx:174/177/178.
  NO-TESTS: maptemplates.tsx (the accepted .tsx rows, harness loka-wfrgk.41). The handback's table differs only in
  labels. areamap.tsx:178 (the dropped-on room lookup) was verified live above.
- Hand mutants: dropping `extends` from `made` is red; dropping `...templates` from `freeKey` is red.

## Findings

1. **should-fix** `tools/author-panel/src/maptemplates.tsx:31`: the chips are a `<span draggable>` with no
   tabIndex or role (the AX tree shows StaticText), and the palette's map-npc/map-item (`mapwire.ts:40`) pass no
   extends. A keyboard-only author cannot make a template child at all, which breaks chrome rulings :162.
   Accessibility is not an author-side guard.
2. **should-fix** `kernel/ts/play/write.ts:177`: no test covers the symlink skip at the trust boundary; deleting
   the line keeps author_mapedit and write.test green. Scenario: a refactor drops it, and a linked abstract file
   outside the tree is read and listed.
3. nit `maptemplates.tsx:26`: the `~` strip label reuses the placeholder mark (rulings :131), and a screen
   reader reads it as "tilde".
4. nit `docs/system/cartridge.md:950`: says `GET /templates` lists the abstract sources but does not mention
   that templates inside area bundles are left out.
5. nit (author-side): the footer shows the raw `** (Mix) mix loka.new:` prefix; `freeKey` cannot see a key that
   only an uncompiled file holds.

## Deviations and open items

- Chips on the map strip, not the Hierarchy: accepted (left.tsx belongs to another slice).
- `GET /templates` added: accepted, because the compile drops abstract definitions.
- Bundle templates not listed: accepted, with nit 4.
- Chips not keyboard-reachable: finding 1. The raw Mix prefix: nit 5. No extends on map-npc/map-item: part of finding 1.
