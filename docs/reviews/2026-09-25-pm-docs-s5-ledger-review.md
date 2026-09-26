# Review: #43/#44 ledger lines; Astra takes the Fable slots (PR #45)

- PR: #45, branch `pm-docs-s5-ledger`, commit reviewed `d978057`
- Reviewer: Opus 5.5 (docs-only slice: short review, no mutation testing)
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. Each new `docs/dev-evidence.jsonl` line matches the existing `agent.work` shape
   (AgentWork in `docs/contracts.gen.md`): one record per (pull_request, role, instance),
   tokens `unknown` when not reported, never 0; the registries test stays green.
2. The ledger covers every agent on #43 and #44 and nothing else.
3. The WORKFLOW change stays inside the owner's delegations: Fable is suspended
   (all reviews on Opus), Astra is for foundational freezes only, and the Fable slots
   in the review lever are foundational freezes.

## Checks

- Ledger: six lines, same key set and ordering as lines 1-35. #43: pm (unknown),
  reviewer opus 59459; no developer (the PM authored #43). #44: pm (unknown), developer
  opus 407441, reviewer opus 203584, reviewer astra instance 2 (unknown), matching the
  Astra section of `2026-09-25-r5-s5-review.md` and the earlier Astra lines for #29 and #34.
  (pull_request, role, instance) unique. File ends with a newline.
  `mix test test/loka/core/registries_test.exs`: 16 passed (that test is the one that reads
  the ledger, per ADR-075).
- WORKFLOW: the remaining lever slots (simulation, R6 authority/save, GameView for touch)
  are the lever's foundational freezes, where Astra was already eligible ("Astra and a
  broad second review round only for those foundational freezes"). Committing Astra to them
  is the PM using the judgment delegated in `owner-decisions-observability-astra-2026-09-25.md`;
  the Opus reviewer still runs (Opus-reviews decision), so Astra is added, not a replacement
  for the Opus review. Consistent with both decisions. "Remaining" is right: facts/conditions
  (#40) and ActionRecipe (#44) are done.

## Findings

- **N1 (nit)** `docs/WORKFLOW.md:25`: the next sentence still says Astra "runs beside the
  Fable review", which is the #43 review's open nit; right after the new text saying
  Fable is suspended and Astra takes its slots, a reader may conclude Astra runs nowhere
  while Fable is suspended. "beside the design-judgment review" (or "beside the Fable or,
  while suspended, Opus review") would close it.
