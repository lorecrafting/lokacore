# Independent review: PR #6 "Size and complexity limits"

- Reviewed commit: `6c02aee` (branch `size-limits`, two commits over `main` at `31e49fb`)
- Reviewer: Claude Opus 5.5 (fresh agent; authored none of the work)
- Date: 2026-09-24
- Depth: full (tooling with real logic): requirements first, probes, mutation check.
- Checks run locally at `6c02aee`: `mix credo --strict` (4 checks, 12 files, no issues),
  `elixir bin/check_size.exs`, `node bin/check_ts_size.mjs`, `bin/ts_size_red_controls.sh`,
  `elixir bin/red_controls.exs`: all green. CI green (per the brief).

## What must be true (derived from the owner's brief before reading the diff)

1. Every Elixir and TypeScript source file is at most 300 lines and every test file at most
   500. No file escapes through its directory, a gitignored path, or `.gen.` in a directory
   name.
2. Every function is at most 40 lines, measured from its first to its last real line,
   including multi-clause functions, `do:` one-liners, heredocs, nested TS functions, arrows,
   class methods and `.tsx`.
3. Credo runs only cyclomatic complexity 9, nesting 2, ABC size 30 and arity 6 (style off),
   on the paths where the code lives.
4. `size: allow N, reason`: N at most 1.5x the default, a reason is required, and an unneeded
   marker fails. Every marker in use is listed on every run. Using the hatch as documented
   keeps every check green.
5. Every limit and marker rule has a red control that fails when the rule breaks. Red
   controls leave the tree as they found it, on success and on failure.
6. AGENTS.md, CI and the scripts agree.

## Verdict: CHANGES REQUIRED

The counting core is solid. TS boundaries are right for declarations, arrows (block and
expression bodies), class methods, getters, nested functions and JSX in `.tsx`. The Elixir
`do`-block counting uses `:end` metadata correctly. 16 of 19 mutations were killed. Three
blockers:
- using the escape hatch as documented turns both size red controls red (item 4);
- the TS red control deletes a real `__tests__` directory (item 5);
- ABC size and arity have no red control, and changing either survives (item 5).

## Findings

### B1. blocker: any real `size: allow` marker in the tree fails both size red controls
`bin/red_controls.exs:155`, `bin/ts_size_red_controls.sh:39`. Both compare the checker's
whole output, over the whole repository, to a literal. A legitimate marker adds an `info:`
line to that output.

Reproduced:
- Adding `lib/loka/p/fm.ex` with `# size: allow 400, big table` and 340 lines:
  `check_size.exs` passes (exit 0), and `red_controls.exs` prints `FAIL size: exit 1, expected ...`.
- The same with `kernel/ts/src/table.ts`: `check_ts_size.mjs` exit 0, and the red control
  prints `FAIL ts size`.

So the escape hatch cannot be used without breaking CI. Compare only the lines for the
planted paths (filter the output by the `red_size` prefix), or run the checker over the
planted files only.

### B2. blocker: the TS red control deletes a real `mobile/features/story/__tests__`
`bin/ts_size_red_controls.sh:8,16`. The EXIT trap runs `rm -rf mobile/features/story/__tests__`.
If that directory already exists, the `mkdir` on line 16 fails. `set -e` is off, so the
script continues, and the trap deletes the whole directory.

Reproduced: with `mobile/features/story/__tests__/Real.test.tsx` present, the script printed
`mkdir: ... File exists` and then `ok   ts size`. Afterwards `mobile/features/story/` held only
`index.ts`, so the real test file was gone. `__tests__` next to a feature is the Jest
convention, and the AGENTS.md check line runs this script on every local run, so
uncommitted tests get destroyed. Plant under a directory name that is unique to the control
(for example `mobile/features/story/red_size_tmp/__tests__/`), and remove only that
directory.

### B3. blocker: ABC size 30 and arity 6 have no red control; breaking them stays green
`.credo.exs:11-12`, `bin/red_controls.exs:35-45`. The brief asks for red controls for
everything, and AGENTS.md:164 says each check "has a planted case that must fail".

Mutation: `max_size: 30` → `300` with the FunctionArity line deleted. `elixir bin/red_controls.exs`
still printed all `ok`. Add one planted function with ABC size 31 and one with arity 7.

### S1. should-fix: `def ... do:` with a multi-line literal is measured as 1 line
`bin/check_size.exs:24-35`. `last_line` reads line metadata only, and lists, strings and
heredocs carry none. So `def f(_x), do: """` + 50 lines + `"""` (53 lines) and
`def f, do: [` + 50 elements + `]` (52 lines) were not reported. Both were run.

