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
- Not now: TLA+ (revisit for Realm handoff and cross-authority effects, R14/R20) and
  production telemetry loops (no production yet; phone timing at R6P is the stand-in).

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 | 8 | Done; [Gate R3](reviews/2026-09-24-r3-gate-review.md) passed with noted gaps against [14 §R3A/§R3B](spec/14-implementation-plan.md#r3--contractschema-foundation). PR 1 portable ABI (#4); PR 2 schema toolchain + identity/scope/error contracts (#9); PR 3 action/command/delta/event/effect/result, policy AST, TargetResolution + invariant registry (#13); PR 4a capability registry/lock, manifests (#12); PR 4b facts, relations/provenance, GameView, account/progress envelopes (#14); PR 5 StateDelta composition in both kernels + invariant checks (#15); PR 6a R3B envelopes (#11); PR 6b gate review, docs tidy pass, generated capability docs and residency matrix (#16) |
| R4 minimal | 3 | loader, validation, reference resolution, capability lock, canonical artifact hash, diagnostics |
| R5 subset | 7 + 1 | world rules the Lantern needs, in TypeScript (ADR-074); plus the deterministic simulation slice. Also ([owner decision](decisions/owner-decision-r5-setup-2026-09-25.md)): lint rules that fix where rule modules live and what they may touch; a `loka play` CLI over the kernel on Node, in the first slice; a generated, drift-checked feature map per capability. The first slice also decides where the 10,000-sequence Node cross-check lives |
| R6 | 5 + 1 | the [14 §R6](spec/14-implementation-plan.md#r6--offline-authority-and-save-system) build list as R6P needs it (including the fake synchronization adapter); plus fault simulation |
| Early R7/R8 | 5 | one quest, a dialogue choice, a schedule, reactions, narration (TypeScript) |
| R6P | 4 | compiled Lantern cartridge, touch UI, device and human proof; the UI slices and GameView v2 take [the room view's GameView needs](design/room-view/README.md#gameview-needs) as input |

26 slices after R3. Estimate ([ADR-074 §6](decisions/adr-074-ts-first-proposal.md#6-re-estimate-to-r6p-estimates-not-measurements),
from R3's approximate counts): about 8.5 to 9.2 million subagent tokens to R6P; PM
coordination is extra and unmeasured. Calendar time is bounded by owner approvals and
device sessions. Re-estimate after the first two R5 slices, including the R5 set-up items (`loka play`, rule
lint, feature map).
