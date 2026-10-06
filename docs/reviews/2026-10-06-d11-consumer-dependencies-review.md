# D11 real-consumer dependency correction — independent review

Verdict: **APPROVE**. Exact docs head
`abf25758ed3a2cb53a952be97f38ae7e8f681879`, branch
`planning/d11-consumer-dependencies`, base
`dec92357f6bdc6242e06ceb56f7c9da0abed8a84`.
Fresh reviewer; authored none of the four reviewed documents.

Requirements: the [completion plan](../MISSING-CHILD-PLAN.md#rules-for-each-brief)
requires merged, re-pinned prerequisites and actual first consumers;
[attributes](../system/mechanics.md#attributes1) currently have immutable authored
starts, while [B6 tuning](../system/cartridge.md#b6-marsh-route-and-tuning)
requires immediate passing discovery for every fresh choice. The
[owner's content decision #4](../decisions/owner-decision-chapter-one-content-2026-10-02.md)
retains fey +SPI/Priory −2 and defers its spell word. Proposed tuning is not source
GO or an adopted oracle.

No findings. D11 now waits for D6 swim and D12 haggle as real inherited-skill
consumers, alongside B2/B4/B6/C1. D12 explicitly has no reverse ancestry/override
prerequisite and selects any missing INT declaration with itself. D6 already
consumes D1's lesson independently of D11. The completion-plan dependency rows,
ROADMAP carry and the two briefs agree. The correction preserves the fey rule,
labels numerical tuning as provisional, and removes the invented PER11 discovery
gate without adding a new mechanic or claiming implementation proof.

Independent checks:

- Parsed all 30 implementation dependency rows and traversed every edge: acyclic;
  D11 requires D6/D12, neither has a reverse D11 edge.
- Inspected source `attributes.json`: STR10/DEX10/PER5. Actual `seek_wisp.json`
  uses `per`, difficulty5, light-off and undiscovered policies; no PER11 gate.
- Exact base-to-head diff contains only the four declared Markdown files; owner
  decisions, source, contracts and fixture answers are unchanged.
- `mise exec -- elixir bin/check_docs.exs`: 623 docs, zero broken/unreachable.
  Documentation pointer and docs-only routing red controls pass; `git diff --check`
  passes. The review-record commit's normal hook rechecks documentation reachability.
- Correctness and Ponytail Review: lean already; no unnecessary machinery or
  additional dependency introduced. No source tests, full suite, preview or device
  run was needed for this bounded docs correction.

This approves the dependency correction only. D11/D12 policy adoption, active-spec
amendments, actual merged-source pins and implementation proof remain future gates.
