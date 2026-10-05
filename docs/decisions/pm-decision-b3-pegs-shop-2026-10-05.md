# PM decision: B3 Peg's immediate shop — 2026-10-05

Under the [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
the PM adopts a finite, identity-conserving Peg shop for the real Missing Child
chapter. The normative mechanic is in [mechanics](../system/mechanics.md#pegs-immediate-shop-b3-selected-contract),
the exact shelf and tuning in [cartridge](../system/cartridge.md#pegs-b3-shelf),
and the re-pinned developer assignment in the [B3 brief](../briefs/chapter-one/b3-pegs-shop-brief-2026-10-05.md).
This is a planning decision, not implementation or proof.

The current cartridge creates one instance per authored item definition. Four
Peg-held items therefore give B3 a complete buy/sell loop without a new item
creation operation, stock ledger or restock schedule. A sold item returns to Peg's
actual stock with the same ID. A small satchel provides an immediately usable
storage purchase; the torch, oil and waterskin establish the real supply consumed
by B4 and B7. Their later uses are not advertised until those slices land.

The initial four-item shelf is intentionally finite. The no-wait opening rule
forbids a mandatory next-day restock gate. B4's optional dark passage and B7's
well interaction may consume this supply, but neither may make chapter completion
or possession recovery depend on an unavailable shop item. If a later complete
consumer needs renewable supply, that slice must adopt its own bounded provenance
and recovery contract before exposing the need. Archived daily chandler restock and
dynamic pricing remain historical proposals.

B2's local source is merged at `ec3ab73d` (chapter 0.0.16/API1.14). It installed
the nonregenerating penny resource, exact conserved transfer, Peg and her ledger.
The later B3 release, artifact hash, generated item IDs and source review head are
unknown until implementation; no older pin is asserted for them.
