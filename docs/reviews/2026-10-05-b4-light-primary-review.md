# B4 — refillable light and safe dark recovery: independent primary review

**Verdict: CHANGES REQUIRED.** Three findings remain open.

- Source branch: `chapter-one/b4-light`.
- Exact source head reviewed: `909082b08680cba197839e0a83696f5606af3e35`.
- Remote PR: null; local draft cadence, no publication or integration verdict.
- Reviewer: fresh independent Codex primary; authored none of the source work.
- Governing brief: [adopted B4 brief](../briefs/chapter-one/b4-light-fuel-recovery-brief-2026-10-05.md), [PM selection](../decisions/pm-decision-b4-light-2026-10-05.md).

## Requirements derived before inspecting the diff

The [mechanic](../system/mechanics.md#b4-light-and-darkness-selected-contract),
[wire](../system/protocol.md#b4-fuel-composition),
[cartridge](../system/cartridge.md#b4-well-and-fuel),
[save](../system/save.md#b4-fuel-and-dark-recovery) and
[Book](../system/book-ui.md#b4-light-details) clauses require:

1. Exact per-item fuel history settles the old interval before a light operation. Burn is bounded, read-only and independent of custody. Source gain and compatible directly held supply debit form one atomic writer group; exhausted sources never reignite through refill.
2. A shared bounded illumination/visibility predicate governs view, targeting and admission. Ordinary inventory and public exits remain usable in darkness. Only the actor's actual corpses and accessible belongings receive the recovery exemption; normal lid/load restrictions still apply.
3. Confirmed item detail projects truthful available actions, ordered source/supply identities and fuel. Refuel belongs only to its source page, names the supply with “from”, and retains ordinary authored ActionSet contracts.
4. Compiler/loader reject invalid metadata and bindings. Portable fuel composition compares the complete prior row, validates bounds and preserves conflict diagnostics. The current release and identity answer must match actual source independently; API1.19 identifies the new interface.
5. The selected optional well adds no danger, main-route gate, mandatory wait or replacement gear. Small concrete splits must preserve existing semantics and introduce no new or raised source-size allowance.

## Scope and dependency comparison

Reviewed the B4 source introduction `86201ab5`, successor finalization `8c022695`
and final size cleanup `909082b0`, their actual changed source, and the final tree
against integration `1898dbb5`. The final head contains corrected B5, C1 through
`277925bb3fd8c9eb4ffc561e4ecf9ac907c8e2a0`, approved B3 cleanup
`0e0a0105f19ee60196de5aacd183a09d0d75a8b9`, and the Book guide source.
Integration-only review records/check repairs are outside B4's authored source.
The [developer evidence](../evidence/2026-10-05-b4-light/README.md) was treated as
claims to verify, not the requirement oracle.

## Findings

### B4-01 — blocker: Refuel aliases leak onto the supply page

**Location:** `mobile/app/book/model.ts:110`, also `:273`.

An independently constructed, schema-valid cartridge action `top_up` resolves to
`refuel`, using the inventory target scope, no input and an always-true policy.
With the directly held torch at 7197/7200 and its exact held oil bottle, the loader
accepts it, GameView supplies `[torch, oil]`, and keyed execution accepts the
command. Book nevertheless labels it `Refuel a torch in a flask of lamp oil` and
lists it on both the torch and bottle detail pages. Both special cases compare
`action_key === 'refuel'`, although action identity may differ from its resolved
command. This violates B4's explicit source-only detail ownership and “from” label.

Make ownership and participant wording follow the projected semantics without
assuming an authored action key equals an engine verb. Preserve the existing
ordered target pair; no new selector is required. Add a focused alias regression
that catches both the supply-page leak and wrong relation word.

### B4-02 — blocker: light projection bypasses the authored target contract

**Location:** `kernel/ts/src/view/action_lists.ts:112`.

The light branch in `entityOffered` checks physical transition eligibility but
ignores the selected ActionDefinition's target/input admission. Two independently
loaded `kindle` actions resolving to `ignite`, one with `target: {kind: 'none'}`
and one with `target: {kind: 'entity', scopes: ['room_contents']}`, are each
advertised `available: true` on a directly held torch with its concrete target ID.
Invoking that exact advertised action then receives keyed
`unsupported_capability`, because normal admission correctly rejects that target.
This contradicts the [ActionSet/admission](../system/protocol.md#actionset-and-admission)
and GameView contract that offered available controls are currently legal.

Use the same keyed admission as execution as well as the existing pure light
transition. Cover a loaded narrowed light action; a happy-path engine-key test
cannot catch this break. Check the worn-source caller too, since it enters the
same branch.

### B4-03 — should-fix: fuel/darkness do not enforce the API1.19 floor

**Location:** `lib/loka/content/fuel.ex:24`, `kernel/ts/src/content/cartridge_fuel.ts:4`;
also the existing minimum-feature API checks.

Changing only the real chapter's `requires.kernel_api.at_least` to `1.18` still
compiles successfully. Rehashing that compiled-equivalent artifact also loads
successfully with `Installed.kernel_api: '1.18'`, despite its API1.19 fuel rows,
commands and darkness fields. Both compiler and loader already enforce API
floors for other introduced authored features, but neither includes B4. This
allows a cartridge to declare compatibility with an interface predating its wire
shape instead of receiving `KERNEL_API_RANGE_INVALID` at the lower-bound field.

Enforce the selected floor for actual authored fuel/darkness in both boundaries,
with controlled lower-API checks and deterministic diagnostics. Keep frozen
fixtures that merely declared the previously reserved `light` capability intact;
this finding concerns the new authored fields, not an unused capability lock.

## Independent verification

All commands used the pinned mise toolchain. Passing checks:

- Full kernel suite: `node --no-warnings --test --test-reporter=dot 'kernel/ts/test/**/*.test.ts'`, 582 passing tests, exit 0.
- Focused `light`, portable fuel/contracts and real SQLite/Book suites: 16/16 pass, exit 0. SQLite includes lawful custody history, failed/unknown COMMIT, exact retry, corruption, light-only replay and cold dark corpse recovery.
- `mix test test/loka/content_light_test.exs test/loka/core/fuel_test.exs test/loka/core/light_contracts_test.exs`: 5/5 pass, exit 0.
- Kernel typecheck, generated contracts check, Elixir size and kernel/script TypeScript size: exit 0.
- Actual chapter compilation equals the independently pinned v021 payload and hash. Running the Python oracle reproduces hash `a274bb1c6b22306718648bbcb1b967ee017e0420b62589afe10e1009434dbbfa` and all 94 identities byte for byte.
- Independent loader mutations for overfilled source, incompatible supply, mismatched unit and unresolved dark text each return the hand-specified diagnostic code and exact path.

In a separate disposable detached worktree, removing the supply debit made two
focused fuel tests fail (exit 1). Removing the owned-corpse visibility exemption
made the real lethal-combat recovery test fail (exit 1). Both changes were exactly
restored; the seven focused kernel light tests then passed and the source diff
was empty. The alias and lower-API cases above are additional independently run
controlled failure scenarios, not source-text assertions.

## Correctness and Ponytail Review

The ordinary chapter path, settled burn arithmetic, source/supply custody,
public stair, exact corpse ancestry, changed-row adoption, whole-prior-row
composition and receipt replay match the selected contract in the examined
paths. No gameplay, conservation or recovery defect was found beyond the
listed authored-action and compatibility cases.

The final splits preserve resource diagnostic ordering, lazy quest overlay
reads, row addressing, independent validation and existing projection behavior.
They are concrete operations rather than a configurable registry or speculative
framework. No new or raised B4 source-size allowance remains against the
corrected integration baseline. **Ponytail Review: no complexity finding;
net 0 additional lines identified for deletion.**

Full accumulated publication checks, schema mutant sweep, hosted CI and browser/
native acceptance are not claimed by this review. The separate portable/save
opinion remains its own requirement. Source approval requires closure of
B4-01, B4-02 and B4-03 at an exact fix head; no merge or push was performed.


## Scoped fix round 1 — APPROVE

**Exact source reviewed:** `a3f9897643b01f53707d04a62f51b4073eadcc25`.
**Verdict:** APPROVE. B4-01, B4-02 and B4-03 are closed; no new finding.
The initial review and its historical findings above remain intact.

Scope was the actual fixes since `909082b08680cba197839e0a83696f5606af3e35`,
their direct callers and the corresponding authored-action, wire and API-floor
requirements. The [fix evidence](../evidence/2026-10-05-b4-light/README.md#scoped-review-fix-round)
and [developer red controls](../evidence/2026-10-05-b4-light/review-fix-red-controls.json)
were read separately from the independent checks below.

- **B4-01 closed.** Light projection supplies its resolved semantic `command` while retaining the authored invocation identity. Book reuses `detail_id` to give Refuel one source owner and uses that command for “from” wording. An independently constructed, loaded `top_up` alias now belongs only to the torch page, has label `Refuel a torch from a flask of lamp oil`, and retains `[torch, oil]`. Passing its actual button through invocation identification/resolution and keyed execution accepts it and leaves literal fuel rows 7200/7197. Existing Book model callers pass.
- **B4-02 closed.** The exact candidate now passes keyed ordinary `refusal` before the pure light transition. The immutable supply lookup adds no transition or alternate admission logic. Loaded targetless, room-only and unused-input aliases are unavailable on held and worn sources; targetless light controls are also excluded from World. Existing engine-key worn Douse/Refuel and darkness/corpse paths remain green. Target/input narrowing agrees with execution, including the direct callers of the new helper.
- **B4-03 closed.** Both compiler and loader impose 1.19 only on actual fuel/darkness fields, independently covering fuel-only, darkness-only and neither. API1.18 returns the literal lower-bound diagnostic path for actual light fields; the unused reserved light lock still succeeds. Elixir takes the standard maximum with its prior feature floor, preserving a higher requirement. The original independently run low-API artifact probe now returns `KERNEL_API_RANGE_INVALID` at `.cartridge.manifest.requires.kernel_api.at_least`.

Independent passing commands, all under pinned mise:

- `node --no-warnings --test --test-reporter=spec` over kernel light, fuel composition and light contracts; authority light and light Book; Book model: **30/30**, exit 0.
- `mix test test/loka/content_light_test.exs test/loka/core/fuel_test.exs test/loka/core/light_contracts_test.exs`: **6/6**, exit 0.
- Kernel typecheck, generated contracts check and touched kernel-source size check: exit 0. No source-size allowance was added or raised.

Three independent disposable mutations were run at this exact fix head:

1. Restore authored-key checks for Refuel ownership/wording: the engine-key Book test passes, while the new loaded alias test fails, exit 1.
2. Skip only keyed light admission: seven existing light tests pass, while the new narrowed target/input test fails, exit 1.
3. Lower the loader's actual-light API floor to 1.18: the wire-literal test passes, while the new feature-floor test fails, exit 1.

All mutations were exactly restored; the combined affected suites passed 12/12
and the disposable source diff was empty. The mutation worktree was removed.
The reviewer introduced no source or test change. The independent Elixir
fuel-guard extension from the separate opinion was inspected and exercised in
the passing core suite; that opinion owns B4-S1's scoped disposition.

The optional semantic command crosses no saved mutable row or invocation identity.
Its shared valid/invalid wire cases, generated types and direct Book consumer agree.
The fix reuses ordinary admission and existing UI ownership metadata; **Ponytail
Review: no complexity finding, no new framework or alias catalogue**. No new
regression was found within the fix scope. Accumulated publication checks,
separate portable/save approval and hosted/browser/native gates remain separate;
this is exact-source primary approval, with no merge or push performed.
