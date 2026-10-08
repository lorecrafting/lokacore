# Mobile size debt: primary review

- PR #305 (`chore/mobile-size-debt`), reviewed at `a81dbf1d`, base `294062aa`; 54 files.
- Governing: [CHECKS.md](../CHECKS.md) Size and TypeScript, [save.md](../system/save.md),
  [book-ui.md](../system/book-ui.md), AGENTS.md Simplicity and Writing tests,
  [WORKFLOW.md Review stance](../WORKFLOW.md#review-stance); owner ruling 2026-10-07 (paraphrased:
  fix the web-view mobile size debt now, gate `mobile/` with one tracked-files rule, no behavior
  change, no new source `size: allow`). Second opinion on the save split:
  [save second opinion](2026-10-07-mobile-size-debt-save-second-opinion.md).

**Verdict: APPROVE WITH NOTES.** No blocker or should-fix.

## Must be true

1. Every moved or extracted function keeps its checks, order, short-circuits, thrown errors and
   module state; Book action keys, button order and GameView mapping are unchanged.
2. Test names are unchanged and no assertion is dropped.
3. `check_ts_size.mjs` with no paths selects tracked files only, `mobile/` included, and CI,
   `check_all.sh` and `integrate_batch.sh:46` all call it that way.
4. The red control fails if `mobile/` is excluded or untracked files return.
5. No new `size: allow` on a source file; existing ones are not raised.

## Evidence

- Declaration-level comparison of the 29 changed mobile sources (base vs head, comments and
  whitespace stripped): every changed function read. Extracted helpers in
  `deadline-save`/`deadline-receipts`, `finale-save`/`finale-receipts`, `bell-save`/`bell-receipt`,
  `deer-save`, `dialogue-save`, `narration`, `store`/`commit`, `invocation`, `buttons`, `received`,
  `updates`, `Footer`, `DiscoveredMap`, `Menu`, `notices`, `pages`, `Body`, `Book` are the same
  expressions in the same evaluation order (for example, `setting` computes holder/jobs/facts before
  `funds`, as the base did; `lostProof` stays behind the `!!bell` conjunct). Section pages moved
  verbatim. Render helpers hold no hooks, so the element tree is unchanged.
- `npm test` in `mobile/app`: head 591 pass, 1 skip, 0 fail; base 590 pass, 1 skip. The sorted
  subtest names are identical (588). The one extra top-level entry is the `__tests__/bell-setup.test.ts`
  helper file, which the authority glob runs, as it does `dream-host.test.ts`.
- Assertion counts in the moved tests match base exactly: polish 191 (deepEqual 33, equal 103,
  ok 51, notEqual 2, match 1, doesNotThrow 1); bell 59 (deepEqual 13, equal 45, ok 1).
- e2e: 14 test names identical. Per-file `go` call sequences are identical apart from
  `water_depths`, where repeated inline runs became local `learnSwim`/`ferryBack`/`toWellBottom`/
  `toPoolBottom` helpers with the same taps and expects. `expect(` count drops 100 → 87 only
  because duplicated inline steps now live in one helper.
- `npx tsc --noEmit` (mobile/app) is clean. `ast-grep scan --error` and Prettier on the changed files pass.
- `node bin/check_ts_size.mjs`: 0 violations. 14 `size: allow` markers removed, none added.
- Hosted CI on `a81dbf1d`: all 7 jobs pass (browser, elixir, lint, sim, typescript, 2× changes).
- Merged with `origin/main` (`c7619f2f`, includes #303): no textual conflict;
  `elixir bin/check_docs.exs` passes (0 broken links or anchors), and the size gate passes.

## Test the tests (throwaway worktree, reverted)

| Mutant | Result |
|---|---|
| `check_ts_size.mjs` back to `--cached --others --exclude-standard` | `ts_size_red_controls.sh` exit 1 |
| `check_ts_size.mjs` with `':(exclude)mobile/**'` | `ts_size_red_controls.sh` exit 1 |
| `buttons.ts:88/93` swap place and held buttons | 2 tests fail |
| `commit.ts:66` skip the HEAD write | 209 tests fail |
| `received.ts:128` drop `choice_closed` from `returnWorld` | 3 tests fail |

Pre-existing survivors, as reported by the developer and not re-verified: mutants in `deadline-save`
`activated()` and `unbound()` and in `finale-receipts` `checkBellLines()` also survive on main.
They are noted here and do not block this PR.

## Deviations

- `mobile/app/tsconfig.json` excluding `book/__tests__/**`: hides nothing new. `book/*.test.ts`
  and authority `__tests__` were already excluded. If the exclusions are lifted, the polish files
  have 38 type errors against 34 in the base `polish.test.ts`; tests were never typechecked.
- The renderer-imports allowlist adds `buttons|received|sections|updates`. This is needed because
  pre-commit runs `ast-grep scan --error` on staged mobile files, so `Book.tsx` → `./updates.ts`
  would fail without it.
- Removing `--core-only` from `ts_size_red_controls.sh`: correct, because the one no-argument
  selection now includes `mobile/`.
- Doc pointers: see nit 1. #303 has merged and the merged tree is clean.

## Findings

1. **nit**, `docs/system/save.md:10,62,78,92,110,129,158,163,181` and `docs/world-parameters.md:70`
   (`authority.ts:202`): pointers moved by the line delta keep their base drift. The reader lands
   on the wrong line: `store.ts:28` is `execSync`, while the Receipt type is at `:36` (where
   DIFFERENCES now points). `authority.ts:25` is `replay: boolean`, while Reply is at `:31`.
   `authority.ts:70` is a doc comment, while `openStory` is at `:76`. `authority.ts:202` is
   `try {`, with no `*1000` there. The pointers the PR rewrote to new files are correct.
2. **nit**, `bin/ts_size_red_controls.sh:72-79`: the control checks the checker's default, not
   its callers. If someone re-adds `git ls-files … ':(exclude)mobile/**' | xargs node bin/check_ts_size.mjs`
   to `ci.yml:148`, the control stays green. This limit is acceptable because a test of the
   caller's text would be a source grep.
3. **question**, F10 is only partly closed: `bin/check_size.exs:16` still lists untracked files.
   A stray untracked oversize `.exs` therefore fails `check_all.sh` but not CI, while CHECKS.md:47
   says "tracked". This is outside the owner's TypeScript ruling; the PM decides.
4. **question**, the brief says six disputed code-review findings are listed in the PR
   description. They are not in the body, edits or comments, so I give no agree/disagree verdict.
   The PM should supply the list.
5. **nit**, Simplicity: the one-line `Accepted` alias is redefined in 4 files (`received.ts`,
   `narration.ts`, `deadline-receipts.ts`, `finale-receipts.ts`), and `ref` is duplicated in
   `bell-receipt.ts` and `finale-receipts.ts` (it was already duplicated at base). This costs
   nothing at runtime. The many-argument helpers (`resolved`, 8 arguments) are the price of the
   40-line limit and acceptable.
