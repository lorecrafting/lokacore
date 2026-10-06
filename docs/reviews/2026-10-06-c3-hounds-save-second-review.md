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

## Scoped fix round 1 — CHANGES REQUIRED

Source `8e767434425658d27e1b13f7da99744b09302015`; evidence `7b8292691c6b5e1a3574163c706bbb41d2ee8e91`. No source mutation or broad-suite rerun during this scoped review.

**S1 closed:** all six original population-only file forgeries and six bundled controls now refuse as typed `save_corrupt`, preserving altered file bytes. The retained isolated regression passes. **S2 partially fixed:** missing pelt, missing HP, room-born pelt and generation2 without membership now refuse; the literal complete pair and explicit nonfinal paired prefix pass.

**S2 remains a blocker — `kernel/ts/src/foundation/creation.ts:143`, `kernel/ts/src/runtime/invariants_creation.ts:96`, and the corresponding Elixir reverse slot checks.** Append a second slot operation to the new complete-bundle fixture: same newborn/member/ordinal/group, different full plan. Both composers and independent precondition invariants accept. The real loaded world's final `apply` and `adopt` also accept that duplicate foreign-plan membership. Reverse matching omits full plan equality. A standalone occupied slot with no newborn also passes its no-hounds exemption. This is the existing complete-bundle/membership finding, not a new scope request; the required Astra proposal audit independently found the same residual seam.

Five focused TypeScript/SQLite checks and three Elixir literal/prefix/differential checks pass. All ten retained evidence hashes verify and the evidence diff contains no source edits; its full gate passes but does not catch the residual membership case. Further source and evidence recheck remains pending.

## Scoped fix round 2 — APPROVE

Exact strict source `2dbf55b51cf7ae6bf930a550bb2dd61327a4127e`; retained evidence `ea3e39166a7acdb15f34a4cb9d5cf224270ba58f`. **S1 and S2 are closed.** No new save/protocol finding; the separate exact-source Astra proposal audit is approved.

Every final occupied/no-due slot now requires a fresh same-group hound with matching full plan, ordinal, generation and member ID in both composers and independent guards. There is no population-spec bypass. Foreign-plan extra membership, a second writer group's extra slot, and standalone assignment to an existing/nonexistent hound refuse. The original missing-pelt/HP, initial room-parent and unbound-generation cases continue to refuse. Independent controlled runtime `apply` and final `adopt` on the loaded chapter now reject the previously accepted foreign-plan duplicate. Literal full births, death/due rows and explicit nonfinal prefixes retain their respective admitted behavior. The two row-only examples now pin final refusal and separately retain their original nonfinal algebra rows, as the amended protocol requires.

- Nine focused TypeScript/SQLite tests and seven Elixir literal/prefix/differential tests pass; no broad suite rerun.
- All six original isolated-population file forgeries plus six bundled controls still return typed `save_corrupt`, with byte-identical altered files after real connection close/reopen.
- All twelve retained evidence hashes verify; the evidence head changes only evidence. Its full active check log reaches the passing formatting gate with 358 Elixir tests, and the retained eight isolated old-predicate controls are red/restored across both composers and independent guards.
- D2's published v026/v027 hash/ID files and C3's provisional hash/ID files remain unchanged from the original reviewed source. No final successor pin, publication or new browser/native claim.

Ponytail Review: the existing creation/receipt owners cover these fixes. Four direct predicates and explicit final/nonfinal composition suffice; no compatibility bypass, new ledger or dependency. This scoped approval closes only the save/protocol findings; primary Book findings and the final integration/publication gates retain their separate review ownership.

## Published B9 integration carryover — APPROVE

Exact merged source `f96e0245ab6086dacfaa276e338405f1710a0b8d`; evidence `33163a1bca6de9d8b5e0e0bf0cf45134542b77fb`; published B9 predecessor `b9dd1d9c80cf25d46823f0c3df28830e2af8afdb`. No new save/protocol finding. **S1/S2 remain closed.** Their history activation, full newborn membership predicates and final/nonfinal proposal boundary are unchanged from the approved strict source.

- Twenty-two focused TypeScript/kernel/SQLite checks and thirteen Elixir chapter-compiler/literal/differential checks pass. The compiler matches the independent v029 answer.
- A separate correctly hashed v029 file-backed control pays for the room, cold-opens every dream checkpoint, runs the real population wander while the dream choice is pending, then chooses/acknowledges the same branch and cold-opens the ended state. Exact branch receipt replay does not repeat effects. Forged dream root actor, Rest-event cause and population-receipt actor each yield typed `save_corrupt` after a real connection close, with byte-identical altered files.
- All twelve original isolated-population/bundled file forgeries still refuse without modifying bytes. The merged runtime's final `apply`/`adopt` still reject the previously accepted foreign-plan membership; malformed portable bundle controls remain red and lawful complete/prefix controls remain green.
- Independently reconstructed published B9 v028 plus the frozen C3 content delta yields `0.0.29`/API1.25, SHA-256 `f49de549377f7068fac51896ccd1f177241712ed064baaef0fefc14c6c05d67e`, and all 140 UUID answers. The real unmodified v029 `newWorld` matches every ID; B9/C3 text deltas do not overlap. Published B9 v028 and D2 v026/v027 hash/ID fixtures are unchanged.
- All thirteen retained C3 evidence hash entries verify, with no missing/duplicate target. The evidence head changes only README/hash inventory/full-check output; its retained active gate reports 360 Elixir tests and reaches passing formatting. No source mutation or full-gate rerun during this scoped carryover.

Ponytail Review: the merged save path continues to use one accepted-receipt replay and the existing dream/dialogue/corpse owners. No new machinery is requested. This approves the exact integrated source/pins and retained save/protocol evidence; hosted publication and any new browser/native proof remain separate claims.
