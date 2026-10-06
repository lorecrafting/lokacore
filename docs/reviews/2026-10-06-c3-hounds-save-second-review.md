# C3 living hounds — independent save/protocol second opinion

Exact local source/evidence: `a692a2b8b83bdc16ed34aa5e41d4feec7a261a47`.
Reviewed independently in a detached worktree; authored none of the source.
Verdict: **CHANGES REQUIRED**. This supplements the primary review.

Requirements derived before source inspection: [C3 mechanics](../system/mechanics.md#c3-bounded-living-hounds-selected-contract), [spawn composition](../system/protocol.md#c3-spawned-bundles-and-population-composition), [recovery](../system/save.md#c3-living-population-recovery), [authoring](../system/cartridge.md#c3-hound-population-and-loot), and the [brief](../briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md).

- A complete birth binds exactly one fresh hound, its original pelt, HP and the matching slot/generation in one writer group. Prefix hydration remains permissible.
- Slot/control rows and receipts prove exact population ownership, occurrence and death-based replacement eligibility, independently of unrelated mechanics.
- Equal-time jobs retain distinct groups/canonical order; death conserves the original loot, and an advanced slot does not invalidate its old victim.
- Cold recovery and uncertain COMMIT preserve all-prior/all-next truth, refuse forged evidence as `save_corrupt`, and never repair or delete saves.

## Findings

**C3-S1 — blocker — `mobile/authority/local-story/liquid-save.ts:20` and `mobile/authority/local-story/receipt-save.ts:23`. Population-only saves never activate history verification.** The only history gates are vessels/services or exchange/patrol/readable/fuel. Population itself activates neither. The installed chapter happens to carry those other consumers; the opted population contract must stand independently.

Controlled reproduction: start from the provisional artifact, retain Hound Run/Adder Nest, its population/bundle/hound/pelt/corpse templates and ordinary resource/combat/death/calendar settings; remove unrelated consumers and reciprocal exits to excluded rooms. Recompute canonical SHA-256. The normal loader accepts the artifact. After its real SQLite wander receipt, independently delete one declared slot, add slot7 to cap6, forge the control job, delete a pelt identity while retaining custody, change the receipt actor, or remove its delta ops. Close the connection and reopen each file: all six return `open`; all bytes remain unchanged. The same six alterations to the bundled chapter return `save_corrupt` with unchanged bytes. Missing slot/current-job truth subsequently prevents lawful population dispatch; forged history is silently trusted.

Activate the existing receipt replay for opted population plans and retain an isolated population-only refusal regression. A population-specific replay bypass survives all 19 focused C3/composition/D2 SQLite tests, confirming that unrelated consumers currently hide this gap. This is the same seam independently observed by the primary reviewer.

**C3-S2 — blocker — `kernel/ts/src/foundation/creation.ts:60`, `kernel/ts/src/runtime/invariants_creation.ts:7`, `lib/loka/core/creation.ex:71`, and `lib/loka/core/invariants_creation.ex:26`. Complete spawned bundles have no atomic completeness/membership guard.** The unconditional room exception permits a spawned pelt's initial placement in a room, bypassing its exact new hound parent. Per-op validation checks an HP initializer or slot transition only when present; it never requires the bundle's other operations or binds a created generation to its slot.

Controlled reproduction uses the real birth operations and allocator on the loaded population-only world. For unused slot5/generation1, append its literal complete-prior slot transition, then either place the pelt in a declared area room or omit both pelt operations. For another case, emit a fresh slot1/generation2 pair without any slot transition although slot1 still contains its living generation1 member. Both TypeScript and Elixir compose return changes, and each independent `delta_preconditions_hold` returns true. The TypeScript final `adopt` accepts each whole proposal, so these are not permissible partial hydration reads. Removing HP also passes both portable composition/invariants, although runtime hydration correctly faults it.

Validate complete writer-group bundles at final admission while keeping lawful paired prefixes usable; pin accepted and malformed births with independent literal fixtures in both portable kernels. A bypass of generation matching in the independent paired-parent guard survives all 13 focused corpse-creation/population/hound tests, exposing missing malformed-spawn proof. This obligation comes directly from the active protocol contract and the brief's acceptance 4; generic room/cycle/capacity validation alone does not satisfy it.

## Independent checks

| Check | Observed result |
| --- | --- |
| C3 hounds/composition plus C3/D2 real SQLite baseline | 19/19 pass. |
| Elixir population literal/differential and chapter compiler | 8/8 pass with `mix test --force`. Compiler matches the independently frozen combined artifact; reciprocal-area and slower-wander rejection pass. |
| Four malformed complete-birth cases | Both portable kernels accept and report invariant true; three final runtime proposals accept, missing-HP proposal faults. |
| File-backed corruption matrix | Six isolated population-only cases wrongly open; six bundled cases correctly refuse; every refusal/open preserves the altered file bytes. |
| Real deferred-foreign-key failed COMMIT and lost successful COMMIT at night births | Memory stays all-prior while pending; settlement/retry produces one all-next twelve-identity state and one current plan successor; receipt retry and reopen preserve it. |
| Actual Attack/injury/fatal/Take and due replacement through SQLite | Each committed intermediate reopens; generation2 uses a fresh member while the same original pelt remains held. |
| Fatal-slot omission mutation | Focused hound suite fails; restored corpse/population/hound suite 13/13 passes. |
| Independent generation-parent guard bypass | Focused suite 13/13 remains green; mutation restored. |
| Population-specific receipt replay bypass | Focused suite 19/19 remains green; mutation restored. |
| Restoration | C3/D2 authority 9/9 passes; production source diff empty; generated contracts check passes. |
| Pins/evidence | Independent canonical SHA-256 and all 140 runtime genesis IDs match provisional `0.0.28`/API1.24 answer. Published D2 v026/v027 hash/ID files are byte-identical to predecessor `4bcb2eaf`. All seven retained C3 evidence hashes verify. |

The existing equal-time tests exercise both actual combat/population job-ID orders and pass; no conflict or loot loss found in the lawful producer. The two-kernel comparison here follows independent literal composition answers and separately probes malformed births; agreement alone is not correctness.

Ponytail Review: lean already; no additional dependency, scheduler, history ledger or speculative abstraction requested. Reuse the existing replay and creation/invariant seams. Findings remain open. Evidence/pins remain provisional; this review claims no hosted CI/publication, final release pin or new browser/native proof. The [retained handoff](../evidence/2026-10-05-c3-living-hounds/README.md) accurately keeps those gates separate.
