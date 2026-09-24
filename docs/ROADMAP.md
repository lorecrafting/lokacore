# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](spec/pre-release-proof.md))
sets the gates; this page is the current slice plan toward R6P ("The Ferryman's Lantern").
Slices follow [the delivery workflow](WORKFLOW.md). Owner approval of the plan and of the
verification additions below: [owner decisions](decisions/owner-decision-roadmap-2026-09-24.md).

## Verification harness (adopted 2026-09-24)

Correctness comes from an automated harness every change must pass; review is a fast
filter on top. Adapted from Datadog's
[harness-first write-up](https://www.datadoghq.com/blog/ai/harness-first-agents/).

- **Invariants are registered data (R3 PR 3/5).** Each spec invariant (for example one
  container per item, 03 §23; no proposed event escapes a failed commit, 04 §5.1; a retry
  replays its receipt and never rerolls, 03 §14) gets a stable ID, its spec citation and a
  pure check in both kernels. Tests and the simulator check invariants by ID.
- **Deterministic simulation (R5).** Seeded random command sequences run through both
  kernels; every step compares canonical bytes and checks every registered invariant. A
  failure reproduces from its seed and is shrunk to a minimal case. About 500 seeds per
  PR; the 10,000-sequence run stays nightly.
- **Fault simulation (R6).** The same runs through the local authority with injected
  host faults: failed commit, unknown commit outcome, kill after commit before reply,
  duplicate delivery. Storage faults are real SQLite faults (AGENTS.md).
- **Owner attention goes to invariant lists and harness changes**, not line-by-line code.
- Not now: TLA+ (revisit for Realm handoff and cross-authority effects, R14/R20) and
  production telemetry loops (no production yet; phone timing at R6P is the stand-in).

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 | 6 | PR 1 portable ABI; PR 2 schema toolchain + identity/scope/error contracts; PR 3 action/command/delta/event/effect/result contracts + invariant registry; PR 4 capabilities, manifests, facts, GameView, account/progress; PR 5 StateDelta composition in both kernels against the composition fixtures + invariant checks; PR 6 R3B envelopes, gate review, docs tidy pass |
| R4 minimal | 3 | loader, validation, reference resolution, capability lock, canonical artifact hash, diagnostics |
| R5 subset | 7 + 1 | world rules the Lantern needs, in both kernels; plus the deterministic simulation slice |
| R6 | 5 + 1 | local authority, SQLite, receipts, recovery, save slots, milestone capture; plus fault simulation |
| Early R7/R8 | 5 | one quest, a dialogue choice, a schedule, reactions, narration |
| R6P | 4 | compiled Lantern cartridge, touch UI, device and human proof |

About 32 slices. Estimate (2026-09-24, from one measured slice): 8 to 18 million tokens,
most likely about 13 million; 2 to 5 weeks of calendar time, bounded by owner approvals and
device sessions. Re-estimate after R3.
