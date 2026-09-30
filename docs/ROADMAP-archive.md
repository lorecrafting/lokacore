# Roadmap archive

Finished stages and the token estimates, moved out of [the roadmap](ROADMAP.md) so it shows only what is current. History, not plan.

| Stage | Slices | Content |
|---|---|---|
| R3 | 8 | Done; [Gate R3](reviews/2026-09-24-r3-gate-review.md) passed with noted gaps against [14 §R3A/§R3B](spec/14-implementation-plan.md#r3--contractschema-foundation). PR 1 portable ABI (#4); PR 2 schema toolchain + identity/scope/error contracts (#9); PR 3 action/command/delta/event/effect/result, policy AST, TargetResolution + invariant registry (#13); PR 4a capability registry/lock, manifests (#12); PR 4b facts, relations/provenance, GameView, account/progress envelopes (#14); PR 5 StateDelta composition in both kernels + invariant checks (#15); PR 6a R3B envelopes (#11); PR 6b gate review, docs tidy pass, generated capability docs and residency matrix (#16) |
| R4 minimal | 3 | loader, validation, reference resolution, capability lock, canonical artifact hash, diagnostics: S1 artifact and diagnostic contracts, owning capabilities; S2 Elixir compiler (JSON source to artifact); S3 TypeScript artifact loader |
| Observability design | 1 | between R4 and R5 ([owner decision](decisions/owner-decisions-observability-astra-2026-09-25.md)): the shared record format, event-name registry and game-trace format (accepted and rejected decisions, failed commits; never authority), frozen so `loka play` and the simulator emit them from R5's first slice. Spec 11 §11-15, 08 §6, 09 §7. [ADR-075](decisions/adr-075-observability-proposal.md); `protocol/observation.schema.json` |
| R5 subset | 10 + 1 | world rules the Lantern needs, in TypeScript (ADR-074); plus the deterministic simulation slice. Also ([owner decision](decisions/owner-decision-r5-setup-2026-09-25.md)): lint rules that fix where rule modules live and what they may touch; a MUD-style `loka play` CLI over the kernel on Node; a generated, drift-checked feature map per capability. Slices ([owner decision](decisions/owner-decisions-r5-plan-2026-09-25.md)): S1 rooms/exits, first world, look/move, `loka play`, rule lint lockdown; S2 target resolution, feature map; S2b short references in cartridge source ([owner decision](decisions/owner-decision-short-refs-2026-09-25.md)); S3 facts, conditions, state-dependent descriptions; S4 take/drop/give, containment checks, item text (keywords, short description, room line, examine) and inline touch links ([owner decision](decisions/owner-decisions-r5-s4-2026-09-25.md)); S5 ActionSet algebra, simple ActionRecipe execution; S6a logical clock, RNG use, chance checks; S6b resources: the default HP/MA/MV pools, costs, threshold checks, cooldowns, 1 MV per move, regeneration ([owner decision](decisions/owner-decision-hp-ma-mv-2026-09-25.md)); S7 barriers/locked exits and room brief mode (#50); S8 `scan` (00 §4.1) and loose ends; +1 deterministic simulation, then Gate R5. Done; Gate R5 passed ([review](reviews/2026-09-30-r5-gate-review.md)); deferrals are in the R6, early R7/R8 and R6P rows. |

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
