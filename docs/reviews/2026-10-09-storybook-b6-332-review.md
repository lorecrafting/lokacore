# Review: polish batch 6, chapter card and story word Controls (PR #332)

- PR #332, branch `polish/storybook-b6`, head `79dcc50f`, base main `eab5c579`. Beads loka-bhb.
- Governing: [design input batch 6](../briefs/polish/design-input-batch-6-2026-10-09.md) §1, §3 (§2 deferred, loka-g96); [catalogue Chapter card row](../BOOK-UI-COMPONENTS.md#component-catalogue); [book-ui.md chapters](../system/book-ui.md#chapters-scenes-and-recovery); [protocol.md `chapter`](../system/protocol.md) line 363; routing row "Book UI design check or review" ([WORKFLOW](../WORKFLOW.md)): a quick correctness pass that also checks the designer's spec and token text.
- Scope: `mobile/app` UI, stories, docs. No save, protocol, kernel or cartridge file.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. The label counts from the zero-based declaration index: index 0 shows "Chapter one".
2. The card uses tokens only (no raw 38, 40, 80 or 2.6 outside `tokens.ts`). The token values match the mock at base 18.
3. The title is the page header and takes the arriving focus. Continue keeps its name. Nothing else on the card can be pressed.
4. A `words` Control overrides keyed text through the sayers and the buttons. A cleared (null) Control falls back to the table. `views/*.json` are unchanged (E5).
5. Each pre-filled key appears on its story's page.

## Proof

- (1) `protocol.md:363` says "a non-negative declaration index": the cite holds. `chapter-title.json:483` has `index: 0`. Mutant `COUNT[index - 1] ?? index` made `presenter.test.ts` fail (`actual: 'Chapter 0'`). Mutant on the numeral branch (`?? index`) failed with `actual: 'Chapter 12'`.
- (2) `chapterLabel` 13 px with letter spacing 2.6 is 0.2em of 13. `chapterTitle` 38/40 is 2.1em × 18 with line height 1.05. `body` is 18 in `tokens.ts:63`, so base 18 is the tokens' own base, and 38/40 is in line with the rest. Red control: inline `width: 80` made `ast-grep scan` report `error[mobile-book-raw-values]`. An inline `lineHeight: 40` was caught the same way. The PR's `sections.tsx:283` is line 284 at head because the marker commit added one line. The claim holds.
- (3) `sections.tsx:274-277`: `useTitleFocus()` and `accessibilityRole="header"` are on the title. The label is plain text. Continue is unchanged.
- (4) `screen.tsx:33` builds the sayers from `words[key] ?? table[key]`. `buttonsOf` uses those sayers. `screen.tsx:82` uses `?? {}` for null. `git diff --stat` shows no `views/*.json` change. Baseline: `RoomPage` + `ChapterPages` stories 11/11 pass. Mutant `table[key]` alone: `Room/Reworded` fails ("Unable to find an element with the text: A reworded landing…"), 6 others pass.
- (5) The pre-fill keys appear in `npc-choice.json`, `item-plain.json` and `notice-read.json`. The other keys are titles and descriptions of the shown room and chapter. `missing()` makes any key that is not in the table fail at load.
- Size marker `sections.tsx:3` (`allow 315`, 313 lines): justified. §1 says "no new file", and 315 is under 1.5×.
- Disputed `/code-review` items: I agree with each disposition. §1 decided the label/name split, and a combined name would not start with the visible title. The thrown error on a missing key is a loud smoke failure. The owner decided the presenter word.

## Findings

None blocking.

- nit `mobile/app/book/words.ts:22`: from chapter 13 the label switches style ("Chapter twelve", then "Chapter 13"). The `ponytail:` comment records the limit, and Chapter 1 has one chapter. No action.

## Open items (designer, not findings)

- The arriving focus lands on the title, so a screen reader that reads from the focus does not say "Chapter one". §1 accepts this. The designer can decide at the next design input.

## Notes

- For the node tests, `mobile/app/node_modules` and `kernel/ts/node_modules` were first symlinked to the main checkout. A vitest attempt left an empty `.vite-temp` in the main checkout's `mobile/app/node_modules`. The directory is empty; I used `npm ci` in the review worktree for the story run. Symlinks removed before the worktree was removed.

## Fix round 1 (head `6dbe64e5`: c04a9f54 designer text, 6dbe64e5 fix)

Scope: the Fable design review's should-fix (a screen reader never heard "Chapter one"). Verdict: **APPROVE WITH NOTES**.

- Fix `sections.tsx:274-283`: one `View accessible accessibilityRole="header"` with `useTitleFocus()` holds the label and the title. It has no `accessibilityLabel`, so its name is the visible text in order. This holds the label-in-name rule.
- Direct callers:
  - `useTitleFocus` (`pages.tsx:39`) gives a ref and `tabIndex -1`. A react-native-web View takes both.
  - `ChapterTitle` play: the header can take focus. It calls `focus()` itself, so it does not test arrival after a turn.
  - The `PageTurn.stories.tsx:56` regex query is correct.
- Red control: I moved the label out of the header View, so the header held only the title. `ChapterTitle` failed ("Unable to find … heading … `/^Chapter one\W+The Missing Child/`"); the other 3 passed. Restored.
- Runs:
  - `ChapterPages` stories: 4/4 pass.
  - `PageTurn/ChapterToSettings`: failed twice at the new head, then passed. At the old head `79dcc50f` it passed once and then failed (`expected null not to be null`, the curl wait). This is load flake, not the fix.
  - Typecheck: not rerun.
- Tokens: `tokens.ts:81` now explains why 38 is above the mock's scaled 33. That is the designer's call. It replaces my round-1 reasoning that 38 is 2.1em × 18.

### Findings

- should-fix `docs/briefs/polish/design-input-batch-6-2026-10-09.md:23-24` (§1 Layout) and `:42` (the catalogue row copy in the brief): both still put `accessibilityRole="header"` and `useTitleFocus()` on the title alone ("the title … the page header, arriving focus"). That contradicts the revised §1 Accessible name paragraph, `BOOK-UI-COMPONENTS.md:119` and the code. Failure scenario: a later slice that follows §1 Layout puts the header back on the title, and the label drops out of the name again. Fix: the same words as the Accessible name paragraph.
- nit: §1 and `BOOK-UI-COMPONENTS.md:119` give the name with a comma ("Chapter one, The Missing Child"). On web the two Texts join with no comma, and the play regex `\W+` accepts either. To match, say "in order" without punctuation.
