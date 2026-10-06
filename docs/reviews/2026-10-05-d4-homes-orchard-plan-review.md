# D4 homes and orchard — independent plan review

**CHANGES REQUIRED.** Reviewed local `planning/d4-homes-orchard` at exact
`7779c0fe2ff2a737d69edbf0a215c5caa86189f5`, against published baseline
`c2cf8938a30a65335edc6e5c139c65c61e5105d5`. This fresh reviewer authored none
of the plan. Docs-only review; no source approval or implementation proof.

## Requirements derived before the diff

- Installed [B5 Harvest](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract)
  conserves actual finite items; ordinary Take/Drop shares stock. Installed
  [B8 services](../system/mechanics.md#b8-mauds-immediate-services-selected-contract)
  provide immediate capped recovery, without held food or Eat.
- [Composition](../system/architecture.md#building-mechanics-by-composition) permits
  only the first consumer's smallest missing invariant: direct held-food admission,
  one atomic custody/resource writer group, conserved identity and irreversible
  consumption. Foundation changes retain independent two-kernel contracts.
- [Q2 returns](../system/cartridge.md#q2-c-rescue-return),
  [A1 loss](../system/cartridge.md#q3-b-bell-first-prior-and-lost),
  [real cast](../decisions/owner-decision-real-chapter-cast-2026-10-05.md) and
  [no waiting](../decisions/owner-decision-no-wait-opening-2026-10-05.md)
  require exact child truth, original Wren/Elspeth custody and public recovery routes.
- [Receipts](../system/save.md#receipts) and
  [item details](../system/book-ui.md#item-details-and-takedrop) require confirmed,
  once-only, visible results, with honest replay/reopen after custody changes.

## Finding

**D4-P1 — should-fix — select the visible Eat result after its item disappears.**
At [book-ui.md:719](../system/book-ui.md#d4-home-details-and-carried-food-eat),
confirmed Eat removes the apple and must present its narration once, but the plan
never selects where that result/history lives. The installed item-page rule closes
obsolete details when their item stops projecting. Its actual flow routes an item
result to that detail (`mobile/app/book/presenter.ts:78`) and prunes the absent
item's route (`mobile/app/book/model.ts:57`). Thus Forage → open held apple → Eat
implemented through the stated existing Book flow appends the confirmation to a
closed, inaccessible detail. Cold reopen also needs an explicit destination and
receipt binding for the now-unprojected item; current receipt detail classification
has no Eat branch (`mobile/authority/local-story/save.ts:162`). This is a planning
gap, not a claim that unbuilt Eat code was exercised.

Select the visible confirmed-result destination, reconcile it with the existing
item-page closing rule, and bind replay/reopen routing to the original Eat
command/item. Add explicit acceptance for live consumption, lost acknowledgement /
exact replay and cold reopen when the consumed item is absent. Reuse existing
receipt/log machinery; no new transcript or persistence row is needed.

## Checks and bounded conclusions

Read all eleven changed Markdown files, the governing clauses, workflow/reviewer
rules and relevant lessons; inspected installed Harvest, schedules, fresh allocation,
containment/foundation guards, full receipt-history replay and Book routing.
All five cited dependency merge commits are ancestors of the pinned baseline;
chapter0.0.25/API1.23/hash/111-ID evidence agrees with the retained B8 review.

The new roomless holder is justified: installed destinations remain recoverable,
while deleting identities or adding a second spent ledger would weaken the selected
contract. The plan explicitly requires direct-body entry, no nonfood/foreign entry
or escape, terminal query behavior, receipt-backed reconstruction, malformed-save
refusal, real SQLite COMMIT/replay checks, independent successor pins and frozen-fixture
preservation. Three finite 100g apples and +6 MV remain cartridge numbers. Cast,
reciprocal rooms, exact four-way child prose and dusk schedules agree with installed
truth; shared-source serialization and null future proof are explicit.

Ponytail Review: no additional machinery to cut; existing Harvest, schedules,
resource adjustment and receipt-history replay cover reuse. The terminal holder
adds only the missing invariant. No second food ledger or general deletion framework.

`git diff --check c2cf8938 7779c0fe` passed. `mise exec -- elixir
bin/check_docs.exs` passed: 606 documents, zero broken links or unreachable files.
No implementation tests/mutations, browser/native/save session or full check line
was run for this planning-only diff, per the workflow. **D4-P1 remains open.**
