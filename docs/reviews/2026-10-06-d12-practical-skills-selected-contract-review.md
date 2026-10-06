# D12 practical skills — selected-contract review

Reviewed PM adoption head `e49e977057bc305c3c3635e393eceb800a6344c2`
on `planning/d12-skills-adoption-draft`, against published predecessor
`815f66f9039ca22f80d44112a1ff966eadb8381e`. Fresh independent reviewer;
authored none of the selected contract; separate detached worktree.

Verdict: **APPROVE** for the selected documentation contract only.
No findings. Implementation, source assignment, successor pins and source proof
remain pending; this review supplies none of them.

Requirements derived before the diff: [C1 acquisition/qualification](../system/mechanics.md#c1-training-and-armed-defense-selected-contract)
must remain separate; [B5](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract)
must conserve finite identities and combined carrying;
[B3](../system/protocol.md#b3-shop-composition) must bind the current effective
quote before conserved exchange; [D1](../system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract)
free swim and recovery remain usable. The [workflow](../WORKFLOW.md#loop)
requires exact offered/resolved input, shared admission and independent source
proof. The [PM decision](../decisions/pm-decision-d12-practical-skills-2026-10-06.md)
is indexed by [owner rules](../system/owner-rules.md#product-and-scope).

Verified selected contract:

- [Cartridge declarations](../system/cartridge.md#d12-practical-skill-declarations)
  select both 2p lessons, new INT10 start, INT10/MV5 herbalism and DEX10/MV5
  haggle qualification. Acquisition permits currently unqualified actors and
  cannot charge a second grant. Existing starts, free swim and optional routes
  remain governed by their existing clauses.
- [Mechanics](../system/mechanics.md#d12-practical-skill-consumers-selected-contract)
  transfer the two lowest eligible room-held herb IDs with combined carrying,
  one writer group and one event per transfer. Stock-one/capacity-one refusal
  preserves ordinary one-item Harvest/S9; no mint, regrowth or stock ledger.
- [Protocol](../system/protocol.md#d12-harvest-method-and-buy-quote-composition)
  pins `gather_carefully`, `[patch_detail_id]`, `{method: "careful"}` and the
  resolved Harvest payload. Keyed input and opted metadata share admission;
  ordinary Harvest omits method. Historical D12-P1 remains closed, and its
  preserved original review is byte-identical to `5dc4cfca`.
- Peg's seven base prices independently yield Buy2/1/3/4/7/3/3 under floor9/10,
  minimum1; Sell remains1/1/2/2/4/2/2. Shared current quote/admission after
  elapsed settlement refuses stale cheap or dear input before payment/custody.
- Optional closed `harvest.careful` and `shop.buy_discount` fields have actual
  consumers, declared references, capability/action validation, bounded integer
  counts and safe arithmetic. No unselected field names or generic framework.
- [Save](../system/save.md#d12-lesson-careful-harvest-and-discount-recovery)
  validates historical qualification/quote/custody at the accepted revision,
  permits legal later changes and requires atomic COMMIT/fence/replay proof.
  [Book](../system/book-ui.md#d12-practical-lessons-and-benefits) uses those same
  queries, binds displayed input and routes confirmed history once.

Source inspection confirms the existing skills/lesson-payment, finite `selected`
and `carryingExchange` seams. Current Harvest still transfers one item; closed
Harvest/ActionInput still omit method, and commerce still quotes authored bases.
Those gaps are explicitly future work. The actual patch contains twelve distinct
room-held20g herbs under12000g carrying. D1 merge ancestry and source v030 match
the brief; the frozen canonical hash recomputes correctly and allocation fixture
contains149 labels. No new compilation, fresh-world or D12 runtime proof claimed.

Validation: `mise exec -- elixir bin/check_docs.exs` passes before the record
(648 documents) and after it (649 documents), zero broken links/unreachable;
`git diff --check` passes. Normal commit hook passes. No source tests/mutations,
browser/native/simulator preview, owner-save access, push or PR performed.

Ponytail Review: lean already; no complexity findings. net: -0 lines possible.
