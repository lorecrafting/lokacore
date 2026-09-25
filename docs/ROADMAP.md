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
- **Fault simulation (R6).** The same runs through the local authority with injected
  host faults: failed commit, unknown commit outcome, kill after commit before reply,
  duplicate delivery. Storage faults are real SQLite faults (AGENTS.md).
- **Owner attention goes to invariant lists and harness changes**, not line-by-line code.
- Later (R14, optional): a networked telnet/SSH terminal adapter for `loka play` once the
  online server exists (SSH or a browser terminal; plain telnet is unencrypted).
- Not now: TLA+ (revisit for Realm handoff and cross-authority effects, R14/R20) and
  production telemetry loops (no production yet; phone timing at R6P is the stand-in).

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 | 8 | Done; [Gate R3](reviews/2026-09-24-r3-gate-review.md) passed with noted gaps against [14 §R3A/§R3B](spec/14-implementation-plan.md#r3--contractschema-foundation). PR 1 portable ABI (#4); PR 2 schema toolchain + identity/scope/error contracts (#9); PR 3 action/command/delta/event/effect/result, policy AST, TargetResolution + invariant registry (#13); PR 4a capability registry/lock, manifests (#12); PR 4b facts, relations/provenance, GameView, account/progress envelopes (#14); PR 5 StateDelta composition in both kernels + invariant checks (#15); PR 6a R3B envelopes (#11); PR 6b gate review, docs tidy pass, generated capability docs and residency matrix (#16) |
| R4 minimal | 3 | loader, validation, reference resolution, capability lock, canonical artifact hash, diagnostics: S1 artifact and diagnostic contracts, owning capabilities; S2 Elixir compiler (JSON source to artifact); S3 TypeScript artifact loader |
| Observability design | 1 | between R4 and R5 ([owner decision](decisions/owner-decisions-observability-astra-2026-09-25.md)): the shared record format, event-name registry and game-trace format (accepted and rejected decisions, failed commits; never authority), frozen so `loka play` and the simulator emit them from R5's first slice. Spec 11 §11-15, 08 §6, 09 §7. [ADR-075](decisions/adr-075-observability-proposal.md) proposed; `protocol/observation.schema.json` |
| R5 subset | 7 + 1 | world rules the Lantern needs, in TypeScript (ADR-074); plus the deterministic simulation slice. Also ([owner decision](decisions/owner-decision-r5-setup-2026-09-25.md)): lint rules that fix where rule modules live and what they may touch; a MUD-style `loka play` CLI over the kernel on Node; a generated, drift-checked feature map per capability. Slices ([owner decision](decisions/owner-decisions-r5-plan-2026-09-25.md)): S1 rooms/exits, first world, look/move, `loka play`, rule lint lockdown; S2 target resolution, feature map; S3 facts, conditions, state-dependent descriptions; S4 take/drop/give, containment checks; S5 ActionSet algebra, simple ActionRecipe execution; S6 logical clock, RNG use, simple checks/resources; S7 barriers/locked exits, loose ends; +1 deterministic simulation, then Gate R5. The 10,000-sequence Node cross-check runs in the normal fast CI run (`ci.yml`, typescript job, Node), decided in S1; the Hermes replay sample comes at R6P |
| R6 | 5 + 1 | the [14 §R6](spec/14-implementation-plan.md#r6--offline-authority-and-save-system) build list as R6P needs it (including the fake synchronization adapter); plus fault simulation |
| Early R7/R8 | 5 | one quest, a dialogue choice, a schedule, reactions, narration (TypeScript) |
| R6P | 4 | compiled Lantern cartridge, touch UI, device and human proof; the UI slices and GameView v2 take [the room view's GameView needs](design/room-view/README.md#gameview-needs) as input |

27 slices after R3. Estimate ([ADR-074 §6](decisions/adr-074-ts-first-proposal.md#6-re-estimate-to-r6p-estimates-not-measurements),
from R3's approximate counts): about 8.5 to 9.2 million subagent tokens to R6P for the 26 slices it counted, plus about 0.4 million for the observability slice; PM
coordination is extra and unmeasured. Calendar time is bounded by owner approvals and
device sessions. Re-estimate after the first two R5 slices, including the R5 set-up items (`loka play`, rule
lint, feature map).
