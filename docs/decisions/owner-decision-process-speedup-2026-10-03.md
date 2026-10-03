# Owner decisions: process speed-up, 2026-10-03

Owner decisions (paraphrased): the owner accepted all PM recommendations from the timing diagnosis of PRs #97-#126 (23 h window, 30 merged PRs; 16 of 17 `main` merges conflicted, 15 of them in index files only; the typescript job took 172 s, 72 s of it the 10k simulator; 54 pushes were Markdown-only review records or codex appends). Source: `process-timing.md` section (e), kept outside the repository. The slice PR (#130) measured the parallel jobs at sim 1m36s, typescript 2m06s, elixir 57s, lint 17s; a Markdown-only push skips elixir, typescript and sim.

| # | Decision | Takes effect |
|---|---|---|
| 1 | Parallel slices: the stage plan marks slices that share no files; the PM may run two developers at once on them, each PR with its own fresh reviewer. | [WORKFLOW Loop step 1](../WORKFLOW.md) |
| 2a | `docs/reviews/README.md` and `docs/decisions/README.md` (append-only lists) use `merge=union` in `.gitattributes`. GitHub's mergeability may still report a conflict, so the PM still merges `main` locally, with no hand edit. | `.gitattributes`; [Git hygiene](../WORKFLOW.md) |
| 2b | The PM writes ROADMAP status-only lines (slice done, PR link, slice count) as a direct commit on `main` right after the merge. Any other ROADMAP change goes through a PR. | [WORKFLOW step 7](../WORKFLOW.md) |
| 3 | The codex Sol fix re-check starts at the same moment as the Opus scoped re-check. | [WORKFLOW step 6](../WORKFLOW.md) |
| 4a | The simulator's 10,000 fresh sequences run in their own parallel `sim` CI job; the `typescript` job skips `sim.test.ts`. | `ci.yml`, [CHECKS](../CHECKS.md) |
| 4b | The PM appends codex answers in the same push as its other post-verdict commits. | [WORKFLOW step 7](../WORKFLOW.md) |
| 4c | On a pull request push where every file changed since the newest ancestor whose code jobs all passed is `*.md` (not `*.gen.md`), the code jobs are skipped; `lint` (with the docs link check) always runs. Non-Markdown files under `docs/` count as code. No such ancestor, or an API error, runs everything. Pushes to main never skip, so a break that only a combined merge shows surfaces on main's CI right after the merge; the PM watches main's run after each merge. | `bin/docs_only.sh`, `ci.yml`, [CHECKS](../CHECKS.md), WORKFLOW step 7 |
| 5 | Agents run `bin/check_all.sh` once; the pre-push hook is the final run. | `developer.md`, `reviewer.md`, WORKFLOW step 3 |