A maps literal (`%{}`) has closing metadata, so it is counted correctly. A
`literal_encoder`, or taking the end of the enclosing expression, would close the gap.

### S2. should-fix: a file escapes through its directory name or placement
- `.gen.` anywhere in the path: `bin/check_size.exs:20`, `bin/check_ts_size.mjs:24`.
  `lib/loka/proto.gen.v1/big.ex` (402 lines) and `kernel/ts/src/x.gen.d/big.ts` (400 lines
  with a 100-line function) were not reported. Match on the basename.
- A `test` directory inside the TS source tree: `bin/check_ts_size.mjs:40`. `/\/(test|__tests__)\//`
  matches anywhere, so `kernel/ts/src/test/helper.ts` (400 lines, 100-line function) is
  treated as a test file: limit 500, no function limit, not reported. The Elixir script
  treats only a top-level `test/` as tests, so the two languages disagree.
- A colocated `*.test.ts(x)` file counts as source: `mobile/features/story/p/Story.test.tsx`
  was reported as `function <anonymous>, 62 lines` for its `describe` callback, with the
  300-line file limit. That forces markers on normal test files.
- Roots are allowlisted: `bin/check_size.exs:13` (`lib bin test`) and
  `bin/check_ts_size.mjs:20`. `kernel/ts/bench/b.ts` (400 lines) was not scanned. Future
  `config/*.exs`, `priv/repo/migrations/*.exs` (Ecto migrations are planned, per AGENTS.md)
  and any `kernel/ts/<other>/` directory will not be scanned either. Scanning every tracked
  `.ex`/`.exs`/`.ts`/`.tsx` (git already drops `deps/`, `node_modules` and the native
  directories) removes this whole class of escape with less code.

Gitignored paths are fine. `--cached` lists tracked files even when they match an ignore
pattern, and CI sees only tracked files.

### S3. should-fix: a stale marker outside the recognised spots is silently ignored
`bin/check_size.exs:87-91`, `bin/check_ts_size.mjs:56`. A marker counts only in lines 1-5 or
directly above a function. Put `# size: allow 60, old reason` on line 7, with `@doc` between
it and a one-line `def`: `check_size.exs` exits 0 with no output. The TS equivalent
(`// size: allow 60, old` above a JSDoc comment) is also silent.

The brief says "the marker itself fails when it isn't needed". Inserting a `@doc`/`@spec`
or moving code is the usual way a marker goes stale. Report any `size: allow` line that no
file or function consumed. (In lines 1-5 this already works: such a marker is reported as
"not needed".)

### S4. should-fix: `def unquote(name)(...)` crashes the Elixir checker
`bin/check_size.exs:74,76`. With a macro that defines functions via `unquote`, the name is
a tuple, and `"#{kind} #{name}"` raises `Protocol.UndefinedError` (String.Chars for Tuple).
The whole check aborts with a stack trace instead of a report. This was reproduced with a
7-line `defmacro`. Use `Macro.to_string(name)`, or `inspect`.

### Q1. question: are multi-clause functions measured per clause?
`bin/check_size.exs:71-76` counts each clause separately. A function `f/1` with two 37-line
clauses (78 lines) passes. The PR description says "each clause"; AGENTS.md:180 says
"functions 40". If per clause is intended, say so in AGENTS.md. If not, sum the clauses by
name and arity.

### Nits
1. `bin/check_ts_size.mjs:40`: `rel.startsWith('kernel/ts/test/') ||` is dead code, because
   the regex already matches it. Deleting the clause survived as an equivalent mutant.
2. Nothing tests the "first 5 lines" window for a file marker. Shrinking it to 4 survived in
   both languages, because every planted file marker is on line 1.
3. A file marker on line 1 directly above a function on line 2 is taken as a function
   marker. It then reports "not needed" (or is ignored), and the file limit stays at the
   default. This fails closed, but the message is confusing.
4. Elixir `fn` bodies in `bin/*.exs` scripts are not measured, while TS arrows are. A
   90-line anonymous `fn` in a script passes.

## Test the tests (mutation check, run in a throwaway worktree, reverted after each)

Killed (a red control failed):
- **Elixir:** function size off by one; `<` for "not needed"; ceiling 2x; the
  trailing-newline adjustment dropped; a function marker allowed as a file marker; `:end`
  metadata dropped; a marker without a reason accepted; the test limit at 300; `defp`
  skipped.
- **TS:** ceiling 2x; a marker without a reason accepted; `<` for "not needed"; the function
  marker line off by one; a function marker allowed as a file marker; the trailing-newline
  adjustment dropped.

Survived:
- the file-marker window 5 → 4 (Elixir and TS) (nit 2);
- dropping the `kernel/ts/test/` clause (equivalent mutant, nit 1);
- ABC 30 → 300 with arity removed (B3).

