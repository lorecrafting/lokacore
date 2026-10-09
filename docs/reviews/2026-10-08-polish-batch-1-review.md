# Review: polish batch 1, docs consolidation (PR #327, Beads loka-bhb)

- PR #327, branch `polish/storybook-b1`, head `6987b19a`, base main `72ec2eab` (includes #326). Hosted CI was still running during this review; the PM confirms it is green before merge.
- Governing: [plan section A and E4](../briefs/polish/storybook-plan-2026-10-08.md#a-target-structure-each-fact-in-one-place); [design input, Batch 1](../briefs/polish/design-input-batches-1-2-2026-10-08.md#batch-1-docs-consolidation-plan-a--e4); G1-G5 answered "yes go with the recs" (loka-bhb notes). Stance: docs/config plus two stories; proportionate.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. book-ui.md loses only look words (the seven designer moves). Every behaviour rule survives either in book-ui.md or in the catalogue.
2. Archive moves use `git mv`. Every link resolves and every moved README stays reachable.
3. E4 fails on a planted look word and passes on the current docs, including the freshness "token".
4. The Tokens story reads `tokens.ts` live, and its ratios come from the same `contrast` that the token test uses.
5. The new dependency is pinned and the lockfile only adds entries. The fonts are declared in one file.

## Proof

- (1) The moves match the designer table. The palette mapping, "never the device setting" and the save-error screen showing light are now in the catalogue Colour bullet (`BOOK-UI-COMPONENTS.md:73-76`). The palette cross-fade is in the motion bullet (`:86-88`). `size.touch` is in the head.
- (2) `elixir bin/check_docs.exs`: 382 docs, 0 broken, 0 anchors, 0 unreachable. Neither the moved HTML files nor the two kept mocks have a relative `href`/`src` (`check_docs` does not resolve links in HTML).
- (3) `bin/docs_red_controls.sh`: all ok (this reruns the PR claim). Planting `#1a1a1a`, `44 px` or `` `size.touch` `` in book-ui.md is reported.
- (4) `Tokens.stories.tsx:4` imports `contrast` from `palette.ts:57`. Mutant `(y + 0.04)` in `contrast`: `palette.test.ts` fails `'26' !== '21'`. A swap of the `lum` coefficients (this reruns the PR claim) fails `'1.37' !== '4.00'` (the PR reported 8.59 for its own swap).
- (5) Lockfile diff: additions only (addon-docs, `@mdx-js/react`, `@types/mdx`, unplugin, webpack-virtual-modules, react-dom-shim). `addon-docs` is pinned at `10.6.1`, and the designer's `Markdown` block requires it. E6 was already done in batch 0 (`easing.test.ts:19`).
- Manager head: `manager-head.html` as deleted is byte-identical to `preview-head.html`, which `managerHead` (`.storybook/main.ts:41`, a typed `StorybookConfig` field checked by `tsc -p .storybook` in smoke) appends, so the relative `fonts/` URLs are unchanged. The runtime proof is the PR's Playwright run, which this review did not rerun.
- Disputes upheld: the ten story names are code spans, not links, and the designer has 2a/2b add the files (E1 lands in batch 3). The rule that a ratio below 4.5 renders in `danger` is the designer's spec (section 5).

## Findings

1. **should-fix** `bin/check_docs.exs:204`: `File.regular?(abs)` silently skips a missing `docs/system/book-ui.md`. The red control passes its planted copy as an extra file, so it never exercises the fixed path. Mutant: the path changed to `book_ui.md`, with `docs_red_controls.sh` all ok (survives). Scenario: book-ui.md is renamed or moved and its inbound links are updated (so `check_docs` passes), and E4 then checks nothing with no error. Fix: drop `File.regular?`, so `File.read!` raises on a missing file.
2. **nit** `bin/check_docs.exs:199`: the lookbehind `(?<![\w(])` also hides a colour in parentheses. A planted `Card (#2b2b2b).` passes. Excluding only `](#` would keep the anchor fix.
3. **nit** `docs/BOOK-UI-COMPONENTS.md:106-119`: the designer's row list ends with "Tokens", but the table has no Tokens row (it is a PR open item). The head links the story, so this is for the PM to settle.

## Fix round 1 (fix commit `a4725ef3`, head `a4725ef3`)

- Fix round 1: **APPROVE**.
- (1) Verified. The `File.regular?` guard is removed (`bin/check_docs.exs:202-206`). Mutant: path changed to `book_ui.md`; `check_docs` exits 1 with `File.Error`. Direct callers: `ci.yml:98`, `check_all.sh:17,55`, `sync_pr.sh:23` and `red_controls.exs:170` run it at the repo root, where book-ui.md exists. The throwaway repo in `docs_red_controls.sh` gets a stub book-ui.md that is linked from its README; all its checks pass (exit 0).
- (2) Verified. The lookbehind is `(?<!\]\(|\.md)` (`:199`). The red control plants a hex in parentheses, two anchors that read as hex and `44px`, and expects exactly 2 reports (`docs_red_controls.sh:35-40`). Mutant: lookbehind removed; the red control prints `FAIL: look word report`. The real docs still pass (383 docs, 0 broken).
- (3) Verified. `design-input-batches-1-2-2026-10-08.md:67` now records that Tokens has no row, attributed to the PM.
- Open: none.
