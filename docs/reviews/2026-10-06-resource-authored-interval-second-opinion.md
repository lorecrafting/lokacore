# Resource authored interval — independent second opinion

```text
Verdict: APPROVE
Reviewed source SHA: 7a51883b4f8b1ef8904f0ec84c7063791e2423a9
Integrated head SHA: 5f7ab50afc61b3768d7d7e6a7c26f8c02fdc9d7e
Findings: none. Open items: none.
```

Fresh Codex reviewer; authored none of the source. Review scope is the portable
resource invariant contract, authored interval and absent-field fallback, focused
regressions and existing differential proof. The integrated head has no additional
changes under `kernel/`, `lib/`, `test/` or `protocol/` since the reviewed source.

## Governing requirements

[Resource mechanics](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets)
and [composition](../system/protocol.md#composition) require counting crossed
boundaries of the effective spec's authored `gain_every`, retaining 3600 only when
absent. Independent replay must validate the same literal precondition without
calling composition's resource arithmetic. Entity override precedence, required
rows, opted fractional recovery, timestamp checks and successive row overlays must
remain intact. Each twin needs independent literal answers and the existing
randomized comparison after fixture validation.

## Findings and simplicity

- `kernel/ts/src/runtime/invariants_resource.ts:97` and
  `lib/loka/core/invariants_resource.ex:101` now use their composition twin's
  effective interval while keeping independent arithmetic. The change occurs only
  after opted recovery and existing row/time validation; no new machinery is added.
- `kernel/ts/test/calendar.test.ts:203` and
  `test/loka/core/calendar_resource_test.exs:16` use hand-checked answers: value 4
  stored at 95, gain 2 every 100, clock 205 yields 8; the debit writes 7. The literal
  result is checked independently against both the valid and forged stale `from`.
- `test/loka/core/compose_test.exs:340` changes only the randomized input copy,
  preserving fixture-based expectations. Valid-input generation uses composition,
  but the separate literal regressions prevent shared wrong interval arithmetic
  from passing solely through twin agreement.
- Ponytail Review: **Lean already. Ship.** No complexity findings.

## Independent verification

Commands used the pinned toolchain through `mise exec --`.

| Check | Result |
|---|---|
| `node --test kernel/ts/test/calendar.test.ts kernel/ts/test/compose.test.ts` | 22 passed, exit 0; restored run also 22 passed |
| `mix test test/loka/core/calendar_resource_test.exs test/loka/core/compose_test.exs` | 14 passed, exit 0, including 1000 seeded differential cases and 300 simulator proposals |
| TypeScript hour-only replay mutant, focused new regression | exit 1; actual `[false, true]`, expected `[true, false]` |
| Elixir hour-only replay mutant, `mix test --force test/loka/core/calendar_resource_test.exs` | exit 2; same reversed pair, new regression fails |
| Restored `mix test --force` on both focused Elixir files | 14 passed, exit 0 |
| Independent literal replay probes in each twin | 6 cases each pass, with forged `from + 1` rejected in every case |

The additional probes cover absent-field fallback at 3599 and 3600, authored gain
from an unset row, maximum capping, an explicit due-time settlement and an entity
override whose interval differs from the pool. Mutations ran in a throwaway detached
worktree; source was restored, focused checks rerun and that worktree removed.
This is a scoped second opinion; full publication checks and exact-head CI remain
the PM's delivery gates.