## Placement and consistency

- Credo covers `lib/`, `bin/` and `test/`, which matches the Elixir size roots. Only the
  four checks run: 12 files with no `@moduledoc` produced no issues.
- CI runs the elixir checks in the elixir job and the TS check and its red control in the
  typescript job, after `npm ci`.
- The AGENTS.md check line matches CI.
- The AGENTS.md "(`.gen.` files exempt)" wording matches the intent but not the code (S2).

## Re-review: fixes `b389b9f` and `aa58475` (head `aa58475`)

This is a broad re-review of both checkers and both size red controls: the fixes rewrote
path handling, scan scope, the test-file rule, S1 counting and how markers attach. `c11be5d`
merges main and was skipped. Local run at `aa58475`: credo, both checkers on the real tree,
`bin/ts_size_red_controls.sh` and `elixir bin/red_controls.exs` are all green.

### Verdict: CHANGES REQUIRED (one blocker, two should-fix)

Every first-round finding is resolved. The rewrite leaves the scan that CI actually runs
(no arguments) without a red control, and it adds a new escape through directory names.

### Earlier findings
- **B1 resolved.** Both red controls now run the checker only on their planted paths. I
  added real markers to the tree (`lib/loka/p/table.ex` with `# size: allow 400, big table`,
  and `kernel/ts/src/table.ts`): both checkers passed and printed their `info:` lines, and
  both red controls stayed `ok`. The developer's claim holds: the output for planted files
  cannot contain lines about other files. See R1 for what this change cost.
- **B2 resolved.** Plants go into `mktemp -d` / `unique_integer` directories, and only those
  are removed (trap with `set -eu`; `try/after` with `rm_rf!`). A pre-existing `__tests__`
  directory is no longer touched.
- **B3 resolved.** The ABC 31 and arity 7 controls exist. Mutating ABC 30 → 300 and deleting
  the arity check now makes both controls FAIL.
- **S1 resolved.** `end_of_expression` metadata catches `do:` heredocs and lists: the planted
  53- and 52-line one-liners are reported. `fn` passed as an argument is also measured
  correctly; I probed it at 47 lines.
- **S2 resolved as asked.**
  - `.gen.` is matched on the basename only.
  - Both languages share one test-file rule.
  - `test/` inside a source tree now counts as source.
  - Colocated `*.test.tsx` files count as tests.
  - The scan covers the whole repository, including `.mjs`.

  See R2 for a new escape.
- **S3 resolved.** An unattached marker fails. My line-7 `@doc` case is now planted
  (`m_stale`) in both languages.
- **S4 resolved.** `def unquote(n)()` is reported through `Macro.to_string`.
- **Q1 answered.** AGENTS.md now says "each function clause".
- **Nits 1-4 resolved.** Function markers must be after line 5, so the line-1 ambiguity is
  gone. The `fn` bodies in `bin/` scripts are now measured.

### Mutation check (34 mutants: my 19 re-mapped onto the new code, plus mutants of the new logic)
Killed:
- **Elixir:** def size off by one; `<` for "not needed"; ceiling 2x; the trailing newline
  dropped; `end_of_expression` dropped; a marker without a reason accepted; the test limit at
  300; `defp` skipped; the file window at 4; `__tests__` dropped; `.gen.` matched on the full
  path; `fn` dropped; unattached markers always or never reported; the `unquote` crash
  restored.
- **TS:** ceiling 2x; a marker without a reason accepted; `<` for "not needed"; the file
  window at 4; the trailing newline dropped; the test limit at 300; function size off by
  one; `__tests__` dropped; `.gen.` matched on the full path; unattached markers never
  reported; `.tsx` dropped.

Survived:
- no-argument scan returns nothing, Elixir and TS (R1);
- directory exclusion dropped (R2);
- the top-level `test/` and `kernel/ts/test/` directory rule dropped, Elixir and TS (R3);
- the `l - 1 > 5` guard dropped, Elixir and TS (nit R4);
- `meta[:end]` dropped (equivalent: `end_of_expression` and `closing` cover every case I
  probed, including `fn` as a call argument; not a finding).

### R1. blocker: the no-argument scan, which CI and the check line run, has no red control
`bin/check_size.exs:15-18`, `bin/check_ts_size.mjs:17-19`. Both red controls pass explicit
paths, so the `git ls-files` branch is never exercised.

Mutation: append `-- nothing` to the `ls-files` arguments, in either script. Both red
controls stay `ok`, and CI's `elixir bin/check_size.exs` / `node bin/check_ts_size.mjs` then
check zero files and exit 0 forever. This is the "empty return" mutation in AGENTS.md. Before
the fix the red control ran the real scan, so the B1 fix removed this coverage.

