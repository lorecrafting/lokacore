# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](spec/pre-release-proof.md))
sets the gates; this page is the current slice plan toward R6P ("The Ferryman's Lantern").
Slices follow [the delivery workflow](WORKFLOW.md). The owner approved six R3 PRs,
compile-time Elixir contracts and the verification harness below
([record](decisions/owner-decision-roadmap-2026-09-24.md)); the later slice counts and the
estimate are the PM's planning, not owner decisions.

## Verification harness (adopted 2026-09-24)

The reviewed known-answer fixtures stay authoritative (two kernels can agree on a wrong
answer); around them, an automated harness every change must pass; review is a fast
filter on top. Adapted from Datadog's
[harness-first write-up](https://www.datadoghq.com/blog/ai/harness-first-agents/).

- **Invariants are registered data** ([protocol/invariants.json](../protocol/invariants.json), since R3). Each spec invariant (for example one
  container per item, 03 §23; no proposed event escapes a failed commit, 04 §5.1; a retry
  replays its receipt and never rerolls, 03 §14) gets a stable ID, its spec citation and a
  pure check (foundation invariants in both kernels; rule invariants in TypeScript,
  [ADR-074](decisions/adr-074-ts-first-proposal.md)). Tests and the simulator check
  invariants by ID.
- **Deterministic simulation (R5).** Seeded random command sequences run through the
  TypeScript kernel headless on Node; every step records canonical bytes and checks every
  registered invariant. The differential compares the foundation across both kernels and
  the TypeScript hosts (Node bytes replayed on Hermes; a device sample at R6P). A
  failure reproduces from its seed and is shrunk to a minimal case. Seed counts follow
  the [envelope's differential target](spec/r1-acceptance-envelope.md) (every fast CI run).
  Built in the R5 +1 slice: `kernel/ts/test/sim.ts`, its seeds in `sim_seeds.json`; its real
  proposals feed the compose differential (`test/loka/core/compose_test.exs`).
- **Fault simulation (R6).** The same runs through the local authority with injected
  host faults: failed commit, unknown commit outcome, kill after commit before reply,
  duplicate delivery. Storage faults are real SQLite faults (AGENTS.md).
- **Owner attention goes to invariant lists and harness changes**, not line-by-line code.
- Later (R14, optional): a networked telnet/SSH terminal adapter for `loka play` once the
  online server exists (SSH or a browser terminal; plain telnet is unencrypted).
- Later (with NPC behaviors or the online server): puppeting, a player controlling an NPC's
  body. Needs a control-permission policy at the authority, body-versus-player state scope,
  pausing the NPC's behaviors (21 §10 arbitration), a GameView from the body's perception
  and displayed identity online ([owner decision](decisions/owner-decision-puppeting-2026-09-25.md)).
- Later (with the online work): player-written descriptions ([owner decision](decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Not now: TLA+ (revisit for Realm handoff and cross-authority effects, R14/R20) and
  production telemetry loops (no production yet; phone timing at R6P is the stand-in).

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 | 8 | Done; [Gate R3](reviews/2026-09-24-r3-gate-review.md) passed with noted gaps against [14 §R3A/§R3B](spec/14-implementation-plan.md#r3--contractschema-foundation). PR 1 portable ABI (#4); PR 2 schema toolchain + identity/scope/error contracts (#9); PR 3 action/command/delta/event/effect/result, policy AST, TargetResolution + invariant registry (#13); PR 4a capability registry/lock, manifests (#12); PR 4b facts, relations/provenance, GameView, account/progress envelopes (#14); PR 5 StateDelta composition in both kernels + invariant checks (#15); PR 6a R3B envelopes (#11); PR 6b gate review, docs tidy pass, generated capability docs and residency matrix (#16) |
| R4 minimal | 3 | loader, validation, reference resolution, capability lock, canonical artifact hash, diagnostics: S1 artifact and diagnostic contracts, owning capabilities; S2 Elixir compiler (JSON source to artifact); S3 TypeScript artifact loader |
| Observability design | 1 | between R4 and R5 ([owner decision](decisions/owner-decisions-observability-astra-2026-09-25.md)): the shared record format, event-name registry and game-trace format (accepted and rejected decisions, failed commits; never authority), frozen so `loka play` and the simulator emit them from R5's first slice. Spec 11 §11-15, 08 §6, 09 §7. [ADR-075](decisions/adr-075-observability-proposal.md) proposed; `protocol/observation.schema.json` |
| R5 subset | 10 + 1 | world rules the Lantern needs, in TypeScript (ADR-074); plus the deterministic simulation slice. Also ([owner decision](decisions/owner-decision-r5-setup-2026-09-25.md)): lint rules that fix where rule modules live and what they may touch; a MUD-style `loka play` CLI over the kernel on Node; a generated, drift-checked feature map per capability. Slices ([owner decision](decisions/owner-decisions-r5-plan-2026-09-25.md)): S1 rooms/exits, first world, look/move, `loka play`, rule lint lockdown; S2 target resolution, feature map; S2b short references in cartridge source ([owner decision](decisions/owner-decision-short-refs-2026-09-25.md)); S3 facts, conditions, state-dependent descriptions; S4 take/drop/give, containment checks, item text (keywords, short description, room line, examine) and inline touch links ([owner decision](decisions/owner-decisions-r5-s4-2026-09-25.md)); S5 ActionSet algebra, simple ActionRecipe execution; S6a logical clock, RNG use, chance checks; S6b resources: the default HP/MA/MV pools, costs, threshold checks, cooldowns, 1 MV per move, regeneration ([owner decision](decisions/owner-decision-hp-ma-mv-2026-09-25.md)); S7 barriers/locked exits and room brief mode (#50); S8 `scan` (00 §4.1) and loose ends; +1 deterministic simulation, then Gate R5. The 10,000-sequence Node cross-check runs in the normal fast CI run (`ci.yml`, typescript job, Node), decided in S1; the Hermes replay sample comes at R6P. Gate R5 also takes what the simulation slice (#53) left: the full `delta_preconditions_hold` step check (today only the read-to-write value chain), a linear-time `containment_acyclic`, budget faults naming which budget ran out, and a test for the own-key guard on the view codes in `kernel/ts/src/invariants.ts` |
| R6 | 5 + 1 | the [14 §R6](spec/14-implementation-plan.md#r6--offline-authority-and-save-system) build list as R6P needs it (including the fake synchronization adapter); plus fault simulation |
| Early R7/R8 | 5 | one quest, dialogue and a durable scene choice, NPC schedule/behavior, reactions, narration (TypeScript); carried from R5 (Gate R5 reports them as deferred, not missing): keys that break on a failed force and locked containers from 00 §4.4 (the door commands gain an optional target), a policy leaf reading resources, positions and their regeneration bonuses, one-way and bent door passages, rejecting a locked door that has no key |
| R6P | 4 | compiled Lantern cartridge, touch UI, device and human proof; the UI slices and GameView v2 take [the room view's GameView needs](design/room-view/README.md#gameview-needs) as input |
| Playtest and tune | open | after R6P, ended by the owner ([owner decision](decisions/owner-decision-playtest-2026-09-25.md)): the owner plays on the phone; the PM batches the notes into small PRs: number tuning and UI styling (short review), changed or new mechanics and behaviour (normal slices, spec first). Terminal playtests with `loka play` run from R5 S6b on. The rule that a format change never breaks installed content starts at the first release to real players |

## Proposed R6 slices

These boundaries need owner approval before R6 development. They follow [14 §R6](spec/14-implementation-plan.md#r6--offline-authority-and-save-system) and use the existing TypeScript kernel through `mobile/authority/local-story/` ([ADR-074](decisions/adr-074-ts-first-proposal.md)); Story play never waits for a Realm service. Each slice carries the smallest meaningful conformance and fault check; S6 consolidates the gate evidence.

The [R6P P1 identity/outcome adapter](spec/pre-release-proof.md#implementation-tickets-and-dependency-graph) precedes S1: validate `ActionInvocation`, derive a stable command ID from the trusted scope (lineage and controlled actor) and invocation ID, and resolve NEW intents into typed commands at the authority boundary. Controlled cases must distinguish rejection from fault, preserve target order in the intent digest, and exclude a pure view-freshness token from that digest ([03 §14](spec/03-domain-state-persistence.md#14-command-receipts-and-retry-admission), [04 §2](spec/04-command-event-effect-protocol.md#2-action-invocation-and-command-semantics)). S1 adds durable receipt recognition and commit.

| Slice | Deliverable | Distinct acceptance |
|---|---|---|
| S1 — local owner and commit | Use P1's bounded intent, authorize local lineage access, serialize commands, recognize matching receipts before current-target validation and reject altered intent; only for a new attempt use P1's resolution, decide once, and commit changed rows, revision, RNG, clock, receipt and required trace/effects in one real SQLite transaction before adopting state or reporting saved success ([03 §§14–15](spec/03-domain-state-persistence.md#14-command-receipts-and-retry-admission), [07 §8](spec/07-offline-storypacks-to-mmo.md#8-offline-execution)). | A fresh tiny world survives restart with the same state; successful and failed rule outcomes persist; duplicate delivery returns the original outcome without another RNG draw; a definite write failure leaves memory and storage at the prior revision. |
| S2 — uncertain COMMIT and recovery | Fence decisions while COMMIT outcome is unknown, reconcile from the authoritative store, and reload after commit-before-memory or commit-before-reply interruption. Keep one SQLite connection per process ([03 §15](spec/03-domain-state-persistence.md#15-transactional-command-commit-and-uncertain-outcomes), [mobile lessons](lessons/mobile.md)). | Both committed and uncommitted COMMIT faults recover correctly; no second application or false saved success ([OFF-03–06](spec/15-acceptance-scenarios.md#b-offline-lifecycle)). |
| S3 — saves and installed content | Add a versioned current head, three named immutable bookmark snapshots and bounded recovery checkpoints; pin the exact bundled cartridge release/capability lock; reopen offline and preserve the old head during staging or unsupported-version errors ([07 §9](spec/07-offline-storypacks-to-mmo.md#9-offline-persistence), [10 §§31–32](spec/10-mobile-commerce-release.md#31-initial-player-run-lifetime-defaults)). | Restart and an app update reopen the pinned run; restoring a bookmark forks the lineage with its saved RNG; a missing release, corrupt checkpoint or interrupted migration never adopts a partial head ([OFF-07, OFF-11–12](spec/15-acceptance-scenarios.md#b-offline-lifecycle)). |
| S4 — time and durable jobs | Make `play_time` action-driven; reconcile `real_elapsed` once through an idempotent resume input with a declared clamp/rollback policy; drain due jobs on the normal decision path ([07 §10](spec/07-offline-storypacks-to-mmo.md#10-offline-time), [10 §31](spec/10-mobile-commerce-release.md#31-initial-player-run-lifetime-defaults)). | Reading/backgrounding does not advance default time; long absence, clock rollback and crash/retry apply one accepted interval ([OFF-08–09, OFF-13](spec/15-acceptance-scenarios.md#b-offline-lifecycle)). |
| S5 — milestone and fake sync | Commit a rule-owned milestone with its pending report and gameplay result, keeping profile/account binding outside portable hashes; use a fake progress adapter for delayed delivery ([03 §26](spec/03-domain-state-persistence.md#26-story-milestones-and-platform-acceptance), [23 §§3–4](spec/23-accounts-progress-admission.md#3-declare-completion-once-independently-of-the-platform-unlock)). | Offline completion survives restart; duplicate delivery and account switching cannot duplicate or rebind the report. Production authentication remains R12A. |
| S6 — fault simulation and Gate R6 | Run the seeded command corpus through the local authority with real SQLite faults, process interruption, duplicate delivery and recovery; demonstrate airplane-mode start, play, kill, resume and finish ([14 §R6](spec/14-implementation-plan.md#r6--offline-authority-and-save-system), [OFF-01–07](spec/15-acceptance-scenarios.md#b-offline-lifecycle)). | No partial state, provisional event or false saved success; retain failing traces and a gate review with the docs tidy pass. |

27 slices after R3. Estimate ([ADR-074 §6](decisions/adr-074-ts-first-proposal.md#6-re-estimate-to-r6p-estimates-not-measurements),
from R3's approximate counts): about 8.5 to 9.2 million subagent tokens to R6P for the 26 slices it counted, plus about 0.4 million for the observability slice; PM
coordination is extra and unmeasured. Calendar time is bounded by owner approvals and
device sessions.

Re-estimate after R5 S2 ([owner decision](decisions/owner-decision-review-lever-2026-09-25.md)):
observed harness tokens were 2.64M for S1 (#34, without Astra) and 1.08M for S2 (#35),
against about 0.35M planned; the figures may count per-run context and overstate. For the
about 21 slices left after S2b: about 14 to 18 million, with Fable and Astra kept for about
six foundational slices at S2's to the S1-S2 average rate and the rest at S2b's 0.48M (#37);
about 23 million with every slice at S2's rate. PM coordination stays
extra and unmeasured.
