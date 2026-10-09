# Review: Live stories survive a sidebar switch (PR #335)

- PR #335, branch `fix/live-story-switch`, head `f51c5b63`. Beads loka-0qz. Storybook tooling only.
- Governing: [web-preview.md Storybook](../web-preview.md#storybook) (line 60), [CHECKS.md](../CHECKS.md) line 127 (`storybook:live` nightly), [WORKFLOW.md Review stance](../WORKFLOW.md#review-stance), [AGENTS.md Writing tests](../../AGENTS.md).
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Each Live story opens its own clean `:memory:` save, also after a sidebar switch in the same preview iframe.
2. Nothing the real web game's saves use changes (`App.tsx`, `sqlite-web.ts`, `authority/`).
3. A check fails when the option is removed, and it runs in the nightly `book-e2e` job.
4. The single-story checks are not weakened.

## Checks

- (2) Diff is `stories/Live.stories.tsx` (one line) and `.storybook/live.ts` only. `App.tsx:187-190` opens the persistent `NAME` without `useNewConnection` and still depends on the cache reuse; it is not touched.
- (3) Red control, own run: option removed with sed, `npm run storybook:live` exit 1; 9 single-story `ok`, `FAIL live--first-room then live--elspeth-asked render: Error code 1: table head already exists`. Restored with sed; `git diff --quiet` clean. `book-e2e.yml:37` runs `storybook:live` (nightly cron + dispatch).
- PR cites rerun: expo-sqlite is 57.0.3; `worker.ts:392-396` skips the cache only on `useNewConnection`; `worker.ts:775-807` is `maybeInitAsync` with the `_sqlite3`/`_vfs` path described. Both back the PR.
- Reload guard (`live.ts` `kept`): reasoned, not run. Playwright keeps the child `Frame` across navigation and the init script reruns, so a reload reads `kept` undefined and reports FAIL.
- Process slip: dev worktree `lokacore-wt-0qz` `git status` clean; committed file matches the PR diff.
- /code-review dispositions 1-7 are present in the PR body; 1-3 and 7 are in `f51c5b63`.

## Findings

- nit, `stories/Live.stories.tsx:20`: each mount adds one unclosed `:memory:` connection to the worker's cache (no `FinalizationRegistry` in expo-sqlite web). Scenario: 100 switches hold about 100 checkpoint-sized databases (checkpoints total 684 KB for 9) until the tab reloads. Dev-only; agrees with disposition 5. No change required.
