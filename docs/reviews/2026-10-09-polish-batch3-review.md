# Review: polish batch 3, Page shell, PageFoot and E1 (PR #329)

- PR #329, branch `polish/storybook-b3`, head `26a7ac87`, base main `1076e7b8`. Beads loka-bhb. Full correctness review (the designer reviews the look).
- Governing: [design input batch 3](../briefs/polish/design-input-batch-3-2026-10-09.md) sections 1, 2, 5; [storybook plan](../briefs/polish/storybook-plan-2026-10-08.md) B, E1, F row 3; [book-ui.md Detail-page order](../system/book-ui.md#detail-page-order). Owner G3: 'yes go with the recs'.
- Scope: docs and `mobile/app` UI only; no save, protocol or kernel code (SaveError.tsx is drawing only), so no hosted CI is required.
- Verdict: **CHANGES REQUIRED**.

## Must be true

1. Every page that had a return still has it: the foot holds the local returns nearest first, and offered actions are never in the foot. Nested item: Back to container, then Leave. Map with a room chosen: Back to map, then Back to World.
2. Nothing from the removed page branch of `Bottom.navigation` (Book.tsx) is lost. Footer only on World; no foot on World, scene, chapter, ancestry or combat.
3. Accessibility names and press targets are unchanged, or they follow the book-ui naming rule.
4. E1 fails on a missing story or an unimported export. Each exemption has a reason and is listed for batch 4.

## Proof

- (1, 2) For each `Page` kind (`model.ts:31-44`): contents, character, journal, carrying, settings: Back to World; map: [Back to map,] Back to World; thing: [Back to container,] Leave; npc/dialogue: Leave (close_choice unchanged); board: Back to World; standalone notice: Leave; a board's notice: Back to board (`p.back`); dream: Close; chapter, combat, scene, ancestry: none (no Bottom return before either). The old branch also had nothing for thing, dialogue, dream or chapter. A board's Back to World moved from `back` to `world` (`Book.tsx:144-145`). This is the same because a board is always at the bottom of the stack (it opens only from World and is restored first). `NoticePage` returning null cannot strand a page: `pagesAfter` prunes missing boards and notices (`model.ts:62-67`; PR cite rerun, holds).
- Map probe (throwaway test, deleted): v042, Map, tap "Ferry Landing, current place". Labels: `…, Back to map, Back to World`. After Back to map: `…, Back to World`. Back to World: stack `[]`.
- (3) Tap label `"<title>, look"` and the Control labels are unchanged; the heading role was added inside them.
- (4) PR red control rerun: moving `PageFoot.stories.tsx` out fails both tests, naming the row and `pages.tsx: PageFoot`. The Room-page pin fails once batch 4 adds the story.
- Mutants (`book/*.test.ts`, `*.test.ts`): Board-notice foot `back` to `world`: 7 fail. Footer drawn on pages: 5 fail. **Back to map removed: 0 fail. Back to container and Leave swapped: 0 fail.**
- `npm test` at head: green. The 7 authority failures on the first run came from missing mix deps in the review worktree; after `mix deps.get` they pass.
- PR claim rerun: `bin/check_size.exs` at head exits 0 (the claim was "no violations after 2bf1a1cb").
- e2e rerun at head `26a7ac87` (Combat's wrapper changed after the developer's 2bf1a1cb run): `npm run test:e2e` web, 10 files and 19 tests pass, including deer and c4_pack, which reach Combat. Native: not run (no target).

## Findings

1. **blocker** `mobile/app/book/sections.tsx:208`: no test covers the Map foot's Back to map. Deleting it, or breaking the `selected` state that moved into MapPage (`sections.tsx:201-202`), leaves every suite green. No unit test, story or e2e step names it. Fix: add one book-harness test like the probe above.
2. **blocker** `mobile/app/book/Menu.tsx:172`: nothing pins "nearest first" for a nested item. Swapping it to Leave, Back to container stays green: `PageFoot.stories.tsx` TwoReturns builds its own order, and the priory/polish tests find the buttons by label only. Fix: assert the foot's label order in the existing polish.test nested-item test.
3. **nit** `mobile/app/catalogue.test.ts:14-15`: `SkillDetails` and `ItemDetails` sit above the `// batch 4 empties this list` comment, so a batch-4 developer who empties the list leaves them behind. Move them under it.

## Fix round 1 (head `ef60d4b4`, commits 1c0c8c9b..ef60d4b4)

- Verdict: **APPROVE**.
- 1 fixed: `polish.test.ts:466` pins Back to map, then Back to World, the clear and the empty stack. Mutants: Back to map removed → red; Back to map a no-op → red.
- 2 fixed: `polish.test.ts:38-40` pins Back to container before Leave. Mutant: the two swapped → red.
- 3 fixed: `catalogue.test.ts:14-15` now sit under the batch-4 comment.
- Rows wrapped in one View (LogLines, Contents, Inside, Held, Worn, exit warnings, a board's notices): EntityLine, NoticeLink and the Control press targets and labels are unchanged; only a non-pressable View is added. LogLines returns null when empty. All 7 callers render it as a child, so none depends on an array. Title padding: the fixed title keeps `space.md` below.
- `book/*.test.ts` and `*.test.ts` at head: 150 pass, 0 fail, including the NPC tree-order test. I did not rerun e2e or smoke; I rely on the developer's runs.