Fix: plant one oversized file in the real tree, run the checker with no arguments, and
require that its report line is present (containment, not equality, so real markers
elsewhere cannot break it).

### R2. should-fix: the new directory exclusion lets tracked source escape
`bin/check_size.exs:24`, `bin/check_ts_size.mjs:24`. `(^|/)(deps|_build|node_modules|android|ios)/`
matches any path segment. Reproduced as tracked, intent-to-add files: neither
`lib/loka/runtime/deps/big.ex` (402 lines) nor `mobile/packages/ui/ios/Big.tsx` (402 lines,
a 402-line function) was reported, and the TS checker exited 0.

The real directories are already gitignored, so the default scan never lists them anyway.
Delete the regex. If explicit paths need it, anchor it to the real roots (`^deps/`,
`^_build/`, `^mobile/app/(android|ios)/`, `node_modules/`).

### R3. should-fix: no plant covers the test-directory rule
`bin/red_controls.exs` (`T/big_test.exs`) and `bin/ts_size_red_controls.sh:25`
(`$T/big.test.ts`) are also named `_test`/`.test`, so dropping `^(test|kernel/ts/test)/`
from either regex survives. With that bug, `test/support/fixtures.ex` or
`kernel/ts/test/helpers.ts` at 400 lines would be reported as oversized source, and its
functions checked. This is the same gap `aa58475` closed for `__tests__`. Name the `T/`
plant without a test suffix.

### Nits
- R4. `l - 1 > 5` (`bin/check_size.exs:97`, `bin/check_ts_size.mjs:62`) is untested. Without
  it, a file marker on line 1 above a function starting on line 2 would also be consumed as
  that function's marker. The same side effect means a function starting on lines 2-6 can
  never take a marker; it fails closed.
- R5. `.mts`/`.cts` are not scanned: `kernel/ts/src/big.mts` (402 lines) was not reported.
  `/\.(tsx?|mjs)$/` → `/\.([cm]?tsx?|mjs)$/` would cover them, if they are ever used.

## Fix round 2: `24c72ea` (final round)

Scope: the R1-R5 dispositions and the `bin/check_all.sh` wiring. `815d8c1` merges main and
was skipped. Local run at `24c72ea`: both size red controls and `elixir bin/red_controls.exs`
are `ok`, and both checkers pass on the real tree.

### Verdict: APPROVE WITH NOTES

- **R1 resolved.** Both red controls now also run the no-argument scan. Each requires the exit
  status to be non-zero and the planted `big` file's line to be present; the check is
  containment, so real markers elsewhere cannot break it. The earlier mutation
  (`ls-files ... -- nothing`) is now killed in both languages, and so is `ls-files --cached`
  without `--others`, because the plants are untracked.
- **R2 resolved.** The folder-name exclusion is deleted from both scripts. The `L/deps/big.ex`
  and `$L/ios/Big.tsx` plants are reported, and re-adding a `deps|ios` exclusion is killed in
  both languages.
- **R3 resolved.** The test-folder plants carry no test suffix (`T/big_helper.ex`,
  `$T/helper.ts`), and each holds a 41-line function that must not be reported. Dropping the
  `^(test|kernel/ts/test)/` rule is now killed in both languages.
- **R4 resolved.** The `m_early_fn` plants have a marker on line 5 above a function on line 6.
  The marker is read as a file marker ("not needed"), and the function is still reported.
  Dropping the `l - 1 > 5` guard is killed in both languages.
- **R5 resolved.** `.mts`/`.cts` are scanned, and the test-name rule matches them. The
  `big.mts` plant is reported, and dropping `[cm]?` is killed.
- **Wiring.** `bin/check_all.sh` runs `mix credo --strict`, `elixir bin/check_size.exs`
  and `elixir bin/red_controls.exs` (which includes the size controls). After `--no-ts` it
  runs `node bin/check_ts_size.mjs` and `bin/ts_size_red_controls.sh`, matching CI.

Mutations rerun: all 10 earlier survivors are killed (no-argument scan ×2, tracked-only
listing, test folder ×2, marker guard ×2, folder exclusion ×2, `.mts`).

### Nit
- F1. `.githooks/pre-push:8` sets `--no-ts` unless a pushed ref changes `kernel/ts` or `mobile/`.
  The TS size check now also covers `bin/*.mjs` and any tracked `.ts` outside those folders.
  So a push that changes only `bin/check_ts_size.mjs` or `bin/ts_size_red_controls.sh` skips
  both locally. CI still runs them, so nothing ships unchecked. Adding `bin/*.mjs
  bin/ts_size_red_controls.sh` to that `git diff` pathspec would close the gap.
