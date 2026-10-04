# M5-B: durable corpses and same-body shrine return — independent review

PR [#167](https://github.com/lorecrafting/lokacore/pull/167), source head
`288cee06c2cc345b2c8fd0650254972d5f370989`.
Primary reviewer authored none of the implementation or its planning.

**Verdict: CHANGES REQUIRED.** Two regression-proof gaps remain. The inspected
production implementation satisfies the bounded foundation contract; neither finding
claims an observed production failure at this head.

## Requirements derived before reading the implementation diff

The formal M5-B brief, [first-encounter contract](../spec/conformance/first-encounter.md),
and amended [mechanics](../system/mechanics.md), [protocol](../system/protocol.md),
[cartridge](../system/cartridge.md) and [save](../system/save.md) clauses require:

- Immutable created identity and adjacent absent-source initial room placement, fresh
  across pinned and saved identities, with matching writer group, template and provenance.
  Both portable implementations and independent invariants must prove these conditions.
- One fatal sequence preserves nested custody, transfers only direct held/worn item roots
  in EntityId order, retains slot holders, and returns the same body with configured
  restoration, correct position settlement and unchanged unrelated story progress.
- Fixed corpses and owner-only player-corpse contents are enforced by authority and
  projection. Explicit HP-zero NPCs lose living eligibility, including raw-ID routes.
- Created rows use the existing atomic changed-row transaction and receipt. Adoption,
  reopen and uncertain-COMMIT reconciliation hydrate from pinned templates; failed or
  unknown writes expose no partial corpse, possession loss or premature return.
- Prior fixtures retain their meaning and hashes. New content is gated by API/release
  pins. Live encounter production, closure before revival and native consumer proof remain
  M6 work, the first playable encounter, rather than a foundation claim.

## Findings

### M5B-R1 — blocker: independent provenance checks have no effective red control

`kernel/ts/test/corpse_creation.test.ts:21` and
`test/loka/core/corpse_creation_test.exs:17` substitute the first valid fixture's
result for every invalid proposal. For wrong-owner, wrong-template and wrong-victim
cases, that result also contains a different identity from the proposal. The independent
checker rejects the unrelated identity mismatch even if its provenance check is deleted.

Observed mutations: remove the `provenance` check at
`kernel/ts/src/runtime/invariants_creation.ts:36`, and independently remove
`provenance?(s, i)` at `lib/loka/core/invariants_creation.ex:55`. The TypeScript kernel
and local-authority suites stay green; the Elixir corpse/composition suites stay green
(14 tests). A concrete counterfeit success result whose identity matches its proposal
but assigns the player corpse to a different owner returns false from both independent
invariants normally and true after the TypeScript mutation.

Add controlled counterfeit-success observations whose emitted identity/custody rows
match the proposed rows, isolating invalid provenance as the reason for rejection.
Exercise both `delta_preconditions_hold` and `one_container_per_item` in both twins,
and show each provenance guard mutation red. Do not derive expected validity from
composition or compare only the two implementations.

### M5B-R2 — blocker: the fatal-sequence test does not protect transfer order

`kernel/ts/test/death.test.ts:15` checks final custody and restoration but never the
ordered transfer roots in the proposed delta. Replacing `roots.sort(cmp)` with
`roots.sort(cmp).reverse()` at `kernel/ts/src/mechanics/death/sequence.ts:96` passes
the focused death/storage tests and the complete kernel/local-authority Node suites.
Final containment is unchanged, while the frozen EntityId ordering and thus ordered
proposal/receipt bytes are wrong.

Extend the existing controlled death case with an independently specified literal
ordered list of root EntityIds and their actual source holders. Assert that portion of
the proposed delta and show the reverse-order mutation failing; keep the nested child
and slot-holder preservation assertions.

Both are blockers under the repository reviewer instruction to test the tests: a core
logic mutation that leaves the suite green must be repaired before approval.

## Verification and scope

All 77 changed files were inspected by file/hunk; generated schema data and release
fixtures were also compared structurally. The old sampler 0.0.7 fixture is byte-identical
to the prior sampler fixture. Independent Python SHA-256 calculation reproduced the
literal death EventId and corpse EntityId; the sampler oracle regenerated without a diff.
`elixir bin/contracts.exs --check` passed.

Commands used the pinned toolchain. The focused TypeScript death/content/portable/
SQLite run passed 12 tests. The complete kernel and local-authority Node run passed
633 tests with one existing skip (634 total). The selected Elixir portable creation,
composition, content compiler and cross-kernel tests passed 18 tests after restoring
mutants. The schema sweep was rerun: all 46 mutants were rejected. SQLite coverage
uses real FULL, failed deferred-constraint COMMIT and committed-but-unacknowledged
COMMIT, including input/elapsed fences and all-prior/all-next reopen.

Independent initial-placement writer-group and restoration-amount mutants were killed.
The two findings above survived. A combined run containing the TypeScript provenance,
reversed-root-order and intermediate-hydration mutations also passed the complete
kernel/local-authority suites. All temporary source mutations were restored.

Reverting only intermediate `proposal.now` hydration also survives current tests. No
current authored reaction or due-job consumer was found that observes the new corpse
entity definition before final adoption; demanding a source-shaped test would not prove
player behavior. Retain an explicit M6 integration obligation to observe hydrated
created entities between deliveries, alongside the existing live lethal-producer,
encounter/job closure, RNG and native consumer obligations. This is a proof boundary,
not a third production finding.

Ponytail Review: lean already. Existing composition, transaction, reconciliation,
resource settlement and custody mechanisms are reused. No dependency, alternate save
service, general spawner or speculative registry was introduced; no complexity cut found.

No native build, device run or owner-save operation was performed or claimed.

## Separate second opinion (Sol, verbatim)

```text
APPROVE — PR167, M5-B durable corpse custody and same-body shrine return
Reviewed head: 288cee06c2cc345b2c8fd0650254972d5f370989

Findings: none.

Verified:
- Fresh identity collisions, adjacent initial placement, writer-group guards and nullable contracts.
- Held/worn root transfer preserving nested custody; same body/character, restoration and story state.
- Intermediate/final hydration, owner-only recovery, fixed corpses and dead-NPC refusal.
- Existing release compatibility, atomic receipts, genuine failed COMMIT, unknown COMMIT fencing and reopen.

Executed: 12 focused TypeScript tests; 72 focused Elixir tests, all passed. Additional controlled probes passed for carrying-disabled corpse refusal, two-corpse reopen and every pinned identity collision kind.

Complexity: Lean already. No removable machinery identified; existing composition, custody, resource and transaction paths are reused.

Scope: M6 — live encounter producers, encounter closure and native combat proof — remains explicitly required. No source mutation testing performed under this read-only assignment.

No source edits, review records or heavy hooks. Owner checkout preserved.
```

The PM separately relayed an Astra audit of the proposal changes at the same source
head: APPROVE, 53 focused tests passed, and a mutant restoring the old final-adoption
behavior was killed. That audit's scope differs from the primary surviving intermediate
hydration experiment. These separate approvals do not close M5B-R1 or M5B-R2.
