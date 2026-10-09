# Review: polish batch 0, Storybook spike landing + designer on Fable (PR #326)

- PR #326, branch `polish/storybook`, head `ee1cc980`, base main `7c61d4d5`. Beads loka-bhb. Full correctness review.
- Governing: [Storybook plan](../briefs/polish/storybook-plan-2026-10-08.md) sections E (E2, E6), F row 0, G; [Control and Page turn](../BOOK-UI-COMPONENTS.md); [WORKFLOW roles and routing](../WORKFLOW.md#work-routing); [designer role record](../decisions/owner-decision-designer-role-2026-10-07.md). Owner words: 'yes sounds good' (loka-51b notes), 'yes go with the recs' (loka-bhb notes), both found verbatim in `.beads/issues.jsonl`.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. The curl picture is freed after Skia's last draw of it, once per picture, also on rapid turns and unmount.
2. The smoke fails on any unhandled error (filter gone) and runs on every non-docs PR behind `book-e2e-green`.
3. Disabled Control: no press, `aria-disabled`/`accessibilityState.disabled`, dim via a token.
4. Decision record quotes the owner verbatim; designer.md, WORKFLOW roles table and routing row, index, and one supersede line in the 2026-10-07 record agree.

## Proof

- (1) Mutant: cleanup back to immediate `dispose()` → smoke red, `BindingError: Cannot pass deleted object as a pointer of type Image const*`, `× Chapter To Settings` (PR claim rerun). Rapid turns: each `leaving` gets its own effect cleanup, so each picture is freed once; a late snapshot is freed at once, never drawn. Single-rAF variant: green, an equivalent mutant on this harness (the brief prescribes two frames as margin; one frame is not a defect). The non-equivalent mutants (immediate free, `disabled` dropped) are both red.
- (2) Mutant: `disabled={disabled}` removed (`pages.tsx:78`) → `× Disabled` (PR claim rerun). Hosted run 37898586716 on `ee1cc980`: smoke 3 files / 7 tests passed, browser job 6 min 53 s against `timeout-minutes: 20`; `book-e2e-green` needs `browser`. `bin/ci_scope.sh` skips only `.md` and Beads, so story and `.storybook` edits run it.
- Lockfile: of packages at base, only `postcss` 8.5.28→8.5.29 and `source-map-js` 1.2.1→1.2.2 moved (patch, build tooling); none removed; react-native-web, Reanimated, Babel unchanged. Plan has no remaining "draft" or "decisions pending" wording.
- Deviations accepted: `book-e2e.yml` over manual-only `mobile.yml`; one light-palette run (preview has no `VITE_LOKA_PALETTE`; dark/dawn/dusk contrast by `palette.test.ts`); no cancel on unmount (cancel leaks, immediate free is the defect); E2/E6 tests pre-exist.

## Findings

1. **nit** `docs/WORKFLOW.md:13`: the roles table now says only "Fable for the polish phase"; `docs/system/owner-rules.md:207` says "Opus; Fable for the polish phase". After the polish phase the table names no designer model. Fix: "Opus; Fable for the polish phase (record)".
2. **question** `.claude/agents/designer.md:5`: `model: fable` is the first frontmatter use of that alias (developer's open item). If the harness rejects it, an unnamed spawn falls back silently; WORKFLOW requires every spawn to name its model, so risk is low.
3. **nit** (pre-existing, disclosed by the developer) `mobile/app/book/PageTurn.tsx:116,132`: `reduced` toggling mid-curl reruns `animate` on the same picture; the first cleanup frees it while the curl draws, and the second `dispose()` deletes an already-deleted embind object (`@shopify/react-native-skia/lib/module/skia/web/Host.js:29` calls `ref.delete()` unguarded), now inside a rAF callback. Predates this PR; rare. PM to file.
