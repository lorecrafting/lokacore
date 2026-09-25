# Independent review: PR #23 "Pre-R4 sweep: Elixir + scripts"

- Reviewed commit: `c1e8b18` (branch `sweep-elixir`, six commits over `main` at `32f6af5`)
- Reviewer: Claude Opus 5.5 (fresh agent; authored none of the work)
- Date: 2026-09-25
- Depth: proportionate (cleanup, no intended behavior change): nothing broken, nothing
  lost, actually clearer.
- Checks run in a detached worktree at `c1e8b18`: `bin/check_all.sh --no-ts` green
  (format, compile, `contracts --check`, xref cycles and compile-connected, 113/113 tests,
  credo, check_size, 18/18 red controls, ast-grep, lint red controls, check_docs). CI green.

## What must be true

1. The shared guard accepts exactly the integers the four `@safe` copies accepted, in guard
   and body position, at every call site; no new compile-time edge breaks xref.
2. Tests assert the same things with the same random draw order.
3. Removed check_size patterns and the formatter glob could never match anything.
4. `red_controls.exs` runs every control it ran before and exits 1 when any fails.
5. `bin/contracts.exs` generates byte-identical files and still stops on the ADR-074
   trigger.
6. No vendored or generated file changes.

## Verdict: APPROVE WITH NOTES

Every point holds. One nit.

## Verification

- **Guard.** `defguard is_safe_integer(n) when is_integer(n) and abs(n) <= @safe` is the
  old Int `safe/1` verbatim. Per site: Canonical parse (`n` already an integer; `abs(n) >
  @safe` throws ⇔ guard false) and `enc/2` identical; Contracts `is_integer(v) and v in
  -@safe..@safe` ≡ guard (symmetric range); IdSource `is_integer and in 0..@safe` ≡ guard
  `and >= 0`; Int `check/1` gets integers only, so the added `is_integer` is a no-op.
  Canonical has no dependencies, so the new compile edges (Int, IdSource, Contracts →
  Canonical) cannot form a cycle or a compile-connected chain; both xref checks green.
  Mutants: guard `@safe + 1` fails `PortableAbiTest` and `ContractsTest`; IdSource
  `>= 0` dropped fails 1/113.
- **compose_test.** `@hub` is the same literal. `protocol/fixtures/composition.json`
  base capacities has exactly one key (`30000000-…`), so `Map.new` over it makes one
  `pick(0..1)` call as before: same state, same draw order, same assertions.
- **Dead code.** check_size filters candidates to `.ex`/`.exs` before classifying, so the
  `kernel/ts/test/` and `*.test|spec.*ts` alternatives never matched. No `config/`
  directory exists. The size red control still passes.
- **red_controls.** Same 18 controls, same predicates, same order. Planted a wrong
  expectation on "boundary: core calls an undeclared external app" and disabled the
  ADR-074 filter in `contracts.exs` (`portable_capabilityX`): both reported FAIL, others
  ok, exit 1.
- **contracts.exs.** `--check` exits 0 and no `*.gen.*` file differs from `main`.
  Planted `host_adapters: ["elixir"]` on `movement@1` in a registry copy:
  `movement@1: elixir host adapter without a present differential (ADR-074)`, exit 1.
  `decl`/`type` private, `ts/2` and `lit/1` public (both used outside `Gen`), with specs.
- **@spec** `main([String.t()]) :: [:ok]` matches the `for` over `IO.puts`.
- **Vendored docs.** `docs/conventions/phoenix/*` identical to `main` (the accidental sync
  run was fully reverted); the branch changes no file under `docs/`.
- **Parallel sweeps.** No file overlap with #21 (`sweep-ts`) or `sweep-docs`.

## Findings

1. Nit, `bin/contracts.exs:85` and `:195-205`. The header and the "Inputs" section suggest
   the inputs are read in one place, but `faults`, `limits` and the subset `probe` are now
   read under "Write or check". Scenario: someone adding an input or looking for where
   `error_registry.json` is read looks under Inputs and misses it. Moving the three
   reads back under Inputs (after the trigger is fine either way) fixes it. The move also
   put the probe decode after the ADR-074 halt; harmless.

## Proposed, not done

1. "proposed ADR-072" in `ts-kernel-pure.yml` and `ELIXIR-CONVENTIONS.md`: already fixed on
   `sweep-ts` and `sweep-docs`. Nothing to do.
2. Phoenix v1.8.15 refresh: header-only change; skip until the bodies change.
3. `__tests__/` in check_size: agree to leave; dropping it means rewriting a red control
   for no gain.
4. `exports: []` on boundary stubs: correct today; the first cross-boundary call adds
   exports as part of that slice. No action.
5. Moving the decode-rejection test to portable_abi_test: agree to leave; marginal.
