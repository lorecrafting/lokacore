# Independent review: PR #10 "Prettier for TypeScript (format on edit, pre-commit, CI)"

- Reviewed commit: `7d8d7c8` (branch `prettier`, four commits over `main`)
- Reviewer: Claude Opus 5.5 (fresh agent; authored none of the work)
- Date: 2026-09-24
- Depth: short (tooling/config), with every hook and check run on planted cases. No
  mutation of product code: the slice changes none.
- CI green on `7d8d7c8` (per the brief).

## What must be true (from the owner-approved brief, before reading the diff)

1. Prettier behaves for TS/JS/JSON as `mix format` does for Elixir: format on edit
   (`bin/format_on_edit.sh`), staged files checked in pre-commit, `prettier --check` in
   `bin/check_all.sh` and CI. One exact pinned version.
2. `docs/spec/conformance/*.json` (SHA-256 verified) and `*.gen.*` files are never touched
   by the edit hook, pre-commit, check_all, CI, or `npx prettier --write .` at the root.
3. The edit hook still runs nothing from another repository and handles odd file names.
4. Each new check fails on a planted violation.
5. The root `package.json` holds nothing beyond what that needs.

## Verdict: APPROVE WITH NOTES

All five hold as specified. Two nits, no blockers or should-fixes.

## Evidence

- **`d38670e` is formatting only.** At `d38670e^` I ran the pinned Prettier (`3.9.9`) with
  the branch config over the tracked TS/JS/JSON files: the result equals `d38670e`
  byte-for-byte (same 10 files, `git diff d38670e` empty). The JSON changes are only
  line joins and splits. At `d38670e`: kernel typecheck, `npm test` 18/18, mobile
  `tsc --noEmit` and `bin/check_ts_size.mjs` all pass.
- **Pin.** `package.json` has `"prettier": "3.9.9"` (exact), and the lock matches.
- **Fixtures and generated files (item 2).** Checked every path:
  - At the root, `npx prettier --write .` leaves all tracked files unchanged, including the
    fixtures and a planted misformatted `kernel/ts/src/x.gen.ts`.
  - The edit hook, given `cases.json`, `numeric-vectors.json` or a misformatted
    `z.gen.ts`, leaves each file unchanged.
  - `prettier --check` with only ignored paths (root `package.json`, `cases.json`, a
    misformatted `*.gen.ts`) exits 0, so pre-commit neither blocks nor rewrites them.
  - check_all and CI list files and run from the root, so `.prettierignore` applies.
- **Edit hook (item 3).**
  - Files named `a b.ts`, `q'uote.ts`, `$(touch PWNED).ts`, a non-ASCII name,
    `-dash.ts` and a name containing a newline were each formatted correctly, and nothing
    was executed.
  - A separate repository with its own `node_modules/.bin/prettier` (a script that writes
    a marker file) was not run, and neither was the same repository nested inside this
    worktree.
  - This repository's worktrees are still treated as this repository.
- **Red controls (item 4).**
  - Pre-commit: a staged misformatted `kernel/ts/src/zz.ts` blocks the commit with the
    fix hint, and HEAD does not move.
  - The check_all line (under `sh -e`) and the CI line (under `bash -e`) both exit
    non-zero on a misformatted tracked `rng.ts`. The check_all line also fails on an
    untracked misformatted file.
- **Minimal (item 5).** Root `package.json` is `private` plus one devDependency, and
  `.prettierrc.json` sets two options. The pre-push and AGENTS.md edits are one line each.
  Metro's `watchFolders` do not include the root, and nothing declares `workspaces`, so
  the new root package does not change the app build. Nothing to delete.

## Findings

### N1. nit: the fixtures are protected only when Prettier runs from the repo root

`.prettierignore:9`. Prettier reads `.prettierignore` only from its working directory.
`cd docs/spec/conformance && npx prettier --write .` rewrites five fixture JSON files and
two Markdown files. So does `npx prettier --write ../../docs/spec/conformance/cases.json`
run from `kernel/ts`. None of the automated paths do this, and the damage is loud:
`mix test` aborts at `test/loka/core/portable_abi_test.exs:10` with a hash mismatch, and
the kernel `npm test` fails. I tried a `requirePragma` override in `.prettierrc.json`
(the config is found from any directory). It protects the `.md` files but not the `.json`
ones, so no config-only fix exists. If a fix is wanted, it is one phrase in the AGENTS.md
Prettier line: "run from the repo root". Accepting the current state is also reasonable.

### N2. nit: pre-commit skips staged files with non-ASCII names

`.githooks/pre-commit:8`. `git diff --name-only` prints `"mobile/app/caf\303\251.ts"`
(quoted, because of `core.quotePath`). The pattern `\.(ts|…)$` does not match the closing
quote, so a staged misformatted `café.ts` commits cleanly; I planted it and it did.
check_all (`ls-files -z`) and CI still catch it. The `mix format` and `ast-grep` lines
already had the same gap on `main`. A one-flag fix covers all three:
`git -c core.quotePath=false diff --cached --name-only …`.

The developer's own findings (a pre-push that skips a `package.json`-only version bump, and
an unstaged deletion breaking check_all) are disclosed in the PR, and I agree with the
dispositions.

## Process note

The developer force-pushed once with `--force-with-lease` before the PR existed. This is
recorded as a process note, not a finding.
