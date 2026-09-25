# Review: pre-R4 sweep, TypeScript + mobile

- PR: [#21](https://github.com/lorecrafting/lokacore/pull/21), branch `sweep-ts`
- Commit reviewed: `08be6f5` (CI green on all 5 jobs)
- Reviewer: fresh session; authored none of the work. Cleanup slice with no intended
  behavior change, so the review is proportionate: nothing broken, nothing lost, clearer.

## Verdict: APPROVE

Nothing is broken or lost. The shared lint utility matches exactly what the four inline
copies matched, on a planted corpus wider than the rule tests. Every test body is
unchanged apart from the shared JSON reader. No findings.

## What must be true (written before reading the diff)

1. The four mobile import rules flag exactly the same nodes as before, both violations
   and non-violations.
2. The single `same()` behaves the same as both copies, and the tests still catch a broken one.
3. `test/read.ts` resolves the same files as the three helpers it replaces, and
   `node --test` does not pick it up as a test file.
4. Regrouping `portable_abi.test.ts` changes no test name or body, and drops no comment.
5. Un-exporting `MAX_DEPTH` breaks no importer. Test counts stay 33/33, and
   `bin/check_all.sh` stays green.

## Verification

- **Lint utility, old vs new rules.** I planted an 18-line corpus in each of six mobile
  directories, covering every rule's `files` glob: `mobile/app`, `features/realm`,
  `features/story`, `packages/ui`, `authority/local-story` and `authority/remote-realm`.
  It has static, side-effect, `import type` and namespace imports; `export {} from`,
  `export * as` and `export * from`; `import()` with and without options; `require` with
  one and with two arguments; and near-misses: a template literal, a conditional argument,
  `obj.require`, `import.meta.resolve`, `jest.mock`, and plain strings that name the
  forbidden paths. I ran `ast-grep scan --json` with the branch rules. Then I swapped in
  `origin/main`'s `lint/rules` and `sgconfig.yml` (with `lint/utils` removed) and ran it
  again. Both runs give the same 42 matches (rule, file, line, column). `ast-grep test
  --skip-snapshot-tests` gives 6/6. The util is a verbatim copy of the old inline block,
  and `inside: { matches: … }` tests the same parent node that the inline `inside` did.
  (Plain `ast-grep test` reports 6 "no baseline" snapshot failures on `main` too. The
  repository skips snapshots in `bin/check_all.sh`.)
- **`same()`.** The two copies were textually identical. `invariants.ts` already imported
  `key` and `target` from `compose.ts`, so the new import adds no dependency edge. Making
  the shared `same` return `true` fails 2 of 33 tests.
- **`read.ts`.** It uses the same `../../../` base URL as the old compose and portable_abi
  helpers. validate's old helper prefixed `protocol/`, and all four of its call sites now
  spell `protocol/…`. The `test/**/*.test.ts` glob does not match `read.ts`. compose's
  `jobs()` is unchanged: `range(n)` is 1-based, the same ids as the old `i + 1`.
- **portable_abi regrouping.** I split both versions at top-level statements and compared
  tests by name. The same 19 names are on both sides. Every body is byte-identical except
  `CommandId known answers`, where an inline `readFileSync` + `JSON.parse` became
  `read('protocol/fixtures/command_id.json')` (same file). Every `// Catches …` comment
  survives. Only the file header changed, and it is accurate: `fixture()` still checks
  hashes.
- **`MAX_DEPTH`.** `git grep` finds it only in `canonical.ts` (3 internal uses) and in docs.
- **Counts and gate.** kernel/ts `npm test` passes 33/33. `bin/check_all.sh` exits 0 at `08be6f5`,
  including the 6/6 red controls and Prettier.
- **Parallel lanes.** #23 (`sweep-elixir`) and #22 (`sweep-docs`) share no file with this
  PR except `docs/reviews/README.md`, where each review appends a line (trivial merge).
  #22 regenerates `contracts.gen.ts`, which still exports `DEFS` and `EVALUATION_FAULTS`
  for `invariants.ts` and the tests.

## "Proposed, not done"

- **#4, tests not typechecked: worth doing now, as its own small PR, before R5 rule tests
  pile up.** I typechecked `src` and `test` with a throwaway tsconfig that borrows
  `mobile/app`'s `@types/node`. It reports 3 errors, all one cause:
  `validate.test.ts:17,24,53` passes `{ ...DEFS, ...PROBE }`, whose values type
  as `unknown`, where `validate` wants `Defs`. The fix is a test tsconfig, one
  `@types/node` devDependency, a cast or typed `defs`, and a `typecheck` step, so it is
  cheap. It does not block R4.
- **#1 (kernel entry point) and #7 (where the foundation differential lives):** decide in
  R5 planning, before its first slice, because local-story and the simulation slice depend
  on them. No code before then.
- **#2 and #3 (rules layout, invariant split):** do them in the first R5 rule slice, when
  there are TS-only rules to separate. Empty directories now would be scaffolding.
- **#5 (split portable_abi):** skip. The regrouping already gives the navigation benefit.
- **#6 (`implemented_in: "r3_pr5"`):** a protocol data change for cosmetic gain across two
  kernels. Leave it unless a milestone field is needed for something else.

Outside this PR's scope, seen while planting: the mobile rules do not flag
``require(`../realm`)`` (a template literal), `require(cond ? '../realm' : …)` or
`jest.mock('../realm')`. The same is true on `main`. Worth a line in R5's lint work if
dynamic specifiers ever appear.
