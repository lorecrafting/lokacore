# Resource authored interval — independent review

- Source: `fix/resource-authored-interval`, `7a51883b4f8b1ef8904f0ec84c7063791e2423a9`.
- Base: `747c252dc25b37046d482c4a51493d16d70e0378`.
- Reviewer: fresh Codex agent; authored none of the source; separate review worktree.
- Verdict: **APPROVE**. No findings or open items.

## Governing requirements

[Resource mechanics](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets)
and [composition](../system/protocol.md#composition) require the effective spec's
legacy `gain_every` boundaries, a 3600-second fallback when absent, and independent
precondition replay. Opted recovery, entity override precedence, timestamps and
row validation must survive. The [portable foundation contract](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)
requires literal answers in each kernel plus randomized differential proof.

## Review result

- `kernel/ts/src/runtime/invariants_resource.ts:97` and
  `lib/loka/core/invariants_resource.ex:101`: both count the authored interval from
  the effective spec, preserving the hour fallback. Existing independent arithmetic,
  required override rows, opted recovery and temporal checks remain intact.
- `kernel/ts/test/calendar.test.ts:203` and
  `test/loka/core/calendar_resource_test.exs:16`: stored value 4 at 95, gain 2 / every 100
  and clock 205 cross two boundaries, yielding literal from 8 and debit result 7.
  Both kernels independently require `[true, false]` for valid from 8 and forged
  from 4 against the literal result. Composition is checked against that result;
  neither its output nor the other twin computes the expected answer.
- `test/loka/core/compose_test.exs:340`: only the randomized input copy receives
  every 100. The frozen fixture and fixture-based expected results are unchanged.
  Generator use of `Compose.current` helps generate valid inputs; separate literal
  tests prevent shared arithmetic errors from hiding behind differential equality.
  The 524-line test allowance is justified: splitting this four-line input extension
  would duplicate or relocate the existing generator/peer machinery without a new seam.
- Ponytail Review: lean already; no abstractions, dependencies or removable machinery.
  No persistence, save schema, release pin or owner-save access is changed or required.

## Independent verification

All commands used the pinned toolchain through `mise exec --`.

| Check | Result |
|---|---|
| `node --test kernel/ts/test/calendar.test.ts kernel/ts/test/compose.test.ts` | 22 passed, exit 0; restored run also 22 passed |
| `mix test test/loka/core/calendar_resource_test.exs test/loka/core/compose_test.exs` | 14 passed, exit 0; includes 1000 seeded cases and 300 simulator-proposal differential cases |
| TypeScript old-constant mutant, focused new regression | exit 1; actual `[false, true]`, expected `[true, false]` |
| Elixir old-constant mutant, `mix test --force test/loka/core/calendar_resource_test.exs` | exit 2; same reversed pair, one regression fails |
| Restored `mix test --force` on both focused Elixir files | 14 passed, exit 0 |
| Independent absent-field boundary probes in each twin | four assertions each pass: value 4 at 95 stays 4 at 3599, becomes 6 at 3600; each forged from + 1 is rejected |

Both mutations were exactly restored; `git diff --exit-code` was clean before the
review record. No full gate was rerun during this focused review. Publication and
any separately required second opinion remain PM-owned.
