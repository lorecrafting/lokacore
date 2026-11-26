# Review: Field Undo chip flake (PR #815, loka-2z6b0)

- PR #815, branch `fix/field-undo-flake`. Reviewed at `576261b7b1af2cac19bf87da00155e526ce0d954`.
- Governing: AGENTS.md "Writing tests"; [WORKFLOW Review stance](../WORKFLOW.md). Test-only diff (`mobile/app/author/field.test.ts`).
- Why a record: asked for by the PM brief.
- CI at the head (`gh run list --commit 576261b…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE**.

## Must be true (written before the diff)

1. The chip assertions (4999 ms present, 5000 ms gone) still hold exactly; a real clock tick cannot shift them.
2. `write()` cannot pass before the save has armed the chip, and cannot hang.
3. Mocked `Date` is restored for every later test.
4. No product source changes.

## Checks run (detached worktree at the head)

- Focused file: pass 13, fail 0. `bin/mutate_diff.sh origin/main`: 0 mutants (test-only), matches the handback.
- Control A (2 ms busy-wait after `setItem` in `showUndo`, Build.tsx:166): main's test fails "the chip left before five seconds" (the CI symptom); this head passes. Backed.
- Mutants on Build.tsx:168 against the new test: `end - Date.now() - 1` red ("left before five seconds"); `+ 1` red ("outlives five seconds"); field.tsx:233 `h.wrote` skipped red. The deadline wait does not hide a missing chip.
- Vacuity: `opened()` returns the open field (else `input.props` throws), and field.tsx:233-235 calls `h.wrote` then `close` in the same turn, so "field closed" implies "chip armed". The loop is bounded by unmocked `performance.now()` (2 s) and uses unmocked `setImmediate`.
- Date: only the first test runs under the mock; `mock.timers.reset()` in `finally` restores it. No other Date read in that window (Build.tsx:138 runs at install).
- 5 s tail: the file takes ~6.7 s on main and at the head alike (pre-existing). `node --test` isolates each file in its own process (Node 24, default `process` isolation), so it cannot leak into other files.

## Findings

None.
