# D12 practical skills — independent plan review

Branch `planning/d12-skills-training`, exact plan head
`e56bb79072af9d8453ea4464031c97140803e29a`, published baseline `1b269871`.
Independent docs/plan review; authored none of the plan.
Verdict: **CHANGES REQUIRED** for D12-P1. No implementation approval is implied.

Requirements derived before the diff: the [chapter plan](../MISSING-CHILD-PLAN.md),
[B3 conserved exchange and quote](../system/protocol.md#b3-shop-composition),
[C1 acquisition/qualification](../system/mechanics.md#c1-training-and-armed-defense-selected-contract),
[B5 finite item custody](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract),
[D1 scope](../system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract),
and the [workflow's exact offered-invocation requirement](../WORKFLOW.md#loop).
D12 must use the twelve actual eligible herb identities, preserve ordinary one-item
Harvest and S9, separate learning from current qualification, bind the effective
Buy quote at admission, and keep D1 source/pins/proof pending until actually available.

## D12-P1 — should-fix — exact careful-gather input is unspecified

`docs/briefs/chapter-one/d12-practical-skills-brief-2026-10-05.md:18` names
`gather_carefully`, resolved `harvest` and a patch target, but only calls its input
"a typed careful-method input". Line24 requires an exact alias invocation test
without defining that input. The workflow requires its field and value in the brief.

The existing Harvest command permits only `type`, `actor_id` and `target_id`, with
no additional properties; the input binder currently declares no method parameter.
A presenter could therefore advertise two-item gathering while resolving ordinary
one-item Harvest, or send a method that the schema/binder rejects. The current text
does not pin which command the required test must independently expect.

Recommend selecting explicitly in the plan:
`action_key: "gather_carefully"`, `target_ids: [patch_detail_id]`,
`input: {method: "careful"}`, resolving to
`{type: "harvest", actor_id, target_id: patch_detail_id, method: "careful"}`.
Ordinary Harvest retains `input: {}` and an omitted method. Another exact typed
shape is acceptable if selected consistently. Name the narrow command/ActionInput/
invocation-binding extension as D12 scope and require the loaded alias check to
assert the selected literal payload before its two-item result. The reviewer has
not amended the proposed policy or source.

## Other checks

- The revised brief uses the same twelve individually authored Willow Shade herbs;
  careful gathering conserves the two lowest eligible IDs with combined carrying
  admission, two acquisition events and atomic refusal. It promises no stock ledger,
  regrowth, mint or Herb Garden consumer. Ordinary Harvest and S9 remain usable.
- C1 permits unqualified actors to learn; D12 now preserves that distinction and
  uses current policy truth for benefits. INT is explicitly a new proposed chapter
  declaration; the current attributes contain STR, DEX and PER, without INT.
- Haggle reuses B3 `quoted_price` and the shared current offer/admission query after
  elapsed settlement. The proposed chapter-owned ratio/floor preserve Sell and
  conserved payment; no quote token or extra price system is needed.
- D1 implementation and successor pins/proof remain explicitly null and block source
  assignment. D12 precedes D11. PM adoption and active-spec amendments are required
  before code; proposed policy is not presented as installed behavior.
- Actual diff: two documentation files only. `mise exec -- elixir bin/check_docs.exs`
  passes: **636 documents, zero broken links, zero unreachable**; diff whitespace
  check passes. No source tests or mutations are appropriate to this docs-only review.

Ponytail Review: lean; existing dialogue acquisition, custody, quoted price and
receipt recovery cover the proposed consumers. No complexity finding. No source,
browser/native, owner-save, runtime or publication proof claimed.
