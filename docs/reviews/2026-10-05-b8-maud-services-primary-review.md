# B8 Maud services — independent primary source review

**Verdict: CHANGES REQUIRED.** Local branch `slice/b8-maud-paid-services`,
exact source `b183390acd6cc1662c4577eec567324dee02def2`, compared with combined
C2/Web base `65dabf5605bca7da3e0b6e35148986c3700d38ac`. Reviewer authored none of
this source. Review-only branch `review/b8-maud-primary-b183390a`; no publication.

## Requirements established from the governing clauses

The [brief](../briefs/chapter-one/b8-mauds-services-brief-2026-10-05.md) and
[mechanics](../system/mechanics.md#b8-mauds-immediate-services-selected-contract),
[tuning](../system/cartridge.md#b8-mauds-service-declarations),
[protocol](../system/protocol.md#b8-immediate-service-composition),
[save](../system/save.md#b8-service-recovery) and
[Book](../system/book-ui.md#b8-maud-and-bed-details) require:

- One exact original-provider/service/quote binding with shared keyed projection
  and execution admission; immutable prior state on refusal or fault.
- Conserved pennies and finite meal/provider-owned complete liquid consumption
  in the same proposal as immediate capped MV; no payment at full MV.
- Durable paid entitlement without rental-as-Rest, recovery or dream credit;
  ordinary unpaid Rest, movement, corpse routes and S1 remain reachable.
- Changed-row receipt transactions, accepted-history provenance, exact replay,
  all-old/all-new uncertain COMMIT and one provider-local confirmed Book line.

## Findings

1. **Blocker — source size ceilings are added or raised.**
   `kernel/ts/src/commands/actions.ts:1`,
   `kernel/ts/src/content/cartridge.ts:1` and `lib/loka/content/compiler.ex:1`
   add source-file allowances; `lib/loka/content/checks.ex:1`,
   `kernel/ts/src/view/view.ts:1`, `mobile/app/book/Book.tsx:1` and
   `mobile/app/book/model.ts:1` raise existing source-file ceilings. Function
   allowances are also added/raised in service/shared, view/services,
   view/notice_boards, cartridge_position and Menu. This lets the growing source
   pass size checks by increasing its limit, contradicting the explicit
   [frozen source ceilings](../CHECKS.md) at lines 46–48. Preserve existing source
   limits, simplify or split the affected source, and rerun touched size and
   behavior checks. The test-file allowance in `kernel/ts/test/sim.ts` retains
   the documented test escape hatch and is not part of this finding.

2. **Should-fix — duplicate capability declaration.**
   `protocol/capability_registry.json:453` appends `service@1` although that pin
   already exists. The two rows differ in command/definition ownership;
   generation emits duplicate catalogue rows at `docs/contracts.gen.md:38`
   and `:51`, while first-match and map consumers see different declarations.
   Extend the existing row with the new ownership fields, remove the duplicate
   and regenerate. Current runtime service tests pass; this finding concerns
   the authoritative registry's contradictory representation of one pin.

## Verification and simplicity

Actual source/composition, provider-bound stock, entitlement ownership,
compiler/loader short references, wire boundaries, initial pins, action aliases,
S1 coexistence, targetless bed Rest and Book/SQLite receipt recovery were inspected.
No further behavior or portable-foundation finding was found. No new delta op,
service table, effect interpreter or alternate history verifier is introduced.
Ponytail Review: the duplicate registry entry can be deleted after merging its
fields; source-limit fixes above remain required. No speculative machinery found.

- `mise exec -- node --test` on service, cartridge_services, service_contracts
  and authority service files: **13 passed**.
- Focused Elixir service compiler/contracts/current chapter files: **6 passed**.
- Kernel `npm run typecheck`, generated contracts and features checks: **pass**.
- Active v025 chapter simulation: **32 controlled seeds pass**.
- Commerce/liquid/resources/training/patrol, Book liquid and generic simulator
  regression files: **62 passed, 1 pre-existing failure**. The exact same
  `kernel/ts/test/sim.test.ts:135` invariant-coverage assertion fails on the
  reviewed base: the covered list lacks `patrol_transitions_hold`. Reproduced
  with `mise exec -- node --test kernel/ts/test/sim.test.ts` on both commits;
  reported to PM for the C2/publication lane, outside this source finding list.

Independent temporary mutations, each restored in the throwaway worktree:
`benefit.amount` → `benefit.amount + 1` fails three named service behavior tests;
removing the provider-cask custody check fails the refusal/whole-row rollback
case. Both runs use `mise exec -- node --test kernel/ts/test/service.test.ts`,
exit 1; the unchanged focused suite exits 0. Retained developer evidence separately
records eight behavior red controls and the 61 schema controls; generation and
cross-language fixture tests were rerun here.

No owner save, browser, native simulator, push or merge was performed. A separate
save/protocol opinion and the publication check line remain separate gates.
