# D10 independent foundation and composition opinion

**Verdict: APPROVE, scoped to foundation and composition.** Initial candidate
`806bfe4f3a507fad21b4da793518031ab0300f3b`; final scoped fix reviewed at
`8a4b8b04b7ab183e86fe791e112320aed965d50c`, against published main `8dbd14bb`.
Fresh reviewer authored none of the implementation. Browser, content publication pins,
authority review and the final full gate remain separate.

## Requirements derived before reviewing code

- [D10 protocol](../system/protocol.md#d10-knowledge-and-knock-composition): actor/target identity, insert-only visits, complete observation prior rows and monotone time; causal entry/Look evidence; one final knowledge writer group.
- [Composition](../system/protocol.md#composition): atomic conflicts and unchanged due-job ordering, including the narrow deer, bleed and population exceptions.
- [Architecture](../system/architecture.md#building-mechanics-by-composition): one knowledge owner reused by actual entry consumers, changed-row adoption and structural sharing, independently checked portable semantics.
- [Brief](../briefs/chapter-one/d10-map-where-knock-brief-2026-10-05.md): visible observations only; failed movement and projection create no knowledge; actual death return discovers Chapel.

## Finding and scoped disposition

**F1 — should-fix, closed.** At the initial candidate,
`kernel/ts/src/runtime/invariants_knowledge.ts:22` and
`lib/loka/core/invariants_knowledge.ex:27` accepted counterfeit successful observation
composition over a present-null stored row; Elixir also accepted a null visit.
The composers correctly refused these inputs, but the independent
`delta_preconditions_hold` guard confused absence with null. Reproducer: use each
frozen `null-*-is-not-absence` case and supply the corresponding literal successful
fixture's `changes` as the result. Expected invariant result is false. Initial
TypeScript results were false/true for visit/observation; Elixir returned true/true.

Fix `8a4b8b04` explicitly rejects null and preserves a missing sentinel in Elixir.
The new tests use existing literal fixture answers, independently of composition.
Reviewer reran the negatives and the portable differential: TypeScript 2/2 and
Elixir 14/14 pass. The retained original-defect red runs fail the new negative in
each kernel; old focused suites pass, so this catches a distinct guard failure.

## Verification and overlap review

- Initial portable fixture/differential run: 13/13 Elixir tests pass. Knowledge cases join the existing randomized cross-kernel pool; original frozen fixtures remain intact.
- Focused TypeScript knowledge, deer, bleed, bleed/death and water run: 43/43 pass. This includes current-chapter deer round/sight handoff, harmless sight/population rebind, and unrelated-writer conflict controls.
- Additional controlled run enables knowledge in the existing bleed fixture: both canonical bleed/round orders accept, retain entry visits, and finish with literal HP 6.
- Additional portable controls: different actors remain separate targets; a sequential same-group observation update succeeds; the same update from another writer faults `conflicting_write`.
- Traced entry detection through exact owned-body transfers and death cleanup; traced final knowledge grouping against population deadline pairing, bleed pairing and sight handoff. Nonknowledge order/group identity stays intact; no new conflict exemption or mechanic-specific entry writer was introduced.
- Read developer identity/grouping mutation evidence and verified the source evidence SHA256 manifest, including F1. No source was mutated by this review; the reviewer independently demonstrated F1 through controlled forged-success inputs before its fix.
- Inspected intervening `b8c4e8ec`: source-reference test updates only. No new foundation change.

Ponytail Review: lean already; no deletion request. No dependency, migration,
parallel state writer, or whole-state copy was added by the reviewed foundation changes.
No open finding in this scope.
