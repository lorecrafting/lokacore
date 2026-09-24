# Review: local hooks (PR #7)

- PR: [#7](https://github.com/lorecrafting/lokacore/pull/7), branch `local-hooks`
- Commit reviewed: `0673d90`
- Reviewer: fresh Opus agent, authored none of the work. Tooling slice, short review
  (no mutation testing of a suite; each hook was run on planted cases instead).
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. The Claude hook runs only `mix format` on the edited file, whatever characters the path
   contains, and never blocks or breaks an edit.
2. No hook blocks a legitimate edit, commit or push. That includes a file outside the repo,
   a missing tool, and the reviewer's detached-HEAD push from WORKFLOW.md.
3. The hooks cannot be skipped silently, and when they run they check what is being
   committed or pushed.
4. `bin/check_all.sh` runs everything CI runs that can run locally, so CI never catches
   something that pre-push would have caught.
5. The setup and `--no-verify` rule are stated once, clearly.

## Runs (detached worktree at `0673d90`)

- Claude hook, command piped from `.claude/settings.json` through `sh -c`: paths
  `a b.ex`, `x$(touch PWNED1).ex`, ``y`touch PWNED2`.ex``, `q'"z.ex` and `$HOME.ex` were
  each formatted, exit 0, and nothing extra ran (no `PWNED*` files). The quoting is sound.
  With no mise the exit is 127, with a nonexistent path it is 1, and a file outside any
  repo is formatted from the session's cwd with exit 0. PostToolUse exit codes other than
  2 do not block, so none of these blocks an edit.
- pre-commit: clean in 1.2 s. A staged misformatted file failed (exit 1), as did a
  `Math.random()` in `kernel/ts/src` (ast-grep) and a broken link in WORKFLOW.md
  (check_docs).
- pre-push: a kernel/ts type error on a branch tracking `origin/local-hooks` failed
  (exit 2, TS2322). With no kernel change it passed, taking the `--no-kernel` path.

## Findings

1. **should-fix**, `.claude/settings.json:9`: the hook runs code from whichever repo the
   edited file belongs to, not just `mix format`. It `cd`s to the file's git toplevel and
   runs `mix` there, and mix evaluates that repo's `mix.exs`, `.formatter.exs` and
   formatter plugins. To show this, I made a scratch git repo whose `mix.exs` writes a file
   and piped an Edit of `c.ex` in it to the hook. The file appeared. So a session in this
   repo that edits an `.ex` file in a cloned third-party repo runs that repo's code with no
   prompt. Fix: format only when
   `git -C "$(dirname "$f")" rev-parse --git-common-dir` resolves to the same directory as
   it does for `$CLAUDE_PROJECT_DIR`. That still covers every lokacore worktree, including
   scratchpad ones.
2. **should-fix**, `bin/check_all.sh:17-22`: it is not the full CI line, so "CI never
   catches them" does not hold. Missing:
   - `mobile/app` `npx tsc --noEmit`: CI job `typescript`. A type error in `App.tsx`
     passes pre-push and fails CI. No local line covers mobile at all.
   - The kernel red-control loop: tsc must reject `fetch`, `setTimeout`, `process.env`,
     `require('os')`, `Buffer`, `performance` and `node:` imports. A tsconfig change that
     loosens `lib`/`types` passes pre-push and fails CI.
   - `mix deps.get --check-locked`: a `mix.exs` dep edit without a lock update passes
     locally and fails CI.

   `mix hex.audit` needs the network and can reasonably stay CI-only. If so, say it in the
   script header.
3. **should-fix**, `.githooks/pre-push:3`: the hook decides from `HEAD` and `@{upstream}`
   instead of the refs git passes on stdin. As a result:
   - (a) Let-through: from a clean branch, `git push origin other-branch`, where
     `other-branch` has a kernel type error, exits 0. I ran this case. The checks ran on
     the current working tree, not on the pushed commits.
   - (b) Blocks wrongly: a detached HEAD has no upstream, so the kernel always runs. The
     reviewer's docs-only push from a detached worktree (WORKFLOW.md, Git hygiene) is
     blocked with `kernel/ts not checked` unless `npm ci` was run first. WORKFLOW.md does
     say to run `npm ci`, but the brief given to reviewers says only `mix deps.get`.

   Fix: read `local_ref local_sha remote_ref remote_sha` from stdin. Diff `kernel/ts`
   between `remote_sha` and `local_sha`, using `origin/main` when `remote_sha` is all
   zeros. Add a `ponytail:` comment, like the one in pre-commit, noting that the checks run
   on the working tree.
4. **nit**, `.githooks/pre-commit:3`: the `ponytail:` comment names only the pass-through
   direction. The same working-tree choice also blocks wrongly. An untracked, misformatted
   `lib/scratch.ex` made an unrelated docs-only commit fail (exit 1). Name both directions,
   so that nobody reaches for `--no-verify`.
5. **nit**, `.githooks/pre-commit:5`: if mise is missing, the `||` prints
   `run: mise exec -- mix format`, which points at the wrong fix.
6. **nit**, `bin/check_all.sh:8-10`: CI compiles and runs xref with `MIX_ENV=test`, while
   check_all uses dev. The two are equivalent today because the project has no `config/`
   and no env-specific `elixirc_paths`. They diverge as soon as either appears.
7. **nit**, `AGENTS.md:195`: the `--no-verify` rule is clear and covers both commit and
   push. It could add "fix the cause instead (for example `npm ci`, or remove the scratch
   file)", because findings 3b and 4 are the usual reasons an agent would reach for it.

## Not findings

- Hooks can be skipped silently only in a clone without `core.hooksPath`. AGENTS.md states
  the setup, and CI remains the backstop. Without `jq`, the Claude hook does nothing, as
  the PR says.
- The ast-grep and Node versions match between `mise.toml` and CI.
- Nothing is over-engineered. The PR adds three short scripts and no new dependencies.
