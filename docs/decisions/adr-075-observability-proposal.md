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
| `game_trace` | one `trace.command` entry per command (§4) | `loka play`, simulator (R5); local authority (R6) | dev and CI: `tmp/obs/game_trace/<run_id>.jsonl` (git-ignored); phone: the app sandbox, placement decided by R6 | dev: until deleted; CI: kept as a workflow artifact when the run fails; phone: bounded, cap decided by R6; certification keeps reproducible traces longer (11 §15, R9) | never (11 §11) |
| `diagnostics` | things to fix: `content.diagnostic` (08 §6), `simulation.invariant_failed` (09 §2) | `mix loka.compile`, the TypeScript loader via `loka play`, simulator | `tmp/obs/diagnostics/` | as game_trace in CI | no |
| `operations` | host-dependent measures: `kernel.decision_latency` (11 §13) | `loka play`, simulator (Node); local authority (Hermes) | `tmp/obs/operations/`; phone: the app sandbox | dev: until deleted; R6P timing evidence is captured under the [evidence lessons](../lessons/evidence.md) | no |
| `dev_evidence` | `agent.work`: tokens and outcome per agent per pull request | the PM, when a pull request merges or closes | committed, `docs/dev-evidence.jsonl`, appended by the PM | kept (it feeds the roadmap re-estimates) | not applicable (in the repository) |

Stores are separate because their rules differ: a game trace must be host-independent and
stay on the phone; operations are host-dependent by nature; dev evidence is about the
builders, not the game. They join by ids, not by sharing a bucket.

## 3. Correlation ids

One vocabulary, each id defined once: `content_hash` (ContentHash), `kernel_version`
(KernelVersion), `seed` (the run's initial RngState), `run_id` (StoryRunId: a save lineage;
for the simulator one sequence), `command_id` (CommandId), `revision` (the authority
revision the command was decided against), `host` (HostKind: node, hermes_android,
hermes_ios; a kind, never a device) and `pull_request`. Each store's ids are a closed
object over that vocabulary, so the schema enforces both which ids are required and which
may appear at all:

| Ids contract | Used by | Required | Optional |
|---|---|---|---|
| ReplayIds | `trace.command`, `simulation.invariant_failed` | content_hash, kernel_version, seed, run_id, command_id, revision | none |
| BuildIds | `content.diagnostic` | kernel_version | content_hash (absent when compiling failed before hashing) |
| HostIds | `kernel.decision_latency` | kernel_version, host | run_id, command_id |
| WorkIds | `agent.work` | pull_request | none |

**Kernel version.** `<KERNEL_ID>@<full git commit>`, for example
`loka-kernel@175f041c2e3a4b5d6e7f8091a2b3c4d5e6f70812`: the kernel, compiler and hosts
build from one commit, and 09 §2 asks for the revision. How a build learns its commit (and
what a dirty tree reports) is R5's; `KERNEL_ID` itself is still a placeholder.

**11 §11 onto the ids.** command_id → `command_id`; cartridge hash → `content_hash`;
revision before → `revision`, after → the commit outcome's `revision` (§4); kernel version
→ `kernel_version`; offline instance/save id → `run_id`. correlation_id stays inside each
DomainEvent (04 §11). request_id, session_id, instance_id online and the deployment hash
arrive with the server (R14). Account and character ids are never correlation ids; they
appear only inside game-trace command and event payloads, which stay on the device.

**09 §2 repro onto the records.** Kernel revision and protocol/schema versions →
`kernel_version` (protocol/ is in the same commit); cartridge id/version/hash →
`content_hash` (one hash names one release, 05 §12); RNG algorithm/state/seed → `seed` (the
algorithm is fixed by the kernel version); ordered command stream → the run's replay input
(transcript or seed), with `trace.command` records as its derived view; expected and
observed invariant → `simulation.invariant_failed`. The logical clock follows from the
initial state and the commands. Deployment hash (R14), initial snapshot hash (when R6 lets a
run start from a save) and fault schedule (R6 fault simulation) are added by those slices.

## 4. The game trace entry

`TraceEntry` (11 §15; 09 §7): the command payload (its id is `ids.command_id`); the
decision: accepted (typed outcome, state delta digest, RNG draws), rejected (its
GameError) or fault (its ErrorCode); and the commit outcome: committed (revision after,
committed events, effect ids), failed, unknown, or unavailable (nothing committed). It
records rejected decisions and failed commits as well as successes.

- **Derived, never authority.** Nothing reads a trace to decide game state, to repair a
  save or to accept a fix. A fix is proven by deterministic replay (09 §2): the seed or
  transcript reproduces the failure before the fix and not after.
- **Committed events only.** Proposed events never leave a failed commit (04 §5.1), so a
  failed or unknown commit carries none; the events are `CommittedEvent`s, the only form
  that may be traced. Replay recovers the proposal. A committed entry may be written with the
  commit, as 04 §6 does online; a failed or unknown one is written after it.
- **Host-independent.** No time, duration, host or device field (they go to operations).
  Replaying one seed on two hosts gives byte-identical entries (09 §5).
- **Digests.** The state delta digest is SHA-256 of the StateDelta's canonical bytes, the
  content_hash construction, not the state. No trace hash is defined now: the R5 slice that
  first compares traces across hosts defines it, and the first producer of either adds a
  known answer computed outside the kernels (as `protocol/fixtures/cartridge_hash.json`).
- 09 §7's per-component diffs come from replay, not from the stored trace.

## 5. Unknown and unavailable are explicit

A measure is a `Measure`: observed with a value, `unknown` (it applies but could not be
observed), or `unavailable` with a cause (`not_applicable`, `not_collected`). The commit
outcome and the RNG draws use the same unknown and unavailable branches. Unknown is never
0, and unavailable is never empty or absent: the schema rejects a bare number, an
`unknown` carrying a value, and an `unavailable` without its cause.

## 6. Redaction

Enforced by the schema: every object is closed (no free-form keys), ids are typed patterns
or enums, per-store ids exclude what a store may not carry (no host in a game trace; no
command or run in dev evidence), and there is no free-text field outside Diagnostic's
existing `path` and `data`. Rules for producers: no device serial, UDID/ECID, device name,
team or certificate id, or home, scratch or worktree path in any record (the AGENTS.md
`redact()` practice); Diagnostic `path` is cartridge-relative (08 §6) and its `data` holds
content facts only; game traces never leave the device by default (11 §11).

## 7. Adding a name, and validating producers

A name is added in the pull request of its first producer, not before: a registry entry
(name, store, event or metric, description citing the spec and naming the producer), an
`ObservationRecord` branch, a data contract with examples and invalid fixtures, and the
registry test agreeing (`test/loka/core/registries_test.exs`). A registered name's store,
ids and data meaning never change; a change takes a new name.

Every producer validates what it writes against `ObservationRecord` in its own tests in CI,
including one planted invalid record that must fail; in dev and CI an invalid record fails
the run. On the phone an invalid record is never allowed to change the game (R6 decides how
it is surfaced). This is the Foundry FR-18B lesson: its producers drifted from its
validators.

## 8. Self-improvement principles

- Observation is never authority (§4).
- A self-improvement loop needs an evaluator outside the candidate: the reviewed fixtures,
  the registered invariants and deterministic replay, never the candidate's own report.
- Dev evidence keeps token usage as a required measure, tied to the accepted or rejected
  outcome of the work (Foundry keeps tokens; it does not replace them with outcomes).
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
