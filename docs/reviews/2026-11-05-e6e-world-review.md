# Review: Editor E6e, World inspector card (PR #651, loka-wfrgk.8)

- PR: [#651](https://github.com/lorecrafting/lokacore/pull/651), branch `editor/e6e-world`
- Reviewed commit: `ae33c5d635042997179356474e0241207f9e8080`
- Governing: [gui-editor design §11 and the E6e row](../rnd/gui-editor-design-2026-11-04.md), [owner editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md) (cards hold no logic, registry gate, generic list only shrinks), [editor chrome rulings §7](../design/editor-chrome-rulings.md), [E6a review](https://github.com/lorecrafting/lokacore/blob/main/docs/reviews/2026-11-05-e6a-room-review.md) (logic in `card.ts`, reuse Generic's form), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit ae33c5d6...`): ci success, book-e2e success.
- `/code-review medium`: reported in the PR body (9 findings, 7 fixed).
- Merge: a trial merge with `origin/main` conflicts after #649 (`registry.json`, `left.tsx`, `right.tsx` and others), and `red_controls.exs` fails its toolbox-page control against main's shrunk baseline. Rebase, and CI must pass on the new head.

## Verdict: CHANGES REQUIRED (rebase onto main, then reuse `CardForm`; no blockers)

## Must be true (written before the diff)

1. Every write goes through `useCard` (`POST /change`, `POST /undo`); no new route; Undo restores the bytes.
2. Card logic lives in `card.ts` with `node:test` cases; `World.tsx` only draws and reuses Generic's form.
3. Reference pickers offer compiled keys and refuse an unknown id at the field, writing nothing.
4. The baseline shrinks by exactly the world paths, and the gate's red control fails on one sent back.
5. Author-only: nothing reaches the player build. Reachable from the Project tab. Nothing invented.

## Checks that held

- Writes: Chrome walk on a world-picker copy of `bleed_sampler` (light and dark). Title edit wrote only `title`; adding `ma` wrote one entry; population `cap` 6 to 5 wrote; Undo on each restored all three files' sha256 byte for byte. A typed `nowhere` in `home` showed "no room nowhere" and wrote nothing. No page errors.
- World opens from the Hierarchy and from the Project tab (`left.tsx`, `App.tsx`).
- Baseline: 177 lines removed (59 paths x 3: cartridge 14, populations 24, transports 12, barriers 7, resources 1, attributes 1). `elixir bin/red_controls.exs`: `ok editor gate: world-card`.
- Author-only: no `mobile/app` source imports `World`, `worldFile` or `rootNames`.
- Schema: every `DefinitionRef` reachable from the world files under a `PICKS` name maps to the right kind (`Policy.with` NPC, water `surface`/`bottom` rooms, death `shrine` room, corpses items, `reverse` transport).
- PR claims rerun: the mutate table (all rows red-narrow) and the 59-path baseline count both held.

## Mutants

`bin/mutate_diff.sh origin/main`: 21 rows, all red-narrow, no TIMEBOX (the PR table says 22 with one NO-TESTS; no difference in substance). Hand mutants against `card.test.ts`, `world_card.test.ts`, `author_shell.test.ts`:
- `POOLS` without `mv`: red.
- `reverse: 'transport'` to `'room'` (`card.ts:169`): survived (nit 1).
- `with` dropped from the NPC list (`card.ts:168`): survived (nit 1).
- attributes blank `{start: 0}` to `{}` (`card.ts:216`): survived (nit 2).

## Findings

1. **Should-fix**: `tools/author-panel/src/edit/cards/World.tsx:117-134` copies Generic's `<Form>` block. Main now has `CardForm` (`Generic.tsx:122`), which already takes `ui` and `context` but fixes `fields={fields}`. Failure: a fix to the generic form (templates, defaults, refusals) misses the World card; this is the E6a pattern finding again. On rebase, give `CardForm` a `fields` prop and render `CardForm` with `picking`.

Nits (Beads, no fix round):
1. `kernel/ts/play/card.ts:168-169`: the `with` and `reverse` rows are untested (survived mutants). Failure: a valid transport `reverse` would be refused as "no room ..." and no test fails.
2. `kernel/ts/test/card.test.ts:301`: `ROOTS.every(... v === 0)` checks the constant itself and passes vacuously on `{}` (a change detector). Pin a row's added entry instead.
3. `kernel/ts/play/card.ts:210-216` (open item 2): adding a default pool (`hp`, `ma`, `mv`) writes zeros over the compiler default (`lib/loka/content/resources.ex`). Walk: adding `ma` wrote `{0,0,0,0}`, so ma max becomes 0 where it was 100. It is author-side, shown on the card and undoable. Prefill pools from the defaults.
4. `tools/author-panel/src/right.tsx:28`: the World selection shows `ref: not in the last good compile` (`e6e-review-light-1-hierarchy`). Failure: the author reads a compile failure that is not there.

## Rulings on open items

- **Book `select` for the World (`shell.ts:85`)**: no finding. `{kind:'cartridge', key:'world'}` matches no text key, so it clears the Book marks, which is right for a world-wide card.
- **Zeros over pool defaults**: Beads nit 3 (owner is sole author; author-side guards are nits).
- **Test overlap (`world_card.test.ts` vs `write.test.ts`)**: keep both. `world_card.test.ts` is the only `/change` and `/undo` test on a root file; `write.test.ts` changes only `rooms/` and `areas/`.
- **Deviation (population, transport and barrier in the World card, not separate cards)**: accepted for this slice. The bead names them, each opens as its own form with room and NPC pickers, and the generic list only shrinks. The bespoke Population card (design §4.3, Map-linked home and area) stays a follow-up bead.

## Outside this slice (pre-existing, not counted)

- `useCard` keeps the undo id in component state, so leaving the card and coming back disables Undo.
- A long card scrolls the whole document rather than the inspector (World card 15,007 px; the NPC card on main does the same).
