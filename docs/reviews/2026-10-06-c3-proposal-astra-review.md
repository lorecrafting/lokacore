# C3 proposal and complete-birth audit

Independent second opinion required by [the workflow](../WORKFLOW.md) for
`runtime/proposal.ts`. Initial source `8e767434425658d27e1b13f7da99744b09302015`,
evidence `7b8292691c6b5e1a3574163c706bbb41d2ee8e91`; corrected source
`2dbf55b51cf7ae6bf930a550bb2dd61327a4127e`. Authored none of the implementation.
Final verdict: **APPROVE**. C3-A1 is closed; no open findings in this audit's scope.

Requirements derived before inspecting source: [complete spawned bundles](../system/protocol.md#c3-spawned-bundles-and-population-composition),
[population membership](../system/mechanics.md#c3-bounded-living-hounds-selected-contract),
[save recovery](../system/save.md#c3-living-population-recovery), and the
[C3 brief](../briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md).
A birth binds the exact hound/pelt provenance, initial custody, HP and matching
slot/generation in one writer group. Intermediate proposal reads may use nonfinal
composition; complete adoption must enforce all birth evidence. Population itself
must activate receipt replay, with byte-preserving corruption refusal.

## Initial finding — C3-A1, blocker, closed

At `8e767434`, `kernel/ts/src/foundation/creation.ts:143` exempts a slot writer group
without a newborn; lines 146–149 also omit full plan and generation from reverse
membership. The same gap occurs at
`kernel/ts/src/runtime/invariants_creation.ts:98`, `lib/loka/core/creation.ex:115`
and `lib/loka/core/invariants_creation.ex:99`.

Independent controlled inputs reproduced three wrong final acceptances:

- Append to the literal complete birth a copy of its slot operation with only
  `plan.key = "other_hounds"`. Both plans claim the newborn.
- Append a second slot operation with `writer_group = 1` and `slot = 2` to the
  literal birth in group0/slot1. The newborn occupies two slots.
- Submit the occupied slot operation without any birth operations. The loaded
  runtime equivalent assigns an existing living hound to a never-used slot.

Both portable composers returned changes and both independent precondition checks
accepted the claimed success. On the real loaded C3 world, final `adopt` also
accepted an extra foreign-plan slot, a second slot in another group, and the
standalone assignment of an existing living hound. These were complete proposals,
not permitted unfinished prefixes. Baseline tests still passed.

## Corrected source and independent verification

At `2dbf55b5`, all four reverse guards require the same newborn's full plan, ordinal,
generation, member ID and writer group for every occupied/no-due slot operation.
The hound-free-group bypass is gone, with no population-spec compatibility bypass.
Never-used null-member rows and fatal rows with replacement deadlines retain their
separate valid shapes. Old row-only birth/replacement fixtures now pin final faults
and retain their algebra answers solely under explicit nonfinal composition.
Elixir runs final completeness after ordinary composition, preserving TypeScript's
fault precedence.

- All three independent malformed inputs now fault `precondition_failed` in both
  portable kernels; independent preconditions reject their forged successful rows.
  The complete literal birth still composes and satisfies both invariant checks.
- The same three loaded-world final-adoption probes now fault atomically; the valid
  slot5 birth succeeds. Final `adopt` calls `apply` with final validation enabled;
  only `now` uses the nonfinal path for proposal-local reads.
- Focused TypeScript spawned-bundle, population composition, hound mechanics and
  real-SQLite authority checks: **18 passed**. This includes lawful prefix
  composition, both equal-time delivery orders, night-only replacement, population-only
  forged-history refusal with unchanged bytes, unknown COMMIT, and fatal/Take reopen.
- Independently compiled Elixir spawned-bundle and population composition checks:
  **7 passed**, including literal answers and TypeScript differential checks.
- The population-only replay activation change remains correct: the existing
  receipt verifier runs even without vessels or services. No alternate history ledger
  or save repair was added.

This audit used controlled malformed inputs against both exact source revisions;
it did not edit production source or an owner save. Developer source-mutation
controls are separate evidence. No browser/native or hosted-CI claim is made.

Ponytail Review: lean already. The fix tightens existing guard seams and preserves
explicit prefix handling; no dependency, alternate scheduler, compatibility mode
or redundant persistence mechanism. Primary/save reviews and publication remain
separate gates.

## Published B9 carryover — APPROVE

Exact integrated source `f96e0245ab6086dacfaa276e338405f1710a0b8d`, evidence
`33163a1bca6de9d8b5e0e0bf0cf45134542b77fb`; published B9 predecessor
`b9dd1d9c80cf25d46823f0c3df28830e2af8afdb` is an ancestor. **APPROVE**, no new
findings. C3-A1 remains closed.

The proposal/apply paths, both composers, all four strict birth/slot guards and
population-only replay activation are byte-identical to approved `2dbf55b5`.
B9's fact ownership and Rest reaction changes retain their published source;
the combined runtime retains both population support and API1.25. No final-admission
exception or replacement of prefix handling was introduced by integration.

Independent focused verification on the exact integrated tree:

- **28 TypeScript/SQLite tests** pass across spawned bundles, population composition,
  C3 hounds and B9 dreams/recovery. **13 Elixir tests** pass, including both portable
  literal/differential suites and the authored chapter compilation against v029.
- All three retained malformed birth/slot probes still fault in both portable
  kernels; both independent invariants reject forged success. On the loaded v029
  world, final adoption refuses foreign-plan, cross-group duplicate-slot and
  birth-free assignments, while the valid slot5 birth succeeds.
- Both actual v029 paid Rest routes, `follow_fox` and `wake`, reach their final
  acknowledged quest outcome through ordinary commands and preserve every C3
  created identity and slot. These additional checks use the combined artifact,
  not B9's standalone v028 fixture.
- Python independently confirms canonical JSON and SHA-256
  `f49de549377f7068fac51896ccd1f177241712ed064baaef0fefc14c6c05d67e`;
  every one of the **140 labelled runtime genesis IDs** matches v029. All **13 C3
  evidence hashes** verify. The evidence-only commit changes no source; its retained
  full-gate log reports **360 Elixir tests passed** and reaches successful formatting.
  The full gate was inspected, not rerun by this reviewer.

Ponytail Review: no new complexity finding. This scoped carryover claims no browser,
native, owner-save, hosted-CI or publication proof; primary/save reviews remain
separate requirements.

## Final hosted source-head Astra review

The PM ran a read-only independent `codex exec` review after all six hosted checks
passed on PR #229 at `32514c83ef0c41896272a443af90f07c8e8e94ec`.
The output below is reproduced verbatim:
```text
APPROVE

PR #229 — head 32514c83ef0c41896272a443af90f07c8e8e94ec against base 257c9a8b6adae3dccfe09c60496274711178b6da.

Findings: none.

Correctness: final adoption enforces complete birth writer groups; nonfinal composition remains confined to proposal-local reads. TS/Elixir guards agree on full-plan, slot, generation, member and writer-group membership. Population-only receipt replay, forged-save refusal, night-only replacement, equal-time combat/population ordering, conserved corpse/pelt custody and receipt-bound Take/remount routing remain intact. No overlooked failure found in the reviewed B9 dream/paid Rest interactions. Source matches the previously approved integrated source.

Independent verification: 15 focused kernel tests and four Book tests passed. Five process-local, in-memory guard mutations produced the expected focused failures, covering composer/invariant completeness, reverse full-plan membership and birth-free occupied-slot refusal. No files were edited. Diff whitespace checks passed; working tree remains clean.

Elixir execution and file-backed save controls were assessed from source and retained primary/save/Astra evidence, not rerun. No broad suites ran; hosted CI status is supplied by the review request.

Ponytail assessment: lean already. Existing creation, scheduler, custody and receipt-replay mechanisms carry the change without a new dependency, duplicate ledger or speculative framework.
```