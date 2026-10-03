# Review: test audit trim, CI-only 10k simulator run, dot reporter — 2026-10-02

PR #125 (`test-audit-trim`), commit reviewed `42a9bc2`. Test, lint, script and docs only. The
source audit is r78 `test-audit.md` (D1-D10). The decision record is
[owner-decision-test-audit-2026-10-02](../decisions/owner-decision-test-audit-2026-10-02.md).

**Verdict: CHANGES REQUIRED**

## Must be true (written before reading the diff)

1. Only the audit's proved removals D1-D10 are deleted. For each one, a remaining test still fails
   on the audit's mutant. The rewrite sites, the faults seeds, the optional D8 `resources` case and
   the support-module restructure stay as they are. No production code changes.
2. In CI, the simulator runs 10,000 fresh sequences. Locally (`npm test`, `bin/check_all.sh`,
   pre-push), it runs a small count. The regression seeds run everywhere. The local run stays a
   reliable gate: no new flakes, and a failure can still be rerun.
3. `bin/check_all.sh` uses the dot reporter. A failing test still makes it exit non-zero and still
   prints in full.
4. AGENTS.md "Writing tests" gains E1-E4. It stays within the 1400-word budget and does not
   contradict the existing bullets.
5. `docs/CHECKS.md:62` and every other live doc that states the simulator count match the code.
6. The lint red control still plants a violation that only the shared util catches.

## Checks

- **Mutants**, run in a detached worktree (TS: kernel without `sim.test.ts`, plus mobile;
  Elixir: `mix test --force`). Each one was reverted, and `git status` was clean after each.
  - D1 TS `compose.ts:104` set to `if (false)`: composition known answers and quest delivery FIFO
    fail. D1 Elixir `compose.ex:142` set to `when false`: known answers and the differential fail.
  - D2 TS `invariants.ts:231` set to `return true`, and Elixir `invariants.ex:96` set to `true`: the
    invariant known answers fail in both kernels.
  - D3 `session.ts:95` changed from `??=` to `=`: 4 smoke tests fail.
  - D4 Elixir `canonical.ex:187` sort deleted: portable_abi and registries fail.
  - D5 `authority.ts:177` digest check dropped: 2 tests fail.
  - D7 `dialogue.ts:169` destination set to `body`: kernel and mobile both fail.
  - D8 `MAX_DEPTH = 129`: "nesting is limited to 128 containers" fails.
  - D9 `checks.ex:43` pin list cut: "diagnostics from several files" fails (only one test, not the
    audit's two). The PR also deletes the `UNKNOWN_COMMAND` case, and the audit's D9 mutant does not
    cover it, so I ran my own: `checks.ex:285` with `else: []`. "diagnostics from several files" and
    ferry "an action's command is never run_job" fail.
  - D10: with `require\.resolve` dropped from `module-specifier.yml`, all 4 `ast-grep test` rules fail
    and `bin/lint_red_controls.sh` reports "mobile-realm-no-story not reported". So the new
    `require.resolve` plant still catches the violation.
- **Own mutants**, near the cut lantern_proof assertions:
  - The story points dropped from `dialogue.ts:122`: 4 kernel tests fail (story point outcome,
    carry, leave, transcripts).
  - The narration roles dropped at `:123`: 3 kernel tests fail, and mobile adverse cases fail.
- **CI**: run 37098154196, typescript job, log line 608 reads `✔ the regression seeds, then 10000
  fresh sequences` (115 s). Only `ci.yml`'s typescript job runs `sim.test.ts`. `mobile*.yml` do not
  run it, and no workflow sets or clears `CI`.
- **Reporter**:
  - With a planted `assert.equal(1 + 1, 3)` in kernel/ts, `bin/check_all.sh` exits 1 and prints
    "Failed tests:", the assertion and the stack.
  - The same plant in mobile/app with `TEST_REPORTER=dot` exits 1 and prints the failure in full.
- **AGENTS.md**: exactly 1400 words, at the budget (`bin/check_docs.exs:56`). E1-E4 do not
  contradict the existing bullets. `CHECKS.md:63-66` matches `sim.test.ts:23`, and the reporter
  line matches both `package.json` scripts.
- **No leftover imports or helpers** in `world.test.ts`, `validate.test.ts`, `compose.test.ts` or the
  Elixir files (0 warnings).
- `printenv CI` is empty in the agent shell, so agents do get the 200 count.

## Findings

- **should-fix F-1** `kernel/ts/test/sim.test.ts:23` with `:106`: at 200 fresh sequences, the "never
  reached" check flakes locally. The 2 regression seeds reach none of `not_present`, `cooldown`,
  `fault evaluator_error` or `exit_closed`. Their per-sequence rates are 2.3, 3.0, 2.9 and 4.2
  percent.
  - Measured: 51 of 2201 sliding 200-seed windows miss a REACHED code, about 2 percent of local
    runs.
  - Reproduced: with `Date.now = () => 1790000001910`, `env -u CI node --test --test-reporter=dot
    test/sim.test.ts` exits 1 with `never reached: ['cooldown']`.
  - The dot reporter drops the `t.diagnostic` that prints the fresh seed range, so a pre-push or
    check_all failure like this cannot be rerun.
  - Failure scenario: about one pre-push in 50 fails on code that has no bug, and the agent cannot
    reproduce the failure.
  - Fix: a local count of 500. It costs 5.2 s against 3.2 s at 200, and the miss chance drops to
    about 1e-5. This keeps the generator-coverage check that the header names. Do not gate the
    assertion on `CI`: that would drop the check locally.
- **should-fix F-2** `docs/system/architecture.md:101-102` still says "the regression seeds plus
  10,000 fresh sequences run in every `npm test` (`kernel/ts/test/sim.test.ts:22`)". That is now
  false, and `:22` is now the comment line. Failure scenario: an agent reads the system doc, trusts
  a local green run as 10k coverage, and skips CI. Fix: say 10,000 in CI and a small local count,
  and cite `:23`.
- **nit N-1** `kernel/ts/test/sim.test.ts:2`: the file header still says "then 10,000 fresh
  sequences".
- **nit N-2** `kernel/ts/test/sim.test.ts:23`: if a future CI job runs without `CI` (a container or
  `env -i`), it runs 200 sequences silently. Only the test title shows the count. Today's
  workflows are fine, as the log above shows.
- **nit N-3** `AGENTS.md`: 1400 of 1400 words, so the next addition must cut first.

## Questions

- **Q-1** `AGENTS.md:118-120`: the shortened E2 drops the audit's definition of "layer" ("the same
  kernel's unit files, or the same authority file"). Could an agent treat both kernels as one layer
  and skip an Elixir/TS parity test? The "Expected values" bullet still requires parity, so this is
  low risk.

Open (out of scope, as the decision says): the existing SQL-text fault taps, for example
`saves.test.ts:469`, now break the new E4 rule until the rewrite slice.

Codex Sol review: appended by the PM.

## Codex Sol first review (42a9bc2), verbatim

CHANGES REQUESTED

```text
R1 | should-fix | kernel/ts/test/validate.test.ts:61 at 42a9bc2
Deleting “a recursive Policy at the depth cap” removes a distinct decoder check. Mutant: canonical.ts:48 guards only c === '[' instead of both '[' and '{'. A Policy nested 129 objects deep then decodes successfully. The surviving ABI depth test exercises array decoding; 259 remaining kernel tests passed with this mutant (disk-writing suites excluded). Restoring the deleted test fails. Keep this case, or extend the ABI test to check object decoding at depths 128 and 129.
```
