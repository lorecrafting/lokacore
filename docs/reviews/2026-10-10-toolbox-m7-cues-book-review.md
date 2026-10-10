# Review: toolbox row G6 Book half, sense cues on the World page (loka-kgd.65, batch M7)

- Branch `toolbox/m7-cues-book`, head `63441602b68fbe5cbbcb86720204964601f0fe40`, base `origin/toolbox/batch-m7` `00a305cd`. No PR; handoff in Beads `loka-kgd.65`. Record kept at PM request.
- Governing: [book-ui.md Sense cues details](../system/book-ui.md#sense-cues-details); [mechanics.md sense cues, Reader 1 and Book](../system/mechanics.md#sense-cues-sound-smell-and-heat-toolbox-row-g6); [BOOK-UI-COMPONENTS.md](../BOOK-UI-COMPONENTS.md) Page, Room page, Note.
- Hosted CI on the head: ci success, book-e2e success (`gh run list --commit 63441602...`).
- Verdict: **APPROVE WITH NOTES**: one should-fix, two nits.

## Must be true

1. Lines come only from GameView `cues`; absent `cues` renders nothing (Chapter 1 unchanged).
2. Order is the view's (nearest first); the Book never re-sorts or walks exits.
3. Direction phrase only when `direction` is present; the own-room cue is the text alone; no punctuation added.
4. The sense is in the authored words; no icon or colour carries it.
5. Accessible name equals visible text; not pressable; no motion.
6. House component, no new one-off style.
7. `text` is a TextKey resolved through the same `Say` as other view text.

## Proof

- (1) `pages.tsx:190` guards on `p.view.cues`; schema `minItems: 1` so no empty block. RoomPage (9) and Note stories green locally at the head; book-e2e green.
- (3)(7) `model.ts:33`. Mutants on RoomPage stories: drop direction phrase (killed, 1 test), invert the direction test (killed, 2), render the raw key instead of `text(...)` (killed, 2), drop the cue block in `Here` (killed, 2).
- (4)(5)(6) `Note` (`lines.tsx:28`) is one `Text` in the existing `note` palette style: name = text, no press, no animation.
- Claim rerun: the stories' cue lists equal the sampler's view in `kernel/ts/test/senses.test.ts:68-74`. Claim rerun: Chapter 1 room stories unchanged (7 pre-existing RoomPage stories pass; book-e2e green).
- Story fixture: Chapter 1 first-room view plus injected cues, worded by the sampler's own `cue.*` keys through the existing `words` override: acceptable (no `senses_sampler` view fixture exists; no new fixture file).
- Docs: book-ui.md section marked pending designer; row G6 "done (batch M7)" with wording queued in `loka-x6t.14` (PM decision).

## Findings

1. **should-fix** `mobile/app/stories/RoomPage.stories.tsx:65`: order (must-be-true 2) is not pinned. Mutant `[...p.view.cues].reverse().map(` at `pages.tsx:192` stays green (9/9). Scenario: a later edit sorts cues by sense and the stew (two rooms off) reads before the hammering next door; no test fails. Assert the two lines' sequence (e.g. `getAllByText(/from the/)` order).
2. **nit** designer queue (`loka-x6t.14`): direction is any exit `Key` (`gameview.schema.json` CueView), and 31 shipped rooms have `up`/`down` exits, so "from the up" is a live wording case once any cartridge combines cues with vertical exits; keep it on the designer item.
3. **nit** no PR body yet: report the developer's `/code-review` result in the batch PR body.
