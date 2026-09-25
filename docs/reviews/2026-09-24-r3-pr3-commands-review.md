# Independent review: PR #13 "R3 PR 3: action/command/delta/event/effect contracts, policy AST, TargetResolution, invariant registry"

- Reviewed commit: `cfc6a14` (branch `r3-pr3-commands`; three commits on `main`)
- Reviewer: Claude Fable 5.1 (fresh agent; authored none of the work; Fable because the slice
  freezes the core semantic contracts)
- Date: 2026-09-24
- Depth: full (contract freeze), per [WORKFLOW.md](../WORKFLOW.md) "Review stance"
- Checks run in a detached worktree at `cfc6a14`: `bin/check_all.sh` end to end, exit 0 after
  `npm ci` in `mobile/app` (74 ExUnit tests, 25 TS tests, contracts drift, xref, Credo, size,
  red controls, ast-grep and lint controls, docs, Prettier, mobile `tsc`).

## What must be true (derived from the spec before reading the diff)

From 14 §R3A and Gate R3; 04 §1-§5.5, §7, §8, §10, §11, §18, §19, §21; 03 §14, §15, §23; 01 A9;
06 §1, §19-§21; 21 §3.2, §3.3, §4, §7; ROADMAP "Verification harness"; pre-release-proof.md:

