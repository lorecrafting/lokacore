# Review: room words batch, signpost fixture link and entity name words (loka-x6t.105, loka-6qi, PR #458, kernel_api 1.118)

- Branch `toolbox/batch-room-words`, reviewed head `3e86973e84143c8d58252e89faaba5e12d90b327` (range `e57f99d1b..3e86973e8`, 27 commits, five slices plus one CI fix). First pass was on `df121dbe7`; the fix commit is judged below.
- Governing: [docs/briefs/room-words/README.md](../briefs/room-words/README.md), [book-ui.md World and status entry](../system/book-ui.md#world-and-status-entry), [protocol.md](../system/protocol.md) (GameView `words`, Notice `key`), [cartridge.md name words](../system/cartridge.md#name-word-declarations), AGENTS.md "Writing tests", [WORKFLOW review stance](../WORKFLOW.md).
- Reviewer: anthropic/claude-fable-5-1, independent, authored none of the work.
- Verdict: **APPROVE WITH NOTES** at `3e86973e8` (first pass at `df121dbe7`: CHANGES REQUIRED, two blockers now fixed; finding 3 open as should-fix).

## Must be true (written before reading the diff)

1. Both kernels accept and refuse the same `words` shapes (`bare` required; `article` a/an/the; `plural` optional; text keys in the catalog, touch links checked) and both put `words` at floor 1.118 with a `loader_floors.json` case red in each.
2. GameView copies `words` to EntityView, ContentView and combat opponents only while the selected short is the base `short`; a W6 variant or W15 recognised name never leaks the bare name.
3. NoticeView and NoticeBoardView carry a required `key`; every projected notice has one.
4. The Book draws the signpost as a prose link only when the description links a key the view projects with an available Read offer and the notice is not a bed, transport or counted harvest; boards keep their World line; the linked notice draws no separate line.
5. Room sentences match the brief's literals (shared article per run, repeated after a proper name or on an equal name, plural collapse with count words to nine, is/are) and every inline link is a button named "<name>, open" reachable by Enter and Space.
6. Showcase: every article matches its short, appositive names show the name alone, every shared short has a plural, one sha across the hash fixture, transcripts and `.sql` fixtures.
7. Hosted CI is green on the head (two-lane CI: hosted CI gates every branch).

1 to 6 hold. 7 does not (findings 1 and 2).

## Findings

1. **Blocker**, `kernel/ts/test/c4_pack.test.ts:294`. `deepEqual(view.combat?.active_opponents, [{ id, name: 'npc.goblin.short', band: 'ready' }])` omits `words`, but the showcase goblin (`cartridges/toolbox_showcase/npcs/goblin.json`) now carries `words {bare, article: 'a', plural}` and `named()` copies them. Hosted `ci` run 40026604769, job `kernel`, fails on exactly this test; it also fails locally on the unmutated head (control run). Fix: add the expected `words` (or use a fixture goblin without words) so the test pins the projection.
2. **Blocker**, `mobile/app/stories/Live.stories.tsx:71,86,104,111` and `mobile/app/walkthrough/toolbox_showcase.walk.ts:88,152,171`. They still look up pre-words labels (`'the Reeve, open'`, `'Nell, the baker, open'`, `'a seed sack, open'`, `/^The farmer/`, `/^The fence/`, `/^The hedge-wizard/`) that the Book now renders as `'Reeve, open'`, `'Nell, open'`, `'seed sack, open'`, `'farmer, open'` and so on (`mobile/app/stories/routes.ts` was updated, these were not). Hosted `book-e2e` run 40026604683: 4 Live checks fail, 3 of 4 walkthrough tests dead-end. Fix: rename the labels as routes.ts did.
3. **Should-fix**, PR body line 12 ("narrow mutants (all red) and its own /code-review medium ... results are in the Beads notes"). `br show loka-6qi` and `loka-x6t.105` carry no mutant or `/code-review` result; the claim has no backing run. Put the mutant list and the `/code-review` outcome in the PR body or the Beads notes.

Known-open, not re-filed: loka-x6t.108 (collapse keyed by rendered plural text: two differently named items sharing a plural merge; `mobile/app/book/lines.tsx:233`), loka-kgd.192, loka-x6t.107.

## Checks run

- Spec and content: brief literals traced by hand through `Present` (`mobile/app/book/lines.tsx:230-252`) and pinned in `mobile/app/book/polish_style.test.ts`; `named()` guard `kernel/ts/src/view/combat.ts:31`; floor ladders `kernel/ts/src/content/cartridge_variants.ts` and `lib/loka/content/variants.ex:38` both top at 1.118 and count `words` as used; showcase articles vs shorts (0 mismatches, 6 appositive names show the bare name), 32 plurals on every shared short, no plural text shared across different shorts; old sha `1aa78d6b…` absent at head, new sha `c317344c…` in 39 places (same count as before); no projected notice without `key` in story views or valid fixtures.
- Mutants, scratch worktree, each red on the importing test files only: `combat.ts` guard dropped (variants.test.ts "guard carries its name words only while its base short holds" fails); `lines.tsx` `COUNT[n - 2]` → `COUNT[n - 1]` (polish_style.test.ts fails); `lines.tsx` repeated-name article clause dropped ("A stick and a stick" fails); `variants.ex` `[1, 118]` → `[1, 117]` (loader_floors_test.exs fails); `entity.schema.json` `required: ["bare"]` emptied (content_items_test.exs fails). Controls: Book and Elixir files green; kernel files red only on finding 1.
- PR-body cites rerun: `bin/pm_merge.sh:43-47` refuses a schema or kernel_api merge without a record (holds); "results are in the Beads notes" (finding 3).
- Book UI wording in `docs/system/book-ui.md:50-60` matches the owner rulings (per-run article sharing, appositive bare name, collapsed link opens the first member and recounts after Take); "A stick and a stick are here." is a consistent extension, not a contradiction.

## Disposition

### Re-check of `3e86973e8` (one commit on top of `df121dbe7`)

- Finding 1 fixed: `kernel/ts/test/c4_pack.test.ts:294-302` now expects the goblin's `words` row (`structuredClone` strips the loader's null prototype so `deepEqual` from `node:assert/strict` compares plain objects; the one-line comment says why). `test/c4_pack.test.ts` green locally (14 pass, 0 fail).
- Finding 2 fixed: `mobile/app/stories/Live.stories.tsx:71,86,104,111` tap `'Reeve, open'`, `'Nell, open'`, `'seed sack, open'`, matching `routes.ts:28,45,49`; `mobile/app/walkthrough/toolbox_showcase.walk.ts:88,116,121,152,171` match `/^(?:the )?<name>, open$/i`, which accepts the bare-name label the Book now renders. Direct callers: only `routes.ts` and these two files tap room links by label; nothing else references the old labels (`git grep` for `the Reeve, open`, `Nell, the baker`, `a seed sack, open`, `/^The ` finds none).
- Finding 3 open (should-fix): PR body still points at Beads notes that carry no mutant or `/code-review` result.
- Hosted CI on `3e86973e8`: `graph-diff` success; `ci` and `book-e2e` in progress at record time (the two red jobs were the kernel test and the Live/walk labels fixed here). The PM merge should wait for both.
