# Review: observability design, ADR-075 and observation contracts (PR #29)

- PR: [#29](https://github.com/lorecrafting/lokacore/pull/29), branch `obs-design`
- Commit reviewed: `fd0ab9f`
- Reviewer: independent (Claude Code, Fable); authored none of it. Foundational freeze, so
  the full review with mutation testing ([Review stance](../WORKFLOW.md#review-stance)).
  A cross-vendor (Astra) review runs in parallel; its answer is appended below when relayed.
- **Verdict: APPROVE WITH NOTES** (no blocker; four should-fix items, all in the ADR text or
  one optional schema field; five nits; two questions).

## What must be true (written before reading the diff)

From 11 §11-§15, §22; 08 §6; 09 §2, §4, §5, §7; 04 §5, §5.0, §5.1, §6, §11; 03 §14, §15;
the [owner decision](../decisions/owner-decisions-observability-astra-2026-09-25.md) with
its PR #28 corrections; Foundry `OBSERVABILITY.md` and FR-18A/B; AGENTS.md; the
[contract lessons](../lessons/contracts.md).

1. One record envelope; one name registry mirrored by the schema and checked in CI like
   `error_registry`; only names with a producer through R6P.
2. Stores by purpose joined by ids, each with location, retention and upload default; phone
   traces never uploaded by default (11 §11).
3. A game trace entry per command: command, decision outcome (accepted, or rejected with
   an ErrorCode), event chain, delta digest, RNG draws when configured, effect ids, revision
   before and after, commit outcome committed/failed/unknown. Rejected decisions and failed
   commits are recorded (owner correction). Derived, never authority. Host-independent so
   one seed on two hosts gives byte-identical canonical entries (09 §5). No trace hash yet.
4. 04 §5.0/§5.1 and the frozen `CommittedEvent`: a rejection consumes no RNG, delta or
   events; only committed events may be traced; a failed commit discards the proposal; an
   unknown commit is reconciled, never presumed rolled back.
5. 09 §2 repro fields reachable from the ids; RNG source/version recorded (09 §4); kernel
   version string format fixed, value source left to R5.
6. Unknown never 0, unavailable never empty, one shared shape (Foundry FR-18A).
7. Redaction by schema where expressible; no device ids, paths, UUIDs of devices (AGENTS.md);
   diagnostics keep the 08 §6 shape, no second diagnostic shape.
8. Every `required` and every bound has a fixture that dies when it is removed (contract
   lessons); generated files in sync; ADR-075 Proposed and absent from document 16; spec
   amendments minimal and marked proposed.

## Checks

Baseline in a detached worktree at `fd0ab9f`: `mix test --force` 145 passed;
`elixir bin/contracts.exs --check` clean; `kernel/ts` `npm test` 66 passed;
`bin/check_docs.exs` 99 docs, 0 broken, 0 unreachable; `bin/check_size.exs` clean.
Document 16 does not mention ADR-075. The amendment style matches the R4 precedents in 00a
and 05.

**Schema mutant sweep (my own script, not the developer's).** Over every `$def` of
`observation.schema.json`: drop each `required` entry; drop each `minimum`, `maximum`,
`minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`; relax each numeric bound by
one (the developer did not run this class); widen each `enum` and `const` to its bare
type. Each mutant is flattened and run through `Contracts.validate/3` against every
contract's `examples` and every `invalid.json` fixture (exact error lists). Result: 126
mutants, 92 killed, 34 rejected at load by `Schema.flatten!` (every one a oneOf
discriminator: the subset fails closed), **0 survivors**. The developer's 81/81 is
consistent with this (their 81 plus my 11 relax-by-one mutants, all killed).

**Registry test.** Six plants in `event_registry.json`, each run alone: wrong store, metric
flipped to event, event flipped to metric, dropped entry, extra unregistered
`runtime.commit.failed`, renamed entry. Each fails `registries_test.exs` (13/14).

**Cross-contract checks.** `TraceDecision.accepted.outcome` is the same `Key` as
`DecisionResult.outcome`; `RngDraw` bounds (1..2^32, value < 2^32) match `Loka.Core.Rng`;
`InvariantFailure.invariant` is the `Key` that `InvariantEntry.id` uses and matches every
`invariants.json` id; `CommitOutcome.committed.revision` minimum 0 (a receipted rejection at
revision 0) is consistent with `CommittedEvent.committed_revision` minimum 1.
`DecisionResult.fault` carries an optional `target` that the trace drops (S3).

**Redaction.** Walking the flattened schema from `CommandPayload`, `CommittedEvent` and
`TraceEntry` finds no string without a pattern, enum or const; the only free text reachable
from any record is `Diagnostic.path` and the values of `Diagnostic.data`, exactly as ADR §6
says. Per-store ids are closed objects; a `device_id`, `time` or `host` in `ReplayIds` and a
`device_serial` in `HostIds` have fixtures. `/tmp/` is git-ignored, so `tmp/obs/` is too.

**Unknown and unavailable.** `Measure` rejects a bare number, an `unknown` with a value and
an `unavailable` without a cause (fixtures, and the sweep kills every relaxation).
`RngTrace` and `CommitOutcome` reuse the `unavailable` + `UnavailableCause` shape. An
optional id (`BuildIds.content_hash`) is the one deliberate absence, and the ADR separates
it from an unavailable measure; a diagnostic exists only when the compile or load failed,
so the hash is present only for loader diagnostics, which is right.

**Test writing.** The new registry test names its break, takes expected values from the
registry file and the schema (both data, not the code under test), and mirrors the
existing `ErrorCode` test. Fixtures carry hand-written error lists; the sweep shows each
bound has a killing fixture. No frozen fixture was touched.

**Over-engineering.** Five names, each with a producer through R6P (the PM for
`agent.work`). Four ids objects are what lets the schema enforce required ids and redaction
per store; one optional-everything object could not. `UnavailableCause` has two values, both
used. The ADR §8 OpenTelemetry paragraph names its trigger and is one paragraph. The only
duplicate fact is N2.

## The developer's self-reported points

- **Failed and unknown commits carry no event chain.** Judged acceptable, and consistent
  with the owner's correction. The entry still records the decision (outcome, delta digest,
  RNG draws) and the commit outcome, so a failed commit is recorded as a failed commit, not
  as nothing. `delta_digest` already identifies the discarded proposal; the proposed chain
  is a pure function of seed, state and command, so replay recovers it. A digest or count
  of proposed events would add a hash use with no consumer through R6P, and 04 §5.1 plus
  the frozen `CommittedEvent` text ("only this form may be traced") forbid the events
  themselves. Owner's call only if they want the proposal chain in the file regardless.
- **Decision-commit pairing as an ADR rule.** Acceptable in principle (the subset cannot
  relate two fields), but the ADR does not actually write the matrix (S2).
- **`agent.work` uniqueness as a producer-file rule.** The file and its check do not exist,
  so nothing validates the PM's records (S4).
- **Kernel version `<KERNEL_ID>@<full commit>`.** Fine, and not really an owner decision:
  exact for replay, no bump discipline, `KERNEL_ID` exists in `kernel/ts/src/index.ts`,
  `protocol/` is in the same commit so 09 §2's schema version is covered.
- **Delta digest.** Not a new hash domain in 05 §11's sense (05 §11 defines no domain
  tags; it separates the semantic hash from package hashes). It is a new hash use over the
  R3-frozen canonical StateDelta bytes, with the known-answer obligation stated ("computed
  outside the kernels, with the first producer"). Acceptable; the first producer's reviewer
  must hold it to that.
- **Stores under `tmp/obs/<store>/`, dev evidence committed.** Files are enough until a
  server exists. Whether token counts per PR belong in a committed file is the owner's (see
  below).

## Findings

- **S1 (should-fix)** `docs/decisions/adr-075-observability-proposal.md:46-47, 99-100`
  and `protocol/observation.schema.json:547-549` (TraceEntry description). "Replaying one
  seed on two hosts gives byte-identical entries" is true only if every identity in the
  entry is fixed by the replay input. `run_id` is host-minted unless the ADR says otherwise,
  and `CommandId` derives from the idempotency scope and the InvocationId (04 §3), which
  then flow into every committed event's `causation_id`. Scenario: the R5 simulator on Node
  and on Hermes both take seed `[1,2,3,4]` and mint `run_id` with the platform UUID; the
  `ReplayIds` differ and every `events[].event.causation_id` differs, so the 09 §5
  comparison false-fails on the first run. Fix (one sentence in §3 or §4): `run_id` and the
  invocation ids are part of the replay input (the transcript, or derived from the seed
  through IdSource); the byte-identity claim covers entries produced from one replay input.
- **S2 (should-fix)** `docs/decisions/adr-075-observability-proposal.md:88-90`. The
  decision-commit pairs are delegated to "each producer's tests" but the matrix is never
  written, and the parenthetical omits the rejected cases. Scenario: `loka play` records a
  receipted rejection (03 §14) as `commit: committed, revision unchanged, events []`; the
  simulator records the same case as `unavailable/not_applicable`; a viewer grouping on the
  commit state shows different stories for identical runs, and the cross-host comparison
  diverges. Fix: write the matrix in §4: accepted → committed | failed | unknown; rejected →
  committed (receipted; revision unchanged, `events` and `effect_ids` empty) |
  unavailable/not_applicable (no receipt); fault → unavailable/not_applicable; and say what
  a failed receipt write records. Alternative not asked for: a flat `TraceEntry` oneOf keyed
  by the pair, which the schema could enforce.
- **S3 (should-fix)** `protocol/observation.schema.json:415-420` (`TraceDecision.fault`).
  `DecisionResult.fault` carries an optional `target` (`MutationTarget`); the trace keeps
  only `code`. 04 §5.5 says fault diagnostics retain bound targets. Scenario: the simulator
  on Hermes faults with `conflicting_write`; the trace says only that; replay on Node does
  not fault (a host differential, the case the trace exists for) and the conflicting target
  is unrecoverable. Fix: add the same optional `target` `$ref` (no new shape, one fixture).
- **S4 (should-fix)** `docs/decisions/adr-075-observability-proposal.md:37, 134-137`.
  `dev_evidence` is the one store whose producer (the PM) has no tests, `docs/dev-evidence.jsonl`
  does not exist, and "the check that validates the file" is named nowhere. Scenario: the
  PM appends `"tokens": 412000` (a bare number) on the file's first line; nothing fails; the
  format drifts from its validator from line one, the Foundry FR-18B failure the ADR cites.
  Fix: either add the check now (a few lines in `registries_test.exs`: every line of the
  file validates as an `ObservationRecord` in store `dev_evidence`, `(pull_request, role)`
  unique, empty file allowed) or state in §2 and §7 that the file and its check land in the
  same PR as the first record and no record precedes it.
- **N1 (nit)** `docs/decisions/adr-075-observability-proposal.md:110-112`. "The commit
  outcome and the RNG draws use the same unknown and unavailable branches", but `RngTrace`
  (`observation.schema.json:319`) has no `unknown` branch and a fixture asserts
  `{"state":"unknown"}` is `unknown_variant`. The schema is right (a pure kernel's draws
  are always observable when configured); fix the sentence.
- **N2 (nit)** `protocol/event_registry.json:5-29` `kind`. The schema already says which
  names are metrics (`data` is `Measure`) and the test only checks the two agree, so `kind`
  is a second copy of one fact (AGENTS.md: each fact lives in one place). Drop it and
  derive the kind from the branch in the test, or keep it knowingly; cheap either way.
- **N3 (nit)** ADR-075 does not mention 11 §22 (crash reports), which the brief cites. One
  line: a crash record registers with its first producer and carries `ReplayIds`, whose
  seed, run and command are the repro pointer §22 asks for.
- **N4 (nit)** `docs/decisions/adr-075-observability-proposal.md:131-132`. "A registered
  name's ... data meaning never change; a change takes a new name" does not say whether an
  additive optional field is a change. `GameError` already adds optional per-code data under
  the same code. Scenario: the first producer wants the failing entity on
  `InvariantFailure` and, reading §7, registers `simulation.invariant_failed_v2`. Say that
  additive optional fields are allowed (or not).
- **N5 (nit)** `protocol/event_registry.json:11` and ADR §2. `content.diagnostic` names
  `mix loka.compile (R4)` as a producer, but the compiler emits no records and no slice is
  named for making it do so. One line naming the slice (the R5 `loka play` slice?).
- **Q1 (question)** An `unknown` commit later reconciled under 03 §15: is a second
  `trace.command` for the same `command_id` written with the resolved outcome, or is "one
  entry per command" strict and the entry stays `unknown`? R6 fault simulation will hit
  this; the ADR should say which.
- **Q2 (question)** An explicit advance (04 §5.4) evaluates due job commands inside one
  proposal and commits once. The trace then has one entry for the advance and none for
  the job commands, whose events appear in the advance's committed events. Intended?

## Owner's decisions (plain language)

1. **Token counts per pull request in a committed file** (`docs/dev-evidence.jsonl`,
   appended by the PM). It is the owner's cost data, visible to anyone with repository
   access, and it puts a manual step on the PM at every merge. The alternative is keeping it
   outside the repository. The record format is settled either way.
2. **Failed commits without the proposed event chain.** My judgment: the entry records the
   decision and the failed commit, and replay recovers the chain, so this meets "records
   rejected decisions and failed commits". The owner may still want the chain (or a digest
   of it) in the file; that would need a reading of 04 §5.1 that treats a local trace store
   as not "publishing".
3. **Kernel version as `<KERNEL_ID>@<full commit>`** was flagged by the developer; I see it
   as a technical choice that needs no owner ruling.

## Process note

While reading the branch I ran a `git checkout <commit> --` with no paths in the PM's main
checkout, which detached its HEAD for one command. The tree was clean before and after; I
restored `main` at `175f041` immediately and did every later read through `git show` or the
detached worktree. Recording it so the PM can verify.

## Astra (cross-vendor) review

Relayed by the owner via the PM, 2026-09-25, reviewed at `fd0ab9f`. Verbatim, fence included.

```text
VERDICT: REQUEST CHANGES

Reviewed: lorecrafting/lokacore#29 at
fd0ab9fe123549a3ec2d5120cffc5ddcbeb23df5.

This is a contract/design review, not a claim that nonexistent producers have
already failed. The scenarios below identify information the frozen shapes
lose or guarantees they cannot currently support. I read the observation
fixtures and registry test; I did not rerun the repository test suite.

A1 | blocker
protocol/observation.schema.json:547-566
protocol/observation.schema.json:170-202
docs/decisions/adr-075-observability-proposal.md:72-79

The trace drops a required part of the portable Command, without defining a
replay-input artifact that preserves it.

Failure scenario:
A valid command has id C, world_context_id W, and an accept_quest payload.
Evaluation generates a quest-instance identity using IdSource(W, C, ordinal).
Persistence then fails. The trace retains C, the payload, seed, revision and
delta digest, but not W; the failed commit correctly contains no events from
which W might otherwise be recovered.

Replaying the recorded payload in a freshly initialized context W' generates
a different quest-instance identity and delta digest despite the same RNG
seed. StoryRunId is a save-lineage identity, not a specified encoding of
WorldContextId. A digest cannot recover the omitted input.

The existing Command contract explicitly requires world_context_id
(protocol/command.schema.json:15-35), and the frozen IdSource algorithm uses
it. The ADR's reference to “the run's replay input (transcript or seed)” does
not define or bind an immutable artifact containing that missing input.

Required change:
Preserve the full existing Command, or explicitly retain world_context_id
alongside the already-recorded command_id and payload. Define how records
bind to the initial state and ordered replay inputs. A small, required
replay-header/companion contract is sufficient; this does not require
implementing snapshots or the Lab now.

The same binding must accommodate snapshot and fault-schedule provenance
without silently changing trace.command's frozen meaning. A newly registered
companion record can preserve the v1 envelope, but its required relationship
to the trace must be specified rather than assumed.


A2 | blocker
protocol/observation.schema.json:451-507
docs/decisions/adr-075-observability-proposal.md:92-100

“Replay the seed” does not reproduce a failed or uncertain persistence
operation, and the recorded commit outcome contains no failure diagnosis.

Failure scenario:
The same accepted proposal encounters a definitive storage rollback because
the device is out of space. Another attempt rolls back because of a
transaction conflict. Both produce exactly {"state":"failed"}.

For an uncertain COMMIT, a lost acknowledgement after a successful durable
commit produces {"state":"unknown"}, without recording where observation
failed or a typed cause. Replaying the gameplay seed against healthy storage
succeeds and cannot distinguish these cases or establish that a storage fix
resolved the original failure.

There is also an unconditional host-independence overclaim: identical
gameplay inputs on a healthy host and a host with a persistence failure
necessarily produce different commit fields. Canonical encoding cannot make
different observations identical.

Required change:
Define a minimal typed, redacted failure/uncertainty diagnosis and its
correlation to the command attempt. Host-specific details belong in
operations, not in the portable decision trace. Reproducible injected failures
need an explicitly identified fault schedule/commit model.

State the equality guarantee over identical complete replay inputs and
controlled fault conditions, or define a portable comparison projection that
excludes host-attempt observations. Never make replay consult trace.commit
as authority to force the recorded outcome.

Keeping CommittedEvent lists out of failed/unknown outcomes is correct.
The blocker is the missing failure evidence and replay contract, not that
prohibition.


A3 | should-fix
protocol/observation.schema.json:369-394
docs/decisions/adr-075-observability-proposal.md:101-105

The compact decision omits the returned RNG state, so equal trace bytes can
hide different authoritative next states.

Failure scenario:
Starting from [1,2,3,4], the frozen RNG's first uniform(20) result is 0 and its
next state is [7,0,1026,12288].

One host returns that next state. A buggy host records the same draw but
returns the old [1,2,3,4]. Both return otherwise identical outcomes, deltas,
events and effects, and commit at the same revision.

The resulting trace entries are identical:
- ids.seed is the same initial state;
- the recorded draw is the same;
- delta_digest is the same;
- commit revision, events and effect IDs are the same.

DecisionResult.rng is separate from StateDelta
(protocol/decision.schema.json:44-60), so hashing StateDelta does not cover
this divergence. I checked this counterexample independently against the
specified RNG transition and trace projection.

Required change:
Retain the returned RNG state, or a compact digest that explicitly covers
the relevant complete decision result, including returned RNG state.
Do not hash the whole world per command. Add a counterexample where only the
returned RNG state changes and the comparison evidence must differ.

Optional draw collection and next-state identity are different concerns:
recording draw values does not prove the producer returned or committed the
correct next RNG state.


A4 | should-fix
protocol/observation.schema.json:319-368
protocol/fixtures/invalid.json:337
docs/decisions/adr-075-observability-proposal.md:109-114

RngTrace explicitly rejects the “unknown” state that the ADR promises.

Failure scenario:
An accepted decision consumes RNG. Draw collection was enabled, but the
collector cannot supply a trustworthy complete draw list. The truthful
representation is {"state":"unknown"}.

The schema rejects it, and invalid.json:337 freezes that rejection as the
expected result. A producer must instead lose the record, claim that
collection was disabled, or emit observed draws:[] and falsely report zero
draws.

Required change:
Add the unknown branch and change that fixture into a valid example.
Keep observed draws:[] valid for a genuinely observed zero-draw decision.
Reserve unavailable/not_collected for collection actually being disabled,
rather than using it to disguise failed observation.


A5 | should-fix
protocol/observation.schema.json:219-239
protocol/event_registry.json:9-12

Failed compilation diagnostics have no input/build identity.

Failure scenario:
Two cartridges are compiled by the same kernel build. Both fail before a
semantic content hash exists, and both report an error at a cartridge-relative
path such as cartridge or quests/start.

Their BuildIds are identical: only kernel_version is present. When their
records are retained in the diagnostics store, a repair consumer cannot
determine which source input produced a record. The relative path identifies
a location within a cartridge, not the cartridge or source revision itself.

This affects the compiler's first observation producer, not only a future
distributed logging service.

Required change:
Provide a build/input identity, or explicitly require a per-build bundle that
binds every diagnostic to its immutable source input. It is correct for
content_hash to be absent when no compiled artifact exists; do not replace it
with a zero hash or pretend that a source-input hash is a semantic cartridge
hash.


A6 | nit | QUESTION — redaction acceptance
docs/decisions/adr-075-observability-proposal.md:118-124
docs/decisions/adr-075-observability-proposal.md:134-138
protocol/cartridge.schema.json:357-377

Will each producer's acceptance tests include schema-valid leakage cases,
rather than only a schema-invalid observation?

For example, Diagnostic.path can contain an absolute home/worktree path,
and Diagnostic.data can contain arbitrary string-valued keys such as
device_serial. These values can satisfy the schema and canonical encoding.
Only the producer's redaction/content policy can stop them.

The ADR does prohibit such content. Because no observation producer exists,
I am not asserting an implemented leak. The question is whether the promised
acceptance evidence exercises this known escape hatch. Closed envelope
objects and identifier patterns are not a redaction proof.


RESPONSES TO THE THREE QUESTIONS

Question 1 — How should a kernel build be identified?

Use the full Git commit as the source revision. A human-readable release
version can be an additional display label, not the sole reproduction key.

However, adopt a concrete clean/dirty-build policy before the first producer.
The current schema permits only <KERNEL_ID>@<40-hex-commit>, while the ADR
defers what an uncommitted tree reports
(protocol/observation.schema.json:76-83;
docs/decisions/adr-075-observability-proposal.md:60-63).

The failure to prevent is straightforward: change a rule locally, run the
CLI, stamp the unchanged HEAD commit, and then find that checking out that
commit does not reproduce the recorded behavior.

The smallest policy is that a record claiming exact commit identity must
come from that clean source revision. Supporting dirty-tree repros requires
an explicit distinguishable identity/provenance scheme; silently reporting
HEAD is not acceptable. Also describe this field as source revision, not
by itself a fingerprint of every possible built artifact.


Question 2 — Should docs/dev-evidence.jsonl live in the repository?

Yes, as a small PM-maintained cost/disposition ledger. Do not build a separate
service for it now.

There is an important interpretation question before freezing AgentWork:
is this PR-level accounting, or an evaluation of each agent's work?
The current contract supports the former, not the latter
(protocol/observation.schema.json:605-631).

A reviewer who correctly identifies a fatal defect can cause a PR to close
unmerged. The current mapping records that reviewer's outcome as “rejected,”
even though the review was valuable and accepted. Likewise, one record per
role cannot distinguish multiple reviewers or models.

Keep the first version simple, but name/document the outcome as PR
disposition rather than agent correctness. Treat the ledger as evidence for
analysis, never as an acceptance authority. For token totals, a missing
round must not silently contribute zero to an “observed” total.

Appending after merge/closure is reasonable; those records should report
already-established outcomes, not establish them.


Question 3 — Should failed saves keep no event list?

Yes: keep failed and unknown outcomes free of CommittedEvent lists under the
currently frozen event contract. Do not invent a committed revision or expose
proposed events as facts that happened.

But reject the stronger claim that the exact save failure can always be
reproduced from the seed. Complete deterministic inputs can recover the pure
proposal; reproducing the persistence failure additionally requires the
failure context/fault schedule described in A1 and A2.

A trace viewer may show a proposal reconstructed by replay, clearly labeled
as reconstructed and uncommitted. It must not present it as a recovered
committed event history or use it to repair authoritative state.
```