1. ActionInvocation is `invocation_id, action_key, actor_id, target_ids, input,
   view_freshness_token`; `target_ids` keeps its order (03 §14 "do not sort a target list whose
   order is meaningful"); the token is admission metadata, not intent; unknown fields fail
   (03 §14) so every contract is closed (04 §1, §2, §16).
2. The portable Command excludes host-only CommandContext (session, timestamps, expected
   revision) (04 §3, §21); its id derives from idempotency scope + InvocationId and never from
   placement (04 §3, 03 §14). Authority-internal commands are registered types with their own
   stable idempotency identity (04 §1, 03 §14). Unknown types fail before rules (04 §3).
3. CommandId is a UUIDv8 from the first 16 bytes of SHA-256 over canonical
   `["loka-command-v1", idempotency_scope_id, invocation_id]`, version and variant bits as
   IdSource; both kernels plus a known answer computed independently of both (owner decision).
4. StateDelta (04 §5.1, §5.3): every op is a registered type with a canonical mutation target;
   ops carry what they read and write; preconditions are explicit for fact assign (expected
   value), transfer (source, destination, capacity, acyclic), lifecycle (named transition),
   choice (pending, exactly one), job (identity, due time strictly later, 04 §5.4); order is
   semantic, never map or arrival order; a coordinator-assigned writer group; no last-writer-wins;
   canonical serialization. The shape must let PR 5 implement composition without changing it.
5. DecisionResult (04 §5, §5.0, §5.2 step 7): accepted carries delta, proposed events, effects
   and next RNG plus a typed outcome (a failed attempt is accepted); rejected carries a
   GameError and consumes nothing; a fault discards the whole proposal.
6. DomainEvent (04 §8, §5.2 step 5, §11): id, type, world context, semantic scope (not an
   audience), actor, subject, logical time, causal position, causation, correlation, registered
   payload. A proposed event and a committed event are distinguishable shapes (04 §5.1).
7. Effects (04 §10, 03 §16): durability, idempotency requirement, retry, terminal policy for
   durable, allowed origin capabilities, schema; at-least-once, never "exactly once".
8. Policy AST (06 §21, 21 §3.2, 14 §R3A): typed, fail-closed, versioned; `all/any/not` plus
   leaves; `quest_state` is the persisted 06 §1 lifecycle (active, objectives_complete,
   resolved, failed, abandoned). Recursion behaves the same in both validators.
9. TargetResolution is `none | unique(target) | ambiguous(candidates)`, deterministic, no random
   tie-break (21 §7, 04 §18); ambiguous order is stated once (PM ruling).
10. ActionDefinition: key, label, target kind, command, priority, input schema, policy,
    accessibility (04 §19, 06 §20); cooldown/cost hints may wait.
11. Invariants are registered data: stable id, real spec citation, statement (ROADMAP); the four
    seeds are present. Checks are PR 5.
12. Gate R3: no handwritten duplicate catalogs (TS types generated; Elixir validates from the
    same schemas). Composition behavior and "no proposed event escapes" fixtures belong to
    PR 5 per the roadmap; this slice must not preclude them.
13. Tests follow AGENTS.md "Writing tests": expected values hand-written, not from either
    kernel; each frozen field is protected by a test that fails when it is dropped.

## Verdict: CHANGES REQUIRED

Requirements 1 to 12 hold on the contracts as written. The shapes match the spec closely: the
delta ops carry their targets and preconditions in the form PR 5 needs (target equality as
canonical JSON, `expected` on every fact write, `source_id` on every transfer, named
from/to on every lifecycle step, writer groups as integers), a proposed `DomainEvent` cannot be
passed where a `CommittedEvent` is required, rejections cannot carry RNG, faults cannot carry a
proposal, `run_job` cannot carry an actor, and the CommandId known answers are right (recomputed
independently below). The two validators agreed on 7,905 of 7,911 generated cases; the six
disagreements are stack overflows in TypeScript at depths the canonical decoder can never
produce (N2).

Requirement 13 fails (F1): 120 of the frozen contracts' `required` entries can be removed with
every check staying green, the same gap the PR #11 review called a blocker. Two should-fix items
concern what the frozen shape can express (F2: no "always allowed" policy; F3: no identity rule
for internal commands). Four nits. Views on the eight open questions and on the Astra AQ2
carry-over are below.

## Findings

### F1 (blocker) `protocol/fixtures/invalid.json`: 120 `required` entries and 3 bounds of the frozen contracts survive mutation

Method: an in-memory sweep over every `required` entry and every `minItems`/`maxItems`/
`minLength`/`maxLength`/`minimum`/`maximum` of the 32 new contracts (250 mutants). For each, the
flattened defs were mutated and every example, every `invalid.json` fixture and both registries
re-validated with `Loka.Core.Contracts.validate/3`, the same checks the two suites make (the TS
suite reads the same fixtures). 175 survived; 52 of those remove a oneOf discriminator, which
`Schema.flatten!/1` rejects at compile time, so they are not reachable. **123 are real.** Two
were also confirmed the slow way: `mix test --force` and `npm test` (after `elixir
bin/contracts.exs` regeneration) both stay green when `position` leaves
`DomainEvent.required` (`protocol/event.schema.json:66`) and when `item` leaves `not`'s
required list (`protocol/policy.schema.json:81` region).

Real survivors, by contract (every non-discriminator required property unless noted):
`ActionDefinition` (all 8); `VersionedPolicy` (both); `Policy` (`items`, `item`, `quest`,
`state`, `fact`, `equals`); `Command` (all 3); `CommandPayload` (every payload field:
`actor_id` on all nine player commands, `direction`, `item_id`, `target_id`, `quest`,
`continuation_id`, `choice_id`, `until`, `job_id`); `DeltaOp` (every field except
`fact.assign.expected`, `entity.transfer.source_id`, `time.advance.writer_group` and
`choice.open.choice_ids minItems`, which fixtures cover); `MutationTarget` (all);
`DomainEvent` (`id`, `world_context_id`, `scope`, `logical_time`, `position`, `payload`);
`CommittedEvent.event`; `EventPayload` (all fields); `Effect` (`causation_id`,
`correlation_id`, `payload`); `EffectPayload` (all); `EffectRegistryEntry` (all but durable
`terminal_failure`); `DecisionResult` (`outcome`, `delta`, `events`, `effects`, `error`,
`code`); `InvariantEntry` (`id`, `statement`, `implemented_in`, `citation.document`,
`citation.heading`); `TargetSpec.scopes`; `TargetResolution.candidate_ids`. Bounds:
`Policy[any].items minItems 1->0`, `EffectRegistryEntry[ephemeral].allowed_origins
minItems 1->0` (only the `all` and durable siblings have fixtures).

Failure scenario: a later edit drops `actor_id` from `take`'s required list, or `position`
from `DomainEvent`. Drift check, both suites and CI stay green; after regeneration the TS
`CommandPayload` type silently loses the field; PR 5's kernel receives a `take` with no actor.
The freeze exists only to make that impossible.

Fix (same shape as PR #11's `11bb5d7`): one fixture per contract and per oneOf branch whose
value has only the discriminator (or is `{}`), expecting the full hand-written
`missing_property` list, about 45 lines; plus `{"op":"any","items":[]}` and an ephemeral entry
with `allowed_origins: []`. The sweep script is reproducible from this record's method and can
be re-run after the fix. The bounds checks are otherwise strong: all 60 other bound mutants died.

### F2 (should-fix) `protocol/policy.schema.json:60`: the AST cannot say "no condition"

`all.items` and `any.items` have `minItems: 1` and there is no literal-true leaf, so an action
with no condition cannot carry a valid `VersionedPolicy`, yet `ActionDefinition.policy` is
required. R6P's `look` and `wait` have no conditions. The shipped `move` example
(`protocol/action.schema.json:1363`) already shows the workaround: a `none`-target action whose
policy is `all: [target_present]`, a predicate about a target the action does not have. Compile
(R4) will either reject it or evaluate an ill-defined leaf.

Failure scenario: R4 compiles the Lantern's `look`; every policy it can write is false or
ill-defined, or `policy` must become optional later, changing the frozen `required` list.

Fix: `all.items` `minItems: 0` (the empty conjunction is true, the standard reading), flip the
one fixture that expects `too_few_items` on `all`, and make the `move` example
`{"op":"all","items":[]}`. `any` keeps `minItems: 1` if wanted (empty disjunction is false).

### F3 (should-fix) `protocol/command.schema.json:15`, `:244`; `lib/loka/core/id_source.ex:33`; `kernel/ts/src/id_source.ts:18`: `run_job` has an `id` but no rule for deriving it

`Command.id` is required for `run_job`, and the only derivation is `command_id(scope,
invocation_id)`, documented as *the* CommandId rule. 03 §14 says internal commands use their
"durable job/command identity" and share the `(idempotency_scope_id, command_id)` uniqueness
constraint; 04 §5.4 makes `(job_id, occurrence_generation)` the job occurrence identity.

Failure scenario: PR 5 or R6 reuses `command_id(scope, job_id)` for `run_job`, the obvious
reading of the code. `invocation_id` is client-chosen; a client that submits an invocation whose
id equals a job id (job ids are IdSource outputs visible in projections and saves) lands on the
same `(scope, command_id)` receipt row: it either replays the job's outcome to the player or
makes the job's own run an altered-intent conflict. Also, two occurrences of one job would share
a CommandId.

Fix: one sentence in `Command`'s description and in both `command_id` docs: `command_id/2` is
for invocation-derived commands; internal commands derive their id under a distinct tag over
their own identity (job id plus occurrence), defined where `run_job` first executes. No code
now; the point is that nobody reaches for the wrong function.

### N1 (nit) `test/loka/core/contracts_test.exs:72`, `:92`: the heading check's planted case does not distinguish exact line from substring

Mutant: replace the exact-line membership with `String.contains?(text, heading)`; the planted
`"## 99. Not a heading"` is still absent, so all tests pass, while a citation of `"## 23"` would
then be accepted. Plant a prefix of a real heading (for example `"## 23. Inventory"`) instead.

### N2 (nit) `kernel/ts/src/validate.ts:44`: at depth 462 (Node 24 default stack) `validate` throws a raw `RangeError`; Elixir returns a result

The two validators agree at 200 (the PR's test) and disagree from 462 up: TypeScript throws
`RangeError: Maximum call stack size exceeded`, not a `KernelError`. Both kernels' `decode` cap
depth at 128, so no value that crossed the boundary can reach this, and I could not construct a
divergence below 128. Hermes stacks are smaller than Node's; if `validate` is ever called on a
kernel-built value deeper than the decoder allows, the failure is an untyped exception. Either
say so in `validate`'s comment or catch and rethrow as `KernelError('invalid_canonical')`.

### N3 (nit) `protocol/action.schema.json:159-162`: `TargetSpec.scopes` freezes five values R6P never resolves

`equipped`, `connections`, `inspectable_details`, `party` and `privileged_global` are frozen
while every resolution result is an `EntityId`; connections and details may not be runtime
entities when R5 defines them, which would make those scopes unreachable or force a resolution
shape change. The PR applies "add with first use" to policy leaves and effect types; the same
rule fits here (R6P needs `self`, `inventory`, `room_contents`, `room_occupants`).

### N4 (nit) `protocol/action.schema.json:22`, `protocol/command.schema.json:229`: same-file `$ref`s spelled with the file name

`action.schema.json#/$defs/Key` inside action.schema.json and
`command.schema.json#/$defs/LogicalTime` inside command.schema.json; every other same-file ref
is `#/$defs/...`. Both resolve; one spelling makes the cross-file dependency graph readable.

## Questions (no severity)

- Q-a `protocol/decision.schema.json:39`: 04 §5.2 step 7 commits "required continuation/
  narration" with the result. `DecisionResult.accepted` is closed and has no place for it
  (NarrationSpec is an R3B envelope). Adding an optional field later is additive; saying so now
  in the description would keep PR 5/R7 from inventing a side channel.
- Q-b: the Lantern stores a "proof-only terminal milestone" (pre-release-proof.md). No delta
  op or effect carries it; I assume PR 4's account/progress envelope (03 §26) does, and that any
  op arrives additively.
- Q-c `protocol/delta.schema.json:95`: `fact.assign.expected/value` are `Key`. When FactSpec
  lands (PR 4) this should widen (a `oneOf` that still admits the key form), not rename; a
  rename would break the frozen op.

## Coordination with PRs #11 and #12 (not findings against this PR)

- Shared files: `kernel/ts/src/contracts.gen.ts`, `protocol/fixtures/invalid.json`,
  `test/loka/core/contracts_test.exs` with both; additionally with #12:
  `protocol/error_registry.json` and `error.schema.json` (both append one code:
  `conflicting_write` here, `too_many_properties` there; textual conflict on the trailing
  entry), `lib/loka/core/contracts/schema.ex` (one moduledoc sentence here, the map-subset
  feature there), `subset.schema.json`, `validate.test.ts`, `subset.gen.ts`. Whichever merges
  last must regenerate `contracts.gen.ts` and `subset.gen.ts`; the drift check will refuse
  anything else.
- Capability names as effect origins: `effect_registry.json` uses `narration` and `schedule`;
  PR #12's `capability_registry.json` has exactly those keys (also `containment`, `quest`,
  `fact`, `policy`, `target_resolution`). No conflict now; once #12 lands, the effect-registry
  test should require `allowed_origins ⊆ capability keys` so the placeholder becomes a check.
- #12 refactors `DefinitionRef` segments through new `CartridgeId`/`ReleaseVersion` refs; this
  PR only references `DefinitionRef` by name, so no impact.
- The CommandId citation names `docs/decisions/owner-decisions-r3-lanes-2026-09-24.md`, which
  #11 carries; the text on that branch matches the rule implemented here. Merge #11 first, as
  the PR says.

## Evidence

**CommandId, recomputed independently.** Python: `json.dumps(v, ensure_ascii=False,
separators=(',',':'))` over `["loka-command-v1", scope, invocation]`, SHA-256, first 16
bytes, byte 6 `(b & 0x0f) | 0x80`, byte 8 `(b & 0x3f) | 0x80`, lowercase 8-4-4-4-12. All three
rows of `protocol/fixtures/command_id.json` match, including the swapped-argument row and the
row with `世界"` and an empty invocation id. The same script reproduces the two existing
IdSource vectors (`c47e5589-…`, `1711b795-…`), so the canonicalization used for the check is
the profile's, not a coincidence. Both kernels read the file; neither computes the expectation.

**Differential, Elixir vs TypeScript.** 7,911 cases over the 32 new contracts: every example
under every contract (cross-contract), 40 one-to-three-step mutations of each example (key
drop, unknown key including `__proto__`/`type`/`op`/`kind`/`rng`/`session_id`, wrong type,
string case/length/Unicode variants including Kelvin sign and combining marks, integer edges
`-1/0/8/9/127/128/1024/1025/2^32/2^53-1`, array truncation and duplication to 2/8/9/1024/1025),
scalar probes on every contract, `not` chains of depth 1/50/127/128/129/200/1000/3000, `all`/
`any` of width 1/1000/5000 with a bad last item, a 5,000-op StateDelta, a 300-of-each
DecisionResult, and ambiguous candidate lists of 1024 and 1025 distinct ids, reversed and
duplicated. Elixir from `Loka.Core.Contracts.validate/3`, TypeScript from `validate()`, each
decoding with its stdlib JSON. **6 disagreements, all TypeScript `RangeError` at depth 1000 and
3000 (N2); zero otherwise.** Codes reached: invalid_type 5,534; missing_property 3,392;
unknown_property 2,338; pattern_mismatch 931; unknown_variant 738; not_in_enum 275;
below_minimum 77; too_long 31; too_few_items 26; const_mismatch 20; too_many_items 14;
above_maximum 6; too_short 3. Reversed or duplicated candidate lists validate in both (the
order/distinctness rule is the registered invariant, as the contract says).

**Mutants run the slow way** (`mix test --force` on the two test files; `npm test` after
regeneration where a schema changed):

| Mutant | Elixir | TS |
|---|---|---|
| `fact.assign` no longer requires `expected` | killed | killed (after regen) |
| `rejected` branch accepts `rng` | killed | not rerun |
| `run_job` accepts optional `actor_id` | killed | not rerun |
| `DomainEvent` no longer requires `position` | **survived** | **survived** (after regen) |
| `not` no longer requires `item` | **survived** | **survived** |
| ambiguous `minItems` 2→1 | killed | not rerun |
| `scheduler_wake` reclassified durable without `terminal_failure` | killed | n/a |
| heading check loosened to substring | **survived** (N1) | n/a |
| `command_id` drops `invocation_id` from the hash | killed | n/a |
| TS `commandId` skips the string check | n/a | killed |
| `CommittedEvent` no longer requires `committed_revision` | killed | not rerun |
| un-regenerated schema edit | `elixir bin/contracts.exs --check` exit 1 | |

Then the 250-mutant in-memory sweep described in F1.

**Spec checks on the shape.** `DomainEvent` vs `CommittedEvent`: a proposed event lacks
`committed_revision`, so it fails `CommittedEvent` validation and the TS type; requirement 6
holds structurally. `DecisionResult.rejected` has no `rng`, `fault` has no `delta` (fixtures).
`Command` rejects `session_id` (fixture) and uppercase ids. `target_ids` is an ordered array
with no sort rule (03 §14). `MutationTarget` matches the six op families' targets one to one;
`quest.activate`'s precondition reads a set (instances of the quest in scope) while its target
is the new instance id, which is fine because the precondition is checked against the overlay,
so two activations in one decision fault on the second regardless of writer group. All 13
invariant citations resolve to exact heading lines; `containment_acyclic` correctly cites 04
§5.3, not 03 §23. The Lantern traces use quest states `active` and `resolved` only, actions
`activate/move/take/talk/choose`, and accepted outcome keys, all expressible here.

## Views on the PR's open questions (plain language; which need the owner)

1. **Ambiguous target order** — *owner's call, but not urgent.* When a tap or a typed word
   matches several things, the game must list them in some fixed order. Sorting by id is fair
   and predictable but means nothing to a player; the MUD convention (things you hold first,
   then things in the room) feels natural and lets "2.lantern" mean the same thing every time.
   Either is correct engineering; only the second is a feel decision. The contract keeps the
   rule in one place, so switching later is one line plus a re-freeze of one invariant. Safe
   to leave as-is until R5 shows real ambiguity cases.
2. **Elixir structs (Astra AQ2)** — *PM/gate decision; owner informed, not asked.* In
   TypeScript the id types are already distinct labels, so a CharacterId cannot be handed where
   a PartyId is expected. Elixir has no cheap equivalent: only wrapping each id in a struct
   gives that protection at run time, and that shape only pays off once rule code exists (R5).
   Deferring is sound for this PR. It is not sound to defer silently past Gate R3, which lists
   "Elixir portable/domain types" as an output: the gate review (PR 6b) should record either
   generated Elixir structs/typespecs or the explicit decision that Elixir validates maps and
   TypeScript carries the brands, with AQ2 closed or carried to R5 by name.
3. **Where the CommandId rule lives** — *not an owner question; yes, amend.* The rule is now in
   two code comments, two tests and a decision record; AGENTS.md wants each fact in one place,
   and the sibling IdSource rule lives in the numeric profile. One paragraph next to IdSource in
   `numeric-profile.md`, reviewed as a spec amendment (README §11), fits the gate PR.
4. **Characters as containers** — *the spec already answers it; no owner decision.* Document 02
   §4 makes Character the durable identity (stats, cosmetics, world membership); document 03 §3
   and §23 make the in-world body a runtime entity that can hold items. So a character has an
   EntityId body, and `holder_id: EntityId` is right. What R5 needs is the lookup from
   CharacterId to body EntityId, which is state, not contract.
5. **Fact values as keys** — *technical.* Fine for the Lantern (`search_plan` is a word). See
   Q-c: make the later change a widening.
6. **Bounds** — *technical.* 8 targets, 128-character token and labels are sensible trust-
   boundary caps. 1024 candidates repeats the profile's `selector_cardinality`, which the
   description acknowledges; acceptable.
7. **Vocabulary from R6P** — *technical.* The names are 04's, not the fixture's shorthand,
   which is right. The `narration`/`schedule` origins already match PR #12's capability keys.
8. **Deferred on purpose** — *technical, agreed.* Each deferred item is additive (new enum
   value, new oneOf branch, new optional field). The two places where deferral is not additive
   are F2 (a required field with no valid value) and F3 (an id with no rule).

## What belongs to PR 5

Gate R3's "fixture suite proves StateDelta conflict/composition behavior and that proposed
DomainEvents cannot escape before a failed commit" is not satisfied by this PR and does not
claim to be; the roadmap assigns it to PR 5. This PR delivers the shape and the invariant ids
(`no_last_writer_wins`, `delta_preconditions_hold`, `no_proposed_event_escapes`,
`fault_discards_whole_proposal`) that PR 5's checks will be keyed on. I found nothing in the
shape that PR 5 would need to change to implement 04 §5.3's matrix.

## Over-engineering

Small. N3 is the one place where surface is frozen before use. `EffectRegistryEntry`'s durable
branch has no member yet but is the classification 14 §R3A asks for, so it stays.
`InvariantEntry.implemented_in` is planning data in `protocol/`; useful through Gate R3, worth
dropping after.
