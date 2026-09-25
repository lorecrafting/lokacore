# ADR-075 — One observation record format, four stores, a registered name list — 2026-09-25

**Status: Proposed.** The owner accepts or rejects it after review; it enters
[document 16](../spec/16-decision-register.md) only then. Written by the developer agent
(Claude Code, Claude Opus) for the observability design slice
([owner decision](owner-decisions-observability-astra-2026-09-25.md)).

## In plain words

Nothing in Loka writes logs, traces or metrics yet. From R5 on, `loka play`, the simulator,
the compiler, the phone and the agents building Loka will. If each invents its own format,
the formats drift from whatever checks them, as Foundry's did, and a later agent cannot
learn from them. So before the first producer exists, this freezes one record format
(`protocol/observation.schema.json`), one list of allowed record names
(`protocol/event_registry.json`), and four separate stores joined by shared ids instead of
one big bucket. Every producer must prove in CI that it writes that format.

Observation explains; it never decides. Nothing reads a record to decide game state, and a
fix is proven by replaying the seed, never by what a trace says.

## 1. One record envelope

Every record, in any store, is an `ObservationRecord`: `format` (`loka-obs-v1`), `event`
(a registered name), `store`, `ids` (the store's closed correlation ids, §3) and `data`
(the event's contract). There is one branch per registered name, so the schema checks the
store, the ids and the data of each name. Records are JSON Lines, one record per line in
canonical encoding (loka-numeric-v1), so the same record is the same bytes on every host.
A new envelope field or meaning takes a new format tag.

## 2. Stores by purpose

| Store | What goes in | Producers through R6P | Where until a server exists | Retention | Upload by default |
|---|---|---|---|---|---|
| `game_trace` | one `trace.run` header per run, then one `trace.command` entry per command (§4) | `loka play`, simulator (R5); local authority (R6) | dev and CI: `tmp/obs/game_trace/<run_id>.jsonl` (git-ignored); phone: the app sandbox, placement decided by R6 | dev: until deleted; CI: kept as a workflow artifact when the run fails; phone: bounded, cap decided by R6; certification keeps reproducible traces longer (11 §15, R9) | never (11 §11) |
| `diagnostics` | things to fix: `content.diagnostic` (08 §6), `simulation.invariant_failed` (09 §2) | the TypeScript loader via `loka play` (R5 S1); `mix loka.compile` from the slice that first stores its diagnostics; simulator | `tmp/obs/diagnostics/` | as game_trace in CI | no |
| `operations` | host-dependent measures: `kernel.decision_latency` (11 §13) | `loka play`, simulator (Node); local authority (Hermes) | `tmp/obs/operations/`; phone: the app sandbox | dev: until deleted; R6P timing evidence is captured under the [evidence lessons](../lessons/evidence.md) | no |
| `dev_evidence` | `agent.work`: model, tokens and pull-request disposition per agent per pull request | the PM, when a pull request merges or closes: one record per agent (role and instance), summing its rounds | committed, `docs/dev-evidence.jsonl`, appended by the PM | kept (it feeds the roadmap re-estimates) | not applicable (in the repository) |

Stores are separate because their rules differ: a game trace must be host-independent and
stay on the phone; operations are host-dependent by nature; dev evidence is about the
builders, not the game. They join by ids, not by sharing a bucket.

## 3. Correlation ids

One vocabulary, each id defined once: `content_hash` (ContentHash), `kernel_version`
(KernelVersion), `seed` (the run's initial RngState), `run_id` (StoryRunId: a save lineage;
for the simulator one sequence; part of the replay input, not re-minted on replay), `command_id` (CommandId), `revision` (the authority
revision the command was decided against), `host` (HostKind: node, hermes_android,
hermes_ios; a kind, never a device) and `pull_request`. Each store's ids are a closed
object over that vocabulary, so the schema enforces both which ids are required and which
may appear at all:

| Ids contract | Used by | Required | Optional |
|---|---|---|---|
| RunIds | `trace.run` | content_hash, kernel_version, seed, run_id | none |
| ReplayIds | `trace.command`, `simulation.invariant_failed` | content_hash, kernel_version, seed, run_id, command_id, revision | none |
| BuildIds | `content.diagnostic` | kernel_version, input_digest | content_hash (only once an artifact's hash exists) |
| HostIds | `kernel.decision_latency` | kernel_version, host, run_id, command_id | none |
| WorkIds | `agent.work` | pull_request | none |

**Kernel version is the source revision.** `<KERNEL_ID>@<full git commit>`, for example
`loka-kernel@175f041c2e3a4b5d6e7f8091a2b3c4d5e6f70812`: the kernel, compiler and hosts
build from one commit, and 09 §2 asks for the revision. The bare form is allowed only from a
clean tree at that commit; a tree with uncommitted changes reports `<KERNEL_ID>@<commit>-dirty`,
and such a record is never an exact repro key. Reporting HEAD for a dirty tree is
forbidden. It names source, not a fingerprint of a built artifact. How a build learns its
commit is R5's; `KERNEL_ID` itself is still a placeholder.

**Input digest.** A compile that fails has no content_hash, so a diagnostic carries
`input_digest`: SHA-256 of what the producer read. For the compiler that is the canonical
JSON object mapping each source file's cartridge-relative path to the SHA-256 of its bytes
(it exists even when a file does not parse or `cartridge.json` is missing, which a manifest
id@version would not); for the loader, the artifact file's bytes. It is never put in
`content_hash`, and never a zero hash; the first producer adds its known answer.

**11 §11 onto the ids.** command_id → `command_id`; cartridge hash → `content_hash`;
revision before → `revision`, after → the commit outcome's `revision` (§4); kernel version
→ `kernel_version`; offline instance/save id → `run_id`. correlation_id stays inside each
DomainEvent (04 §11). request_id, session_id, instance_id online and the deployment hash
arrive with the server (R14). Account and character ids are never correlation ids; they
appear only inside game-trace command and event payloads, which stay on the device.

**09 §2 repro onto the records.** Kernel revision and protocol/schema versions →
`kernel_version` (protocol/ is in the same commit); cartridge id/version/hash →
`content_hash` (one hash names one release, 05 §12); RNG algorithm/state/seed → `seed` (the
algorithm is fixed by the kernel version); initial snapshot → `trace.run`
`initial_state` (fresh, or unavailable until R6 gives snapshots an identity); fault
schedule → `trace.run` `fault_schedule`; ordered command stream → the full Commands of the
run's `trace.command` entries by `ordinal`; expected and observed invariant →
`simulation.invariant_failed`. The logical clock follows from the initial state and the
commands. The deployment hash arrives with R14. A crash report (11 §22) registers with its
first producer and carries `ReplayIds`: its seed, run and command are the repro pointer.

## 4. The game trace

A run's trace is one `trace.run` header (RunIds; `RunHeader`: initial state and fault
schedule), then one `trace.command` entry per command (`TraceEntry`, 11 §15; 09 §7): its
`ordinal` (1, 2, ... in command order), the full Command (`command.id` equals
`ids.command_id`; `world_context_id` is kept because IdSource uses it), the decision:
accepted (typed outcome, state delta digest, RNG draws, the returned RNG state), rejected
(its GameError) or fault (its ErrorCode and bound target, 04 §5.5); and the commit outcome.
Required relationship: every entry of a run shares the header's `run_id`, `content_hash`,
`kernel_version` and `seed`; the header precedes the entries; ordinals are consecutive from
1. Header plus the Commands by ordinal are the complete replay input.

| Decision | Possible commit outcomes |
|---|---|
| accepted | committed (revision advanced); failed; unknown |
| rejected with a receipt (03 §14) | committed (revision unchanged, `events` and `effect_ids` empty); failed or unknown (the receipt write) |
| rejected without a receipt | unavailable, not_applicable |
| fault | unavailable, not_applicable |

The schema subset cannot relate two fields, so each producer's tests check this matrix (§7).
A failed commit's cause is `injected` (by the run's fault schedule) or `storage_error`; an
unknown one's is `injected` or `no_outcome` (crash, kill, lost acknowledgement). Host detail
(the store's error) goes to operations, correlated by `run_id` and `command_id`, under a
name the R6 fault-simulation slice registers (11 §12 `runtime.commit.failed`). An unknown
commit reconciled later (03 §15) gets a second entry with the same ordinal and the resolved
outcome; the first stays as written. An explicit advance (04 §5.4) is one command, one
entry; the jobs it runs appear in its committed events.

- **Derived, never authority.** Nothing reads a trace to decide game state, to repair a
  save or to accept a fix. Replay may read the inputs (the header and the Commands); it never
  reads a decision or commit outcome, and never consults `commit` to force an outcome. A fix
  is proven by deterministic replay (09 §2): the inputs reproduce the failure before the fix
  and not after.
- **Committed events only.** Proposed events never leave a failed commit (04 §5.1), so a
  failed or unknown commit carries none; the events are `CommittedEvent`s, the only form
  that may be traced. Replay recovers the proposal, which a viewer labels as reconstructed
  and uncommitted. A committed entry may be written with the commit, as 04 §6 does online;
  a failed or unknown one is written after it.
- **Host-independent, given identical inputs.** No time, duration, host or device field
  (they go to operations). Two hosts produce byte-identical entries (09 §5) only from
  identical complete replay inputs (run_id, world context, command ids, seed, initial state,
  fault schedule) under controlled faults; an uncontrolled storage failure is an observed
  difference, not a determinism bug.
- **Digests.** The state delta digest is SHA-256 of the StateDelta's canonical bytes, the
  content_hash construction, not the state. The returned RNG state is stored whole (four
  integers; the delta does not cover it, so without it two hosts returning different next
  states would give equal entries). No trace hash is defined now: the R5 slice that first
  compares traces across hosts defines it, and the first producer of each digest adds a
  known answer computed outside the kernels (as `protocol/fixtures/cartridge_hash.json`).
- 09 §7's per-component diffs come from replay, not from the stored trace.

## 5. Unknown and unavailable are explicit

A measure is a `Measure`: observed with a value, `unknown` (it applies but could not be
observed), or `unavailable` with a cause (`not_applicable`, `not_collected`). The commit
outcome, the RNG draws and the run header use the same unknown and unavailable branches
(RNG draws: observed `[]` is zero draws, unknown is a collector that could not supply a
complete list, unavailable is collection switched off). Unknown is never
0, and unavailable is never empty or absent (an optional id is different: it is absent only when
the thing does not exist, such as the hash of a compile that failed): the schema rejects a bare number, an
`unknown` carrying a value, and an `unavailable` without its cause.

## 6. Redaction

Enforced by the schema: every object is closed (no free-form keys), ids are typed patterns
or enums, per-store ids exclude what a store may not carry (no host in a game trace; no
command or run in dev evidence), and there is no free-text field outside Diagnostic's
existing `path` and `data`. Rules for producers: no device serial, UDID/ECID, device name,
team or certificate id, or home, scratch or worktree path in any record (the AGENTS.md
`redact()` practice); Diagnostic `path` is cartridge-relative (08 §6) and its `data` holds
content facts only; game traces never leave the device by default (11 §11). The schema
cannot catch a schema-valid leak, so each producer's acceptance tests include one: an
absolute home or worktree path in `Diagnostic.path` and a device serial in
`Diagnostic.data`, which its redaction must strip or reject.

## 7. Adding a name, and validating producers

A name is added in the pull request of its first producer, not before: a registry entry
(name, store, event or metric, description citing the spec and naming the producer), an
`ObservationRecord` branch, a data contract with examples and invalid fixtures, and the
registry test agreeing (`test/loka/core/registries_test.exs`). A registered name's store,
ids and data meaning never change; a change takes a new name. An additive optional field is
not a change (as GameError adds per-code data).

Every producer validates what it writes against `ObservationRecord` in its own tests in CI,
including one planted invalid record that must fail; in dev and CI an invalid record fails
the run. On the phone an invalid record is never allowed to change the game (R6 decides how
it is surfaced). This is the Foundry FR-18B lesson: its producers drifted from its
validators. The PM's `docs/dev-evidence.jsonl` is checked now: every line a canonical
`agent.work` record, and (pull_request, role, instance) unique (`registries_test.exs`).

## 8. Self-improvement principles

- Observation is never authority (§4).
- A self-improvement loop needs an evaluator outside the candidate: the reviewed fixtures,
  the registered invariants and deterministic replay, never the candidate's own report.
- Dev evidence keeps token usage as a required measure (unknown, never 0, when not
  reported), with the model and the pull request's disposition (merged or closed). The
  disposition is the PR's, not a verdict on the agent: a reviewer whose finding closes a PR
  did good work. The ledger is evidence for analysis, never an acceptance authority (Foundry
  keeps tokens; it does not replace them with outcomes).
- OpenTelemetry export and cross-store search come later, when records from more than one
  machine must be searched together (at the latest the R14 server). Field names are chosen
  so the mapping is direct: `run_id` → trace id (both 128 bits), `command_id` → span,
  `event` → span or log name, `kernel_version` and `host` → resource
  attributes, an observed Measure → a data point (11 §14).

## 9. Alternatives considered

- **One bucket for everything.** Rejected: game traces must be host-independent and stay on
  the phone, which operations and dev evidence cannot be.
- **One ids object with every id optional.** Rejected: the schema could then enforce neither
  the required ids nor redaction by store.
- **Proposed events in failed-commit traces.** Rejected: 04 §5.1 and `CommittedEvent` allow
  only committed events to be traced; replay recovers the proposal.
- **The full state delta in the trace.** Rejected: 11 §15 asks for a digest; the delta can
  be large and replay recovers it.
- **Register the whole 11 §12-§13 list now.** Rejected: names without producers drift;
  each is registered with its first producer (§7).
- **Kernel version as a semantic version.** Possible later for releases; a commit is exact
  for replay now and needs no bump discipline.
