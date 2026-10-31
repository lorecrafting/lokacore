# Checks

The active checks run in hosted CI on every push to a branch, nightly on `main` and by hand; a green
run on the exact head is the merge gate with review ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)).
Locally, pre-commit checks the staged files and developers run only the tests their diff touches;
`bin/check_all.sh` mirrors the hosted line for an occasional full local run (PM only: `LOKA_PM=1` prefix). `bin/prepush.sh` runs
the static checks of hosted CI that the branch's changed file types need (diff against the merge base with `origin/main`,
uncommitted edits included; all of them when it cannot be read): the Elixir checks only for `.ex`, `.exs`, `mix.lock`, `protocol/` or `composition-profile.json`,
the TypeScript ones only for TS, package JSON or JSON under `kernel/ts`, `mobile`, `cartridges` or `protocol`, Prettier only on the changed files (every file after a Prettier setup change); `REGEN` and `DOCS` always run before every push and after every
`bin/pm_merge.sh` merge. It first runs `bin/regen.sh`, the one command that rewrites every generated file from its inputs (the `contracts.exs` and `features.exs` outputs, `schemas/source/` (`mix loka.source_schema`), `docs/state-sections.gen.json`, the review index, and, only when the diff against `origin/main` touches their inputs, the story views and saves, a changed cartridge's (every one after a `lib/` or `protocol/capability_registry.json` change) compiled hash fixtures (frozen ones excepted, `value` ones included, after the containers generator) with its transcripts' content hash, and `test/loka/lint_baseline.txt`, which only shrinks: a new finding fails), and fails `REGEN_DIRTY` naming each file it rewrote: after editing a generator's input, run `bin/regen.sh` and commit what it rewrites. When the branch diff against `origin/main` touches their inputs (or cannot be read), it also runs `mobile/app/stories.test.ts` (story views and saves fresh, every story file indexes as literal CSF). The `.githooks/pre-push` hook runs it on every push (status-only pushes under `.beads/` or `docs/HANDOFF.md` skip it, and so does the ref `bin/pm_merge.sh` pushes, whose sha it just checked: `LOKA_PREPUSH_OK`); `--no-verify` needs the owner's OK.
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
  marked `ast-grep-ignore`; `mobile-book-english`: no English literal in `mobile/app/book/*.tsx` or `mobile/app/SaveError.tsx` outside [`LABEL`](../mobile/app/book/labels.ts), the files still to migrate listed in its `ignores`) keep their cases; `bin/check_all.sh` scans the whole tree with every rule, pre-commit the staged files. Rule
  modules live only in `kernel/ts/src/mechanics/<capability>/rule.ts`, are registered in `runtime/world.ts` only as
  `<module>.decide`, never mutate, cast or name `Object`/`JSON`/`Function`-like escapes, and
  import only kernel modules; the typed `Rule` contract (`kernel/ts/test/rule_ownership.ts`)
  and `step`'s event-ownership check keep each to its capability's commands and events. The foundation
  imports only its own modules and generated contracts (`ts-foundation-imports`). Kernel code outside `runtime/` and `view/`
  reads no `world.character` or `world.body` (`ts-rule-actor-from-command`, [Realm seams](decisions/owner-decision-realm-seams-2026-10-13.md) rule 1); each existing read is frozen with
  `// ast-grep-ignore: ts-rule-actor-from-command` until RS-2 removes it. Every
  rule has valid and invalid cases in `lint/tests/`; `bin/lint_red_controls.sh --core-only` plants
  kernel violations and requires each active rule to report them. The full mode remains for later mobile work.
- TypeScript: Prettier (`.prettierrc.json`, scope in `.prettierignore`, `npm ci` at the
  root) formats on edit and is checked in pre-commit and CI (run from the repo root;
  `.prettierignore` only applies there). CI and `bin/check_all.sh` currently select
  non-mobile files; `mobile/` formatting is deferred in both, but the pre-commit hook
  still runs Prettier and `ast-grep scan --error` on staged `mobile/` files. The mobile app's
  `npx tsc --noEmit` is not in CI; `bin/prepush.sh` runs it locally. Active TypeScript verification is
  `npm run typecheck && npm test` in `kernel/ts` and `npm test` in `mobile/app` (local-story
  authority and Book tests), in CI's `kernel` and `mobile` jobs and `bin/check_all.sh` (Node's built-in test runner).
  `bin/check_all.sh` sets `TEST_REPORTER=dot` (the `npm test` scripts default to `spec`): one dot per
  passing test, failures printed in full.
