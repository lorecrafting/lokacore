# Pre-polish audit C: protocol / portable foundation / Elixir (2026-10-08)

Base: `main` at `e38af110` (detached worktree, removed). Scope: `protocol/`, canonical
encoding and hash, numbers, RNG, IdSource, `lib/loka/core`, `lib/loka/content`, differential
TS-vs-Elixir tests. Governing: [protocol.md](../system/protocol.md) (Contracts, Numeric
profile), [numeric-profile.md](../spec/conformance/numeric-profile.md) (Frozen v1 rules),
[cartridge.md](../system/cartridge.md) (Compiler, Artifact and loader),
[architecture.md](../system/architecture.md) (Candidate C), [DIFFERENCES.md](../system/DIFFERENCES.md),
[contract lessons](../lessons/contracts.md), [check lessons](../lessons/checks.md).

## Must be true (written before reading code)

1. Both kernels emit identical canonical bytes and reject the same inputs: ASCII keys in byte
   order, `-0` to `0`, 16-digit safe range, lone surrogates, duplicate keys after escape
   decoding, depth 128 ok / 129 rejected, any value outside the profile `invalid_canonical`.
2. `hash` = SHA-256 of those bytes; the TS hand-rolled SHA-256 is right at padding edges.
3. Checked integers: operands before divisor, truncation toward zero, overflow typed.
4. RNG: xoshiro128** 1.1 transition, rejection sampling, budget, arg order bound/budget/state.
5. Id domains (`loka-id-v1`, `-command-v1`, `-job-command-v1`, `-elapsed-command-v1`), UUIDv8
   bits, typed errors identical.
6. Both validators: same codes and paths; `$` end-only; code-point lengths; `requiredUnless`
   lists identical across alternatives.
7. The Elixir independent precondition checker (`Loka.Core.Compose`) handles every
   `DeltaOp` kind and each handler has a test that fails when its check is removed
   (check lesson: the `expedition.transition` night-watch blocker).
8. Compiled artifacts load in TS with identical bytes/hash/lock; the compiler's depth guard
   accounts for the artifact's enclosing containers.
9. DIFFERENCES entries and `docs/system` pointers still name live code; no dead modules.

## Checked

- Read both canonical/int/rng/id_source/sha256 implementations and both `portable_abi` suites
  (1, 2, 3, 4, 5 hold; fixtures hash-pinned; 55/56/120-byte SHA vectors; large-map key order).
- Both validators (6 holds: `:dollar_endonly` and JS `$`; `code_points`; `schema.ex:128`
  forces one `requiredUnless` list). `bin/contracts.exs --check` exit 0 on this base.
- `mix xref callers` on 16 grep-unreferenced modules: all reached except `Loka.Core.IdSource`
  and `Loka.Core.Rng`, which ADR-071 requires in Elixir (fixture-held); not dead.
- Op coverage: every `DeltaOp` kind has an Elixir core handler; `expedition.transition` is the
  only kind absent from `test/loka/core` and `protocol/fixtures`.
- Mutant (restored afterwards): `lib/loka/core/compose_expedition.ex:8-9` precondition replaced
  by `if true and true` → `mix test test/loka/core --force`: 202 passed, 0 failures.
- `node`: `encode(new Map([['a',1]]))`, `new Set([1])`, `new Date(0)` → `"{}"`;
  `new Uint8Array([1,2])` → `{"0":1,"1":2}`; `Object.create({x:1})` → `{}` (no throw).

## Findings

| # | Severity | Where | Failure scenario | Fix | Before polish? |
|---|---|---|---|---|---|
| C1 | should-fix | `lib/loka/core/compose_expedition.ex:8` | The Elixir independent checker's expedition precondition has no red control: the mutant above (accept any expedition row: wrong `expected`, cursor jump, attempt reuse) passes all 202 core tests, the compose differential and the 300 simulator proposals (seeds 1.. early-game, no expedition). A regression in this rule, which already caused the night-watch blocker, is invisible to CI. | small: add `expedition.transition` cases (start, advance, shelter, fail, illegal cursor jump) to a composition fixture and the differential pool | yes |
| C2 | should-fix | `kernel/ts/src/foundation/canonical.ts:177` | `write` treats any non-array object as a plain map: a `Map`, `Set` or `Date` that reaches `encode`/`hash` becomes `{}` and a `Uint8Array` an index object, silently, where the profile says `invalid_canonical` and Elixir rejects a struct. A rule that leaves a `Set` in a state row (42 `new Set/Map` sites in `kernel/ts/src`) would commit a digest of `{}`. | one-liner: in `write`, `notCanonical()` unless `Object.getPrototypeOf(v)` is `null` or `Object.prototype`; one test row | can wait for RC |
| C3 | nit | `docs/system/DIFFERENCES.md:9-12` | Rows cite `ROADMAP: R12`, `P4b`, `SM2`, `P4A-2`, none present in `docs/ROADMAP.md` (0 hits); `authority.ts:146` now points at `drawn`, the null profile pins are at `:179`; `session.ts:154` is `lastNarration`, not Start over. Substance of each row still holds. | one-liner edits | can wait |
| C4 | nit | `docs/system/protocol.md:47`, `cartridge.md:324-330`, `:347` | Pointers drifted inside their files: `decision.ts:218` is a type (`Rule<C>`), `cartridge.ts:160` is `timeStage` (text says lock), `cartridge_cross_kernel_test.exs:113` is a comment (test at ~160). `check_docs` only fails past-EOF pointers. | one-liner edits | can wait |

## Questions

- `protocol/invariants.json`: `command_id_ignores_placement`, `retry_replays_receipt`,
  `idempotency_payload_conflict` are `implemented_in: none` and cited nowhere in `docs/system`,
  `lib`, `kernel/ts/src` or `mobile/authority` (only `registries_test.exs`). The mobile store's
  replay/conflict tests cover the behaviour; should the registry name the host suite or drop them?

## Verdict

HEALTHY WITH FINDINGS. The portable foundation holds the frozen profile on every input tried;
C1 is the one untested rule in the independent checker, C2 a cheap profile gap.
