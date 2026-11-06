# Review: author panel smoke in Chrome, `mutate-covers` (loka-wfrgk.41)

- PR: #664 `tools/panel-smoke`
- Reviewed commit: `1ea0a928caf1774e9ac959a71fcb81eafe0532d3` (base main `63d63a6a8`)
- Governing: [WORKFLOW review stance](../WORKFLOW.md#review-stance), [WORKFLOW token hygiene](../WORKFLOW.md#token-hygiene)
  (mutation gate), [editor rulings S3 Budgets](../design/editor-map-and-story-rulings.md) (`flow:*` under 300 / 100 ms),
  [AGENTS.md Writing tests](../../AGENTS.md), [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)
- Independence: Fable, authored none of the slice; detached worktree `loka-wfrgk.41-rev` (own author stack on three free
  ports, real Chrome via Playwright `channel: 'chrome'`), removed after this record
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (10 findings, dispositions listed)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. `mutate-covers:` only adds tests to a mutant's run; a mutant is KILLED only when a test fails, so an unrendered view
   can show SURVIVED, never KILLED; it never routes a sibling directory or a `.ts` file.
2. The new red-control rows go red when `covers` is deleted or its boundary loosened.
3. The smoke asserts exactly rulings S3 (the measures exist and sum under 300 / 100 ms), the 280 px inspector has no
   horizontal overflow, and the axe serious/critical set is a literal baseline so a new violation and a fixed one both fail.
4. The isolation test loosens only `playwright`, which `mobile/app` already pins.
5. The CI step runs the real panel and leaves nothing behind; ports and readiness waits are deterministic.
6. Docs and `checks.gen.json` agree; no machinery beyond the four checks.

## Checks that held

- `bin/mutate_diff.sh:` `covers()` is `mod.endswith('.tsx')` and `startswith(<pkg>/<dir> + '/')`; it widens `hit` only.
  A kill still needs `node --test` to fail, so the honest outcomes are red-narrow / SURVIVED (exit 1, stricter than
  NO-TESTS). It cannot turn a gap green.
- `sh bin/mutate_diff_red_controls.sh` passes at head. Own hand mutants on `bin/mutate_diff.sh`: drop ` or covers(t, mod)`
  → `FAIL: a .tsx under a mutate-covers dir: its browser test not run`, exit 1; drop the `+ '/'` boundary →
  `FAIL: a .tsx beside the mutate-covers dir: covered`, exit 1.
- `bin/mutate_diff.sh origin/main` at head: 0 mutants (the slice adds no routed source), as the PR body says.
- Panel hand mutants through `bin/mutate.sh` against `test/panel.test.ts`, all red-narrow: `src/edit/templates.tsx:60`
  `grid-cols-1` reverted (280 px overflow test); `src/App.tsx:38` fold label blanked (axe baseline gains a `button-name`
  row); `src/author.ts:97` `flow:fetch` renamed (the open budget sums NaN and fails).
- Smoke locally 4/4 in 21 s (open 48+2+28 ms, refilter 2+27 ms); the CI log shows open 22+3+40 ms, refilter 2+38 ms,
  margins about 4.6× and 2.5× under the budgets on a hosted runner. Dev build: rulings S3 names no build, the dev
  build is what the owner runs and is the slower of the two, so the budget holds a fortiori; accepted.
- Ports: three free ports picked per run, `strictPort: true` in `vite.config.ts`, so a collision fails fast instead of
  moving silently. Readiness: `page.goto` retried for up to 120 s then the `[aria-label="Card"] form` wait; node:test
  runs `after` when `before` throws, which closes the browser and kills both process groups by PID.
- Axe baseline (`panel.test.ts:112-115`): `color-contrast: #radix--trigger-project` and `label:` on the three
  `root_journal_outcomes_*-key` inputs; `deepEqual` to the literal, so a new serious/critical violation fails and so
  does silently fixing one (the owner then edits the list).
- `mobile/app/author/isolation.test.ts`: SHARED gains only `playwright`; `mobile/app/package.json` pins 1.63.0.
- PR body states how a future slice adds a check and reports `/code-review`; `docs/CHECKS.md` and `checks.gen.json` agree.
- No process of mine remained after the runs (the `author.ts` and headless Chrome still up belong to other worktrees).

## Findings

No blocker, no should-fix.

- Nit `tools/author-panel/test/panel.test.ts:112` the `found` list is in axe's result order, not sorted; a rule
  reordering across an axe-core bump fails the test with an unchanged violation set.
- Nit `tools/author-panel/test/panel.test.ts:114` the `label:` baseline row names showcase content
  (`carry_letter` journal outcome keys); renaming those outcomes in `cartridges/toolbox_showcase` fails the panel smoke
  rather than a content check.
- Nit `bin/worktree_setup.sh:8` installs `. kernel/ts mobile/app` only; in a fresh worktree every panel `.tsx` mutant
  routed by `mutate-covers` reports BASELINE-RED until `npm ci` is run in `tools/author-panel`.
- Nit `.github/workflows/ci.yml:236` fourth copy of the inline mise stub; developer defers as out of scope, agreed
  (Beads housekeeping).
- Question `bin/mutate_diff.sh:152` a perf-budget test red from machine load would count as a kill; `first_fail` names
  the failing test in the row, which is enough to spot it. No change asked.