- Size: source files at most 300 lines, test files 500, each function clause (and `fn`/arrow)
  40, in every tracked Elixir, TypeScript and `.mjs` file (`*.gen.*` exempt), `mobile/` included:
  `elixir bin/check_size.exs`, `node bin/check_ts_size.mjs`. With no paths the TypeScript check
  selects the tracked files itself; CI and `bin/check_all.sh` both call it
  that way (red control `bin/ts_size_red_controls.sh`). Pre-commit runs both on the staged files, and
  the edit hook (`bin/format_on_edit.sh`) runs the TypeScript check on each edited file. Escape hatch: a `size: allow N, reason` comment in lines
  1-5 (file) or right above a function after line 5, at most 1.5x; the reviewer must agree
  a split would be worse. Source files: a file at its limit (300 lines, or its existing
  `size: allow`) splits instead of growing; no new `size: allow` is added to a source file and
  an existing one is never raised. Test files keep the escape hatch.
- `mix credo --strict`: cyclomatic complexity 9, nesting 2, ABC size 30, arity 6; nothing else (pre-commit runs it on the staged `.ex` files).
  Any `credo:disable` comment gives its reason on the same line; the reviewer checks it.
- `elixir bin/contracts.exs --check` (also in pre-commit when `docs/MECHANICS-TOOLBOX.md`, `docs/CHECKS.md`, `docs/system/mechanics.md` or `protocol/` is staged, as a push to `main` runs no hosted CI): `kernel/ts/src/contracts.gen.ts`, the
  [capability/schema docs](contracts.gen.md) and the capability/residency matrix
  (`docs/residency.gen.json`) and the System pages' graph (`docs/system-graph.gen.json`, also
  from `docs/system/save.md`'s table block, `protocol/README.md`'s fixture column,
  the authored file names under `cartridges/*/<map>/` and `cartridges/*/<map>.json` and
  `docs/state-sections.gen.json`, which `kernel/ts/test/state_sections.test.ts` keeps current:
  `LOKA_WRITE_GEN=1` rewrites it, then rerun contracts.exs) match `protocol/`, and the System
  Checks and Toolbox pages' `docs/checks.gen.json` and `docs/toolbox.gen.json` match this page's
  bullets and the [toolbox](MECHANICS-TOOLBOX.md) table with its `docs/system/mechanics.md` rules
  (`bin/regen.sh` regenerates, also after editing any of the three); an
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
- `bin/beads_sync_red_controls.sh` (in `ci.yml`'s `lint` job with the pinned real `br`, and in `bin/prepush.sh` when `bin/lib/beads_sync.sh`, `after_merge`, `beads_checkpoint`, `beads_after_git`, `session_status`, `.githooks/post-merge` or the controls changed and `br` is installed) runs `bin/lib/beads_sync.sh`, the pull and `br sync --merge` of `bin/after_merge.sh` and `bin/beads_checkpoint.sh`, in throwaway clones: a local write and a moved main export fold together and a rerun with nothing committed merges again; a row edited on both sides refuses with its id after the pull, leaves the database row and the base unchanged, and the printed steps keep both sides' rows, and the SessionStart hook (`bin/session_status.sh`) does not import main's row over it; a rerun after an unpushed merge refuses a row main changed since (nothing changed) and the printed steps keep both sides; a rerun with that export staged still pulls; a database that never imported main's last pull keeps main's rows. The stub `beads_checkpoint` cases in `bin/integration_red_controls.sh` also check that a rejected push undoes the checkpoint's commit and a rerun pushes.
- `bin/ci_timing_red_controls.sh` (in `ci.yml`'s `lint` job) checks that `bin/ci_timing.sh` prints both sim legs of the head and of the nightly run but no other or unfinished job, and the nightly sim median of five runs skipping a failed leg.
- `bin/mutate_diff_red_controls.sh` (in `ci.yml`'s `lint` job) checks that `bin/mutate_diff.sh` kills a tested guard's mutants with the failing test line, kills a block guard's negation (an `} else if` too), reports an untested guard as SURVIVED (exit 1, also beside TIMEBOX rows), a module no test imports as NO-TESTS, a repeated line as NOT-UNIQUE and tests already red as BASELINE-RED, runs a module's tests one import hop away, through a directory import and (Elixir, stub `mise`) through an `xref` caller, labels two equal operators on a line apart, and skips a `mutate-skip:` line, a number inside a string, a co-located `.test.` file and Elixir `"""` prose; that a renamed file yields only its edited line's mutants and a pure rename none (also with `diff.renames=false`); and that `MUTATE_MINUTES` budgets the whole run (setup past it prints TIMEBOX rows, exit 3; `bin/mutate.sh` gets only the minutes left; a non-integer or a leading zero is a usage error, exit 2).
- `bin/orphans_red_controls.sh` (in `ci.yml`'s `lint` job) checks that `bin/orphans.sh` lists a busy, old orphan and skips a child, a young, an idle, a system and a server process. `bin/worktree_setup_red_controls.sh` (in `bin/prepush.sh` when `bin/worktree_setup*` changed: it needs macOS `cp -c`) checks that `bin/worktree_setup.sh` clones main's `node_modules` (never a link) for a matching lockfile when main's own lockfile still matches its install marker (without its `.cache`, replacing a leftover `node_modules.tmp`, a stale clone or an older link; a failed clone exits non-zero) and removes an older worktree's link before `npm ci` after a lockfile change.
- `mix loka.lint <cartridge dir>` (`lib/loka/content/lint.ex`, exit 1 on any finding; [pass 1 rows 1, 3, 5, 6, 7](playtests/2026-10-21-pass1/analysis.md#candidate-deterministic-checks)): a refusing scripted action names a reason, a reaction that applies or cures a status or assigns, adjusts or stamps a fact narrates or is `"silent": true`, a readable has a title, a detail with a page is linked from its room's prose and a scripted action aimed at a detail gives the detail a title (loka-x6t.120), a dialogue with no label or keyword has `action.talk` text, the normal band starts below 100%, every room or detail description variant has a `when` and none is shadowed by an earlier one with a subset of its guard terms, every item has a source (a non-template location, replenish, craft yield, shop shelf or stock, NPC drop, population plan, corpse template or escrow output) and a sink (edible, craft input, shop buy-back of a shelf or stock item, escrow input or dialogue hand-over; a quest or guard that only checks the item is not one), a liquid a use scripted action or drink service wants has a vessel that starts with it or a room detail that gives it, a fuel supply a lamp burns starts above 0, a dialogue choice or action label has no final single period unless it opens with a quote mark (an ellipsis is fine), every status label is lowercase (`condition.bleeding` exempt), and no text sentence opens with a one-to-three-word colon label (`High tide: ...`; loka-pxa0; the label rules run on every cartridge). `test/loka/content_lint_test.exs` runs it on the story cartridges against `test/loka/lint_baseline.txt` (loka-kgd.184 clears it) and pins which items and NPCs each target or tool tag query matches in the showcase (row 7, M8a). Row 4: the showcase sim (`kernel/ts/test/sim.test.ts`, `sim_batch.ts` `unnarrated`) fails an action key the kernel accepts with a change and no narration line (no allowlist; loka-kgd.185 cleared the baseline). Row 2: `mobile/app/book/reasons.test.ts` gives every offer refusal code a reason word, and every `RefusalCause` in `error.schema.json` its own word.
- `bin/prose_lint.py <cartridge dir>` (report only, never a gate; exit 0 on findings, 2 on bad input; balance N6 text health): per cartridge it prints W7 variant groups whose texts share a first word, keys with one alternate, sentence length (mean, spread) per key kind, and the Flesch-Kincaid grade. Band-phrase coverage is skipped: N6 defines no bands. Its control `bin/prose_lint_red_controls.sh` (fixture `test/fixtures/prose_lint`) is in `ci.yml`'s `lint` job.
- `bin/merge_resolve_red_controls.sh` checks that `bin/merge_resolve.py` (the `bin/pm_merge.sh` resolver) keeps both
  sides' whole `## `/`### ` sections at one spot of `docs/system/mechanics.md`, both sides' table rows at one spot of
  `docs/MECHANICS-TOOLBOX.md`, the higher
  `kernel_api` (1.10 over 1.9) and a regenerated `docs/system-graph.gen.json`; takes and stages every regenerated file (a
  `content_hash`-only transcript, a live save, a compiled hash fixture, `docs/state-sections.gen.json`) beside a hand file it
  leaves, naming only the left ones; and leaves unresolved a transcript that differs beyond `content_hash`, a modify/delete of a
  generated file, a section
  that repeats a `## ` heading, a `###` beside a `##` section, a non-table line, two sections inside another section, one row id on both sides, a review
  record that differs
  beyond whitespace and a TypeScript source conflict.
- `bin/integration_red_controls.sh` runs the PM scripts in throwaway repositories with stubs.
  It runs `bin/push_slice.sh <worktree> <branch>` against a bare origin (a branch not checked out in the worktree is refused): an accepted push prints `PUSH_EXIT=0 <sha>` and sets the branch's upstream to `origin/<branch>` (it was `origin/main`), a rejected one exits non-zero and prints a non-zero `PUSH_EXIT`.
  It runs `bin/sync_pr.sh` (merge `main` into a PR branch): a code conflict is refused, a review
  index conflict is regenerated, the merge is pushed, and a failed docs check blocks the push.
  It also runs `bin/after_merge.sh` (stub `gh`/`br`; bare origin): an unmerged PR, a stray file, a dirty
  PR worktree, a `review-<N>` not in main that touches a path outside `docs/reviews/`, or a remote PR branch ahead of main is refused with nothing changed; a records-only one is cherry-picked onto main (the index regenerated over a clash) and pushed, also when nothing else is staged; a dirty Beads export survives the pull, also when main changed the export (`br sync --merge`); the worktree,
  branch and `review-<N>` are removed and main is pushed with the ROADMAP edit; a script copy behind main is replaced and re-run, and an export dirtied after the commit gets its own commit before the push.
  It also runs `.githooks/pre-commit` (stub `mise`): a staged `docs/MECHANICS-TOOLBOX.md`, `docs/CHECKS.md`, `docs/system/mechanics.md` or `protocol/` file runs `contracts.exs --check` and a failure blocks the commit; an unrelated file does not. A rerun of `bin/after_merge.sh` for an issue already closed skips `br close`.
  It also runs `bin/preview_update.sh` and `bin/polish_session.sh` (stub `mise` servers on ports 7006 and up, stub `gh`):
  a decoy server found only by name survives, a second run restarts nothing, `npm ci` runs only for a
  changed lockfile, a dirty preview, a served or closed session is refused; `start` makes a branch with no upstream; `update` merges `origin/main` into the session and restarts Storybook only when the pull adds or renames a `*.stories.tsx` or `*.mdx` file and the session is served, and refuses a closed session; close refuses a failing `catalogue.test.ts` (nothing pushed, the session stays served), otherwise pushes, opens the PR and serves
  the preview again, leaving the web preview and Expo running.
  It also runs `bin/br_create.sh` with a stub `br` (the new id's `source_repo_path` is cleared; a local path in the new row warns but still creates).
  It also runs `bin/mutate.sh` (mutant sweep with restore: an apply that does nothing, a restore that
  leaves a diff in the file or any tracked file, a two-field line run as a deletion or a skipped
  narrow command fails) and `bin/session_status.sh` with stub `br` (the
  housekeeping list, the missed-retro note, a failing `br` still exits 0; other worktrees, the stash
  count and merged `review-<N>` refs are listed, the own checkout and unmerged refs are not; a red, running or missing nightly run is reported).
  It also runs `bin/pm_merge.sh` (a protocol schema or `kernel_api` change with no added or updated `docs/reviews` record is refused and reset; a green merge runs `prepush.sh` once, the hook skipping only the sha `pm_merge` checked) and `bin/prepush.sh` (each gated check runs only for its inputs), and `bin/ci_changes.sh` (docs-only skips the test jobs, an engine change runs `sim` and `walk`, any other event or an unreadable diff runs all).
- Claude hooks (`.claude/settings.json`): `bin/worktree_warn.sh` (Stop) only warns,
  listing worktrees with uncommitted changes. PreToolUse `bin/bash_guard.py` (Bash) refuses `git ... --no-verify`,
  `git commit -n`, a force or `--mirror` push, `git rebase` and setting `LOKA_PREPUSH_OK` (an env prefix, `export`, `declare -x`; only `bin/pm_merge.sh` sets it) without the `LOKA_OWNER_OK_NO_VERIFY=1` prefix; `pkill`/`killall`,
  `kill` fed by `pgrep`/`pidof` in one pipe or `$( )`, `gh run watch`, `gh pr checks --watch`, `gh workflow run` (past `-R`), the full `npm test`, `test:nosim`, `test:sim`, `test:e2e`, `storybook:smoke`, `bin/check_all.sh`
  (past `nice`, `env`, `time`, `timeout`, `xargs`) and a `git worktree add` path that resolves outside `worktrees.noindex` or inside a checkout
  without the PM's `LOKA_PM=1` prefix; and a bare `br create`; `bin/send_guard.py`
  (SendMessage) refuses to resume a subagent whose newest compaction was a hook one (under 1 s).
  `bin/integration_red_controls.sh` feeds both their refused and allowed inputs.
- CI (`.github/workflows/`): `ci.yml` and `book-e2e.yml` run on every push to a branch other than
  `main`, nightly on `main` (10:00 UTC) and by `workflow_dispatch` (`LOKA_PM=1 gh workflow run <wf> --ref <branch>`, PM only),
  a superseded head's run cancelled; no pull request trigger ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)).
  `graph-diff.yml` alone runs on a pull request (never a push): it posts or updates one PR comment
  listing the System graph's node and edge changes against the base (`bin/graph_diff.py`, its
  control `bin/graph_diff_red_controls.sh` in `ci.yml`'s `lint` job); it never fails on a diff and
  is not a merge gate. `book-e2e.yml` runs three jobs in parallel: `walk`, the toolbox showcase's Book walk (`LOKA_WALK=toolbox_showcase npm run walkthrough` on `bin/loka dev cartridges/toolbox_showcase`, [preview command](web-preview.md); a failure uploads the contact sheet), `e2e`, the local Book browser save/reload path with tester.army e2e
  (see [preview command](web-preview.md)), and `storybook`: `npm run storybook:smoke` (every story renders, its play
  passes, axe at `test: 'error'`, every button's name starts with its shown text; one story file at a time; one run in the default light palette, [Storybook](web-preview.md#storybook)), then `npm run storybook:live` (every Live story and its click-through on the dev server), then `npm run storybook:picker` (one pick reaches the [polish queue](web-preview.md#polish-queue), a status line shows, Close batch waits for a working item); `mobile.yml` and `mobile-bundle.yml` are disabled
  in GitHub and retain only manual triggers in source for eventual resumption. Each workflow has
  one verdict job, `ci-green` and `book-e2e-green` (`if: always()`): it fails if any job failed or
  was cancelled, or if the path filter did not succeed ([workflow step 7](PM.md#loop)). The path filter is a first `changes` job
  ([`bin/ci_changes.sh`](../bin/ci_changes.sh), loka-n0ng) over the branch's diff against its merge base with `main`: a push whose
  files are all prose under `docs/` or `.beads/` (not `docs/spec/`, `docs/system/`, JSON, `.gen.` files or the prose files tests read, listed in the script) skips every job
  but `lint`; `sim` and `walk` run only when `kernel/ts/src` or `play`, `lib`, `cartridges`, `protocol`, `docs/spec/conformance`, `mobile/app`, `config`, `mix.exs` or `mix.lock`, `bin/loka`, the sim tests, `kernel/ts/package*.json`, `.github` or the filter changed;
  the nightly and `workflow_dispatch` runs run everything. The simulator (`kernel/ts/test/sim.ts`) runs its
  regression seeds everywhere and 10,000 fresh sequences only when `CI` is set (GitHub Actions
  sets it, in its own `sim` job, two parallel legs `sim (fresh)` (`npm run test:sim:fresh`) and `sim (showcase)` (`npm run test:sim:showcase`); the `kernel` job runs `test:nosim`; locally, `npm test` and `bin/check_all.sh` run 500), by
  [owner decision](decisions/owner-decision-test-audit-2026-10-02.md)
  (r1-acceptance-envelope.md §3).
