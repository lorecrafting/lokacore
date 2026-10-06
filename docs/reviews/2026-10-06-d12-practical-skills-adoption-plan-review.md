# D12 practical skills — independent published-baseline plan review

Reviewed unadopted branch `planning/d12-skills-adoption-draft`, exact head
`08ff4879c8bae21fbd012ce4b8b190eabc6ee8b4`, against published baseline
`815f66f9039ca22f80d44112a1ff966eadb8381e`. Authored none of the draft;
review performed in a separate worktree. Verdict: **APPROVE** for planning only.
No open findings; PM adoption, active-spec selection and source GO remain separate.

Requirements: [C1](../system/mechanics.md#c1-training-and-armed-defense-selected-contract)
separates learning from current use qualification;
[B5](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract) conserves actual
finite herb identities and preserves ordinary Harvest/S9;
[B3](../system/protocol.md#b3-shop-composition) binds the displayed quote to
post-settlement admission and conserved payment;
[D1](../system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract)
retains free swim and safe return. [Composition](../system/architecture.md#building-mechanics-by-composition)
and the [workflow](../WORKFLOW.md#loop) require the exact offered invocation,
shared queries, cartridge-owned numbers and independent source/recovery proof.

## Historical D12-P1 — closed on this draft

The [preserved original review](2026-10-06-d12-practical-skills-plan-review.md)
is byte-identical to its `5dc4cfca` predecessor. Its CHANGES REQUIRED verdict
remains historical. The current brief at
`docs/briefs/chapter-one/d12-practical-skills-brief-2026-10-05.md:20`
pins `gather_carefully`, `[patch_detail_id]`, and `{method: "careful"}`, resolving
to `{type: "harvest", actor_id, target_id: patch_detail_id, method: "careful"}`.
Lines30 and37 name the missing command/input/binding extension and require the
loaded alias to produce that literal payload before its two-item result.
Ordinary Harvest explicitly omits the method. This fixes the reported ambiguity.

## Verified scope and pins

- Git ancestry confirms D1 source merge `c20addb0` (PR231) precedes `815f66f9`.
  Independent compilation of the actual chapter matches the v030 canonical
  bytes and hash `dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9`.
  The actual loader/fresh-world probe verifies API1.26 and all149 labeled genesis
  allocations against the frozen answers, including population births/jobs.
- Source confirms Sedge in Isle Hut, free `sedge_swim`, Sedge0p, Peg20p,
  player20p and pennies0..1000; STR10/DEX10/PER5 and no INT. Existing skills,
  conjunction policies and bound `lesson_payment` support the proposed optional
  lessons without a trainer framework or qualification gate on acquisition.
- The patch references twelve real room-held 20g herbs; `selected` sorts eligible
  IDs, and `carryingExchange` supports the combined40g load under12000g.
  A narrow method-aware Harvest query/proposal can conserve both transfers and
  acquisition events atomically; stock1/load11980 refusal preserves ordinary
  one-item Harvest and S9. D1 Herb Garden contains no harvest node.
- All seven actual Peg base/Sell prices match the brief; its proposed discounted
  literals are correct. Current `exchange`/`shelf` still use authored base prices.
  Extending that shared query with the existing skills query and chapter-owned
  Buy ratio/floor preserves exact quote admission, custody, carry and payment.
  No quote store, token, stock ledger or replenishment is needed.
- The public plan makes D12 a D11 dependency. Consumer declaration field names,
  D12 successor pins and implementation/proof stay null until PM selection and
  source work. This explicit assignment gate is appropriate for a policy draft.

Validation: `mise exec -- elixir bin/check_docs.exs` passes before the record
(646 documents) and after it (647 documents), zero broken links/unreachable;
`git diff --check` passes. Compilation and the read-only pin/allocation probe pass.
Normal commit hook passes. No D12 source tests/mutations, browser/native preview,
owner-save work or publication proof were run or claimed.

Ponytail Review: lean; no speculative framework or duplicate owner. No complexity
finding. net: -0 lines possible.
