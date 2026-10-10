# Checks

The active checks run in hosted CI on every push to a branch, nightly on `main` and by hand; a green
run on the exact head is the merge gate with review ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)).
Locally, pre-commit checks the staged files and developers run only the tests their diff touches;
`bin/check_all.sh` mirrors the hosted line for an occasional full local run.
The [scope audit](evidence/2026-10-06-ci-scope-audit.md) records the costs measured when lanes were selected locally.
Mobile checks are paused by the [owner decision](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md);
their rules and red controls remain available for resumption.

- `boundary` (strict, every boundary): the dependency directions in
  [architecture.md](system/architecture.md#elixir-boundaries-compile-checked) are a compile error. Declared in each boundary's top module (`lib/loka/*.ex`, `lib/loka_web.ex`).
- `mix xref graph --format cycles --fail-above 0` and
  `mix xref graph --label compile-connected --fail-above 0`: zero cycles, zero
  compile-connected edges. When a compile edge is justified, replace the zero with a
  reviewed allowed list.
- `ast-grep test` and `ast-grep scan --error` (`sgconfig.yml`, `lint/`): active CI checks the Elixir kernel
  (`lib/loka/core`) and the TypeScript kernel (`kernel/ts/src`) rules and paths. The paused mobile rules
  (`lint/rules/mobile-*.yml`: [mobile import rules](system/architecture.md#mobile-import-rules), session
  contracts, no display text in the authority, renderer imports, which allow Skia, Reanimated and Worklets
  for the page curl; `mobile-book-raw-values`: no raw hex colour or numeric `fontSize` in
  `mobile/app/book/*.tsx`, `mobile/app/SaveError.tsx` or `mobile/app/App*.tsx`, only [design tokens](BOOK-UI-COMPONENTS.md#design-tokens), a designer one-off
  marked `ast-grep-ignore`) keep their cases; `bin/check_all.sh` scans the whole tree with every rule, pre-commit the staged files. Rule
  modules live only in `kernel/ts/src/mechanics/<capability>/rule.ts`, are registered in `runtime/world.ts` only as
  `<module>.decide`, never mutate, cast or name `Object`/`JSON`/`Function`-like escapes, and
  import only kernel modules; the typed `Rule` contract (`kernel/ts/test/rule_ownership.ts`)
  and `step`'s event-ownership check keep each to its capability's commands and events. The foundation
  imports only its own modules and generated contracts (`ts-foundation-imports`). Every
  rule has valid and invalid cases in `lint/tests/`; `bin/lint_red_controls.sh --core-only` plants
  kernel violations and requires each active rule to report them. The full mode remains for later mobile work.
- TypeScript: Prettier (`.prettierrc.json`, scope in `.prettierignore`, `npm ci` at the
  root) formats on edit and is checked in pre-commit and CI (run from the repo root;
  `.prettierignore` only applies there). CI and `bin/check_all.sh` currently select
  non-mobile files; `mobile/` formatting is deferred in both, but the pre-commit hook
  still runs Prettier and `ast-grep scan --error` on staged `mobile/` files. The mobile app's
  `npx tsc --noEmit` is also deferred. Active TypeScript verification is
  `npm run typecheck && npm test` in `kernel/ts` and `npm test` in `mobile/app` (local-story
  authority and Book tests), in CI's `kernel` and `mobile` jobs and `bin/check_all.sh` (Node's built-in test runner).
  `bin/check_all.sh` sets `TEST_REPORTER=dot` (the `npm test` scripts default to `spec`): one dot per
  passing test, failures printed in full.
- Size: source files at most 300 lines, test files 500, each function clause (and `fn`/arrow)
  40, in every tracked Elixir, TypeScript and `.mjs` file (`*.gen.*` exempt), `mobile/` included:
  `elixir bin/check_size.exs`, `node bin/check_ts_size.mjs`. With no paths the TypeScript check
  selects the tracked files itself; CI and `bin/check_all.sh` both call it
  that way (red control `bin/ts_size_red_controls.sh`). Escape hatch: a `size: allow N, reason` comment in lines
  1-5 (file) or right above a function after line 5, at most 1.5x; the reviewer must agree
  a split would be worse. Source files: a file at its limit (300 lines, or its existing
  `size: allow`) splits instead of growing; no new `size: allow` is added to a source file and
  an existing one is never raised. Test files keep the escape hatch.
- `mix credo --strict`: cyclomatic complexity 9, nesting 2, ABC size 30, arity 6; nothing else.
  Any `credo:disable` comment gives its reason on the same line; the reviewer checks it.
- `elixir bin/contracts.exs --check` (also in pre-commit when `docs/MECHANICS-TOOLBOX.md`, `docs/CHECKS.md` or `protocol/` is staged, as a push to `main` runs no hosted CI): `kernel/ts/src/contracts.gen.ts`, the
  [capability/schema docs](contracts.gen.md) and the capability/residency matrix
  (`docs/residency.gen.json`) and the System pages' graph (`docs/system-graph.gen.json`, also
  from `docs/system/save.md`'s table block, `protocol/README.md`'s fixture column,
  the authored file names under `cartridges/*/<map>/` and `cartridges/*/<map>.json` and
  `docs/state-sections.gen.json`, which `kernel/ts/test/state_sections.test.ts` keeps current:
  `LOKA_WRITE_GEN=1` rewrites it, then rerun contracts.exs) match `protocol/`, and the System
  Checks and Toolbox pages' `docs/checks.gen.json` and `docs/toolbox.gen.json` match this page's
  bullets and the [toolbox](MECHANICS-TOOLBOX.md) table with its `docs/system/mechanics.md` rules
  (run without `--check` to regenerate, also after editing any of the three); an
  Elixir host adapter on a `portable_capability` without a differential fails (ADR-074), and so
  does a registry command, event or policy op that no schema declares.
- `elixir bin/features.exs --check`: the [feature map](features.gen.md) matches the
  capability registry and `docs/features.json`; an implemented capability (a rule module) with
  a missing cell fails.
- `elixir bin/red_controls.exs`: refuses occupied plant paths and creates files exclusively;
  `test/loka/red_controls_test.exs` checks preserved local bytes. It plants a boundary violation, a cycle, a compile edge, an
  oversized AGENTS.md, size-limit cases, one violation per Credo check, a stale and an
  out-of-subset schema, an Elixir adapter without a differential, a stale feature map, an
  implemented capability without its map cells, and a PartyId passed where a CharacterId is
  matched (nominal ids, `Loka.Core.Contracts`), and requires each check to fail.
- `elixir bin/check_docs.exs`: relative links and `#anchor`s resolve; every Markdown file is reachable
  by links from README.md, AGENTS.md or CLAUDE.md; AGENTS.md stays
  within its word budget (it is loaded by every agent, every session); each `path:line` code
  pointer in the live docs (AGENTS.md, docs/system, ROADMAP, CHECKS, WORKFLOW, lessons,
  world-parameters) names exactly one tracked file and a line inside it
  (`bin/docs_red_controls.sh` plants a missing file, a line past the end and an ambiguous name);
  `docs/decisions/README.md` has exactly one index line per record (catches a union merge that
  duplicated a twice-edited line, or a missing line); `docs/reviews/README.md` equals the output of
  `bin/review_index.sh` (title and final verdict per record) and each record is named
  `<YYYY-MM-DD>-<slug>.md` (`bin/docs_red_controls.sh` plants a stale index and a bad name);
  a `bin/*.sh` that runs `git init` sources `bin/lib/clean_git_env.sh`, so a hook's `GIT_DIR` cannot
  send a throwaway repo's writes into the real one (it plants a harness without the line);
  `docs/system/book-ui.md` names no look (a token, hex colour, px size or backticked palette or role
  name): those live in the catalogue (it plants a copy with a px size).
- `python3 bin/check_beads_export.py`: a tracked Beads JSONL row cannot carry a
  nonempty `source_repo_path` or a local machine path; all 33 Chapter 1 plan
  slices must appear exactly once with unique issue IDs, while supplemental
  audit follow-ups are allowed. Missing dependency targets and Beads-reserved
  `-wisp-` IDs fail. The pre-commit hook reads the staged export; CI lint and
  `check_all` read the checkout. `bin/beads_red_controls.sh` accepts a valid
  supplemental task and refuses both path classes, a missing or duplicate slice
  and a reserved ID, and checks the session-start PR drift report
  (`bin/beads_pr_drift.py`). The check needs no `br` binary.
- `bin/orphans_red_controls.sh` checks that `bin/orphans.sh` lists a busy, old orphan and skips a child, a young, an idle, a system and a server process. `bin/worktree_setup_red_controls.sh` checks that `bin/worktree_setup.sh` links main's `node_modules` for a matching lockfile and removes the link before `npm ci` after a lockfile change.
- `bin/integration_red_controls.sh` runs the PM scripts in throwaway repositories with stubs.
  It runs `bin/sync_pr.sh` (merge `main` into a PR branch): a code conflict is refused, a review
  index conflict is regenerated, the merge is pushed, and a failed docs check blocks the push.
  It also runs `bin/after_merge.sh` (stub `gh`/`br`; bare origin): an unmerged PR, a stray file, a dirty
  PR worktree, an unmerged `review-<N>`, a remote PR branch ahead of main or an export changed on both sides is refused with nothing changed; a dirty Beads export survives the pull; the worktree,
  branch and `review-<N>` are removed and main is pushed with the ROADMAP edit; a script copy behind main is replaced and re-run, and an export dirtied after the commit gets its own commit before the push.
  It also runs `.githooks/pre-commit` (stub `mise`): a staged `docs/MECHANICS-TOOLBOX.md`, `docs/CHECKS.md` or `protocol/` file runs `contracts.exs --check` and a failure blocks the commit; an unrelated file does not. A rerun of `bin/after_merge.sh` for an issue already closed skips `br close`.
  It also runs `bin/preview_update.sh` and `bin/polish_session.sh` (stub `mise` servers on ports 7006 and up, stub `gh`):
  a decoy server found only by name survives, a second run restarts nothing, `npm ci` runs only for a
  changed lockfile, a dirty preview, a served or closed session is refused; `update` restarts Storybook only when the pull adds or renames a `*.stories.tsx` or `*.mdx` file; close pushes, opens the PR and serves
  the preview again, leaving the web preview and Expo running.
  It also runs `bin/br_create.sh` with a stub `br` (the new id's `source_repo_path` is cleared; a local path in the new row warns but still creates).
  It also runs `bin/mutate.sh` (mutant sweep with restore: an apply that does nothing, a restore that
  leaves a diff in the file or any tracked file, a two-field line run as a deletion or a skipped
  narrow command fails) and `bin/session_status.sh` with stub `br` (the
  housekeeping list, the missed-retro note, a failing `br` still exits 0; other worktrees, the stash
  count and merged `review-<N>` refs are listed, the own checkout and unmerged refs are not; a red, running or missing nightly run is reported).
- Claude hooks (`.claude/settings.json`): `bin/worktree_warn.sh` (Stop) only warns,
  listing worktrees with uncommitted changes.
- CI (`.github/workflows/`): `ci.yml` and `book-e2e.yml` run on every push to a branch other than
  `main`, nightly on `main` (10:00 UTC) and by `workflow_dispatch` (`gh workflow run <wf> --ref <branch>`),
  a superseded head's run cancelled; no pull request trigger ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)).
  `graph-diff.yml` alone runs on a pull request (never a push): it posts or updates one PR comment
  listing the System graph's node and edge changes against the base (`bin/graph_diff.py`, its
  control `bin/graph_diff_red_controls.sh` in `ci.yml`'s `lint` job); it never fails on a diff and
  is not a merge gate. `book-e2e.yml` runs two jobs in parallel: `e2e`, the local Book browser save/reload path with tester.army e2e
  (see [preview command](web-preview.md)), and `storybook`: `npm run storybook:smoke` (every story renders, its play
  passes, axe at `test: 'error'`, every button's name starts with its shown text; one story file at a time; one run in the default light palette, [Storybook](web-preview.md#storybook)), then `npm run storybook:live` (every Live story and its click-through on the dev server), then `npm run storybook:picker` (one pick reaches the [polish queue](web-preview.md#polish-queue), a status line shows, Close batch waits for a working item); `mobile.yml` and `mobile-bundle.yml` are disabled
  in GitHub and retain only manual triggers in source for eventual resumption. Each workflow has
  one verdict job, `ci-green` and `book-e2e-green` (`if: always()`): it fails if any job failed,
  was cancelled or skipped ([workflow step 7](WORKFLOW.md#loop)). The simulator (`kernel/ts/test/sim.ts`) runs its
  regression seeds everywhere and 10,000 fresh sequences only when `CI` is set (GitHub Actions
  sets it, in its own `sim` job via `npm run test:sim`; the `kernel` job runs `test:nosim`; locally, `npm test` and `bin/check_all.sh` run 500), by
  [owner decision](decisions/owner-decision-test-audit-2026-10-02.md)
  (r1-acceptance-envelope.md §3).
  The `e1-recorder` job runs the [E1 recorder](system/e1-certification.md) (`kernel/ts/test/e1_cases.ts`)
  on the selected v042 artifact, rebuilt from `protocol/fixtures/missing_child_v042_hash.json` and sha-checked, and
  fails on a pending obligation, a gap or a failed case (about 6 minutes). Its steps run only nightly and
  on a `full` dispatch (`gh workflow run ci.yml --ref <branch> -f full=true`); on a push the job
  succeeds with every step skipped, so a green push run says nothing about E1 coverage. It is not in `bin/check_all.sh`.
