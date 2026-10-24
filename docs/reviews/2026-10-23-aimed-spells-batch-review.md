# Review: aimed targets batch, Pick lists and Douse (loka-x6t.109, PR #460, kernel_api 1.119)

- Branch `toolbox/batch-aimed-spells`, reviewed head `1b6839c6049bbcfa4e515dc497ce5fc7c3f4de2e` (89 files, five slices plus owner additions).
- Governing: [docs/briefs/aimed-targets/README.md](../briefs/aimed-targets/README.md), [book-ui.md Pick a second thing](../system/book-ui.md#word-bar), [BOOK-UI-COMPONENTS.md Pick list](../BOOK-UI-COMPONENTS.md), [mechanics.md 29b](../system/mechanics.md), [cartridge.md](../system/cartridge.md), AGENTS.md "Writing tests", [WORKFLOW review stance](../WORKFLOW.md), owner rule: aimed actions live on the target's page or combat foe line, never World.
- Reviewer: anthropic/claude-fable-5-1, independent, authored none of the work.
- Verdict: **CHANGES REQUIRED** at `1b6839c60` (hosted CI red on the reviewed head for causes inside the diff; engine, loaders and Book logic otherwise sound).

## Must be true (written before reading the diff)

1. An aimed cast with an unknown or unlearned word is `invalid_state` before any target check; no code tells which words are spells.
2. A target outside the recipe's scopes, dead, unseen or missing refuses (`invalid_target` / `not_present`) before any cost is paid.
3. The aimed offer sits only on admitted targets' GameView entries (inventory incl. the lit light slot, room npcs, room items), never in `spell_words`; the view and `gameview_agrees_with_admission` share one admission.
4. Both loaders refuse an unaimed damage/light.ignite step without its `npc`/`item`, a scope outside the enum, `aimed` on a non-spell target, and `aimed` or the `lamp` tag below 1.119, with `loader_floors.json` cases.
5. Book: Pick lists per spec (rows in GameView order, one open at a time, Escape/option close with focus back, unavailable rows with reason, option hidden when empty); a fight cast stays on Combat with its line in the combat log; an accepted pick elsewhere returns to World.
6. No raised size allowances; hash fixture, transcripts and `.sql` live fixtures consistent with the showcase change.

## Checks run

- Read every engine, loader, protocol, content, docs and Book hunk; tests `aimed_spells.test.ts`, `showcase_magic.test.ts`, `content_spell_effects_test.exs`, `cast_pick.test.ts`, `pick.test.ts` (headers name breaks; literals hand-set; no computed expectations).
- Mutants (focused files, all red): drop `living()` in `aimedAt` (`shared.ts:127`) → dead-wight test fails; swap word check and `hiddenTarget` (`actions.ts:242-243`) → unlearned-word order test fails; Elixir `bare/1` skipped → "aimed rows refused" fails.
- PR-body claims rerun: refusal order and dead-NPC refusal both backed by `aimed_spells.test.ts` (green on head, red under the mutants above). New sha appears in 15 fixture/transcript/.sql files, zero old-sha leftovers.
- Hosted CI on `1b6839c60`: `ci` and `book-e2e` failed (see finding 1).

## Findings

1. **blocker** — hosted CI red on the reviewed head, each cause in this diff:
   - `protocol/fixtures/invalid.json` RecipeStep `damage` without `npc` still expects `missing_property /npc`; `npc` is now optional in `action.schema.json`, so both kernels' "invalid fixtures" tests fail. Regenerate or move the case to an unaimed-spell loader row.
   - `test/loka/content_lint_test.exs` showcase lint baseline and tag-query pins are stale after the `lamp` tag and `Douse` rename.
   - `mobile/app/walkthrough/toolbox_showcase.walk.ts:187` calls `putAway()` after the lux pick, but an accepted pick returns to World (spec), so `Leave` is absent → walk dead end. `:104` taps `/^Fish in/` directly, but the rod's use pair now sits under `Use on…` → dead end.
   - `mobile/app/stories/PickList.stories.tsx:47` Closed/Pending: the option reads no `aria-expanded="false"`; mobile catalogue test: `docs/BOOK-UI-COMPONENTS.md:170` row for `PickLists` does not resolve to its story.
2. **should-fix** — `mobile/app/book/received.ts:48` `// size: allow 41` raises the function limit the PM forbade; split the fight-cast flag out (e.g. compute `cast` beside `commandOf`) instead.
3. **should-fix** — `mobile/app/book/actions.tsx:108-111` `close()` focuses the option, but when the accepted row empties the list (the killing bolt from a foe line) the option unmounts and focus falls to the document body; spec: "when it would be empty the option goes and focus moves to the page title".
4. **should-fix** — no `BackHandler`/`hardwareBackPress` anywhere in `mobile/app/book`; spec (book-ui.md ~415, BOOK-UI-COMPONENTS.md:213, brief line 177) says device Back closes an open list before leaving the page. Scenario: Android, open Cast a spell…, press Back → the list stays or the page leaves with it open. If Back is unimplemented Book-wide, record that in the spec instead.
5. nit — `docs/system/book-ui.md:419` still reads "(proposed, designer to confirm" for a shipped paragraph.
6. nit — `lint/rules/mobile-book-labels.yml:36` regex omits `Cast a spell…|Cast on…` though its comment says keep equal to LABEL; literals in `cast_pick.test.ts`, `cast_death.test.ts:47`, `CombatPage.stories.tsx:50` go unflagged.
7. nit — PR body reports no `/code-review` result.

Not findings: lux on an already-lit lantern spends ash (pre-existing unaimed behaviour); known-open loka-x6t.109.6-.9.

Verdict: CHANGES REQUIRED.

## Fix re-check: `5a6c6f4b030d7debe6eeb7a76857dd88a37dd5bf` (commits ebf5be65e, 8260a59d1, 5a6c6f4b0)

Reviewed only the three fix commits, the code they touch and its direct callers.

1. blocker → fixed. `protocol/fixtures/invalid.json` drops the two stale RecipeStep cases; `test/loka/content_lint_test.exs:294` pins `recipes/lux.json lamp`; `toolbox_showcase.walk.ts:100-101,183,207-208` pick through `Use on…` / the lux row and no longer `putAway()`; `ActionCard` sets `aria-expanded` (`use_on.test.ts:161` follows); the `PickLists` doc comment now sits on the export (catalogue row resolves). `lux.json` gains `reason.lux`; new showcase sha `f9ca0707…` in 15 fixture/transcript/.sql files, zero old. Focused runs green: mobile 19/19, kernel 35/35, Elixir 18/18 (`validate`, `aimed_spells`, `showcase_magic`, `pick`, `use_on`, `cast_pick`, `cast_death`, `reading`, `content_lint`, `content_spell_effects`, `contracts`). Hosted `ci` and `book-e2e` on the fix head were still in progress at the time of this re-check; the PM watches them.
2. should-fix → fixed. `received.ts:48` allowance gone; the fight-cast flag moved to `routedLines` (`received.ts:88-95`), same `closing(...)` call.
3. should-fix → fixed. `actions.tsx:82-95` `useFocus`: `sent` remembers the pressed option; on the next view, if `picks()` no longer lists it, `focusTitle(title.last)` (`title.ts:9-12,18-22`). Covered by stories `AnswerEmptiesList` / `AnswerKeepsOption` (`PickList.stories.tsx:117-134`), which run in the hosted Storybook smoke, not locally. Question, not a finding: the effect keys on `[view]`, so an unrelated view redraw between press and answer would clear `sent` early and leave focus on the body; not reproduced.
4. should-fix → deferred by PM ruling: Back is unbuilt Book-wide; spec gets a one-line note pointing at loka-x6t.113, added by the PM with this record.
5. nit → fixed (`book-ui.md:419` "PM approved as built 2026-10-23").
6. nit → fixed. `mobile-book-labels.yml:36` lists `Cast a spell…|Cast on…`; red control: a planted `tap('Leave')` in `mobile/app/book` is flagged (1 hit). The test and story literals cited earlier sit outside the rule's `files` scope by design.
7. nit → fixed (PR body line 9 reports `/code-review medium`, low for content).

Verdict: APPROVE WITH NOTES.
