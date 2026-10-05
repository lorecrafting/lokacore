# PM decision: B7 Well and waterskin — 2026-10-05

Under the [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
the PM adopts [B7's selected mechanics](../system/mechanics.md#b7-well-and-waterskin-selected-contract)
and [cartridge tuning](../system/cartridge.md#b7-water-and-vessels) for the
[implementation brief](../briefs/chapter-one/b7-well-waterskin-brief-2026-10-05.md).
This is planned behavior, not implementation, review approval or release proof.

The real consumer is the Well Lane well and two finite Peg-held waterskins.
Adding one spare offer is the smallest complete Pour acquisition route with
B3's existing exact-instance shop. Water uses integer quarter-litre units and
real carrying mass; Fill creates only declared environmental water, Pour
conserves both vessels' quantities and Drink consumes one authored serving.
Reachable actor-owned nested vessels are usable; ground/corpse vessels require
ordinary acquisition first. Empty skins persist. There is no passive need or
resource benefit in B7; B8 must adopt its later benefit in its own slice.

The [typed operation](../system/protocol.md#b7-liquid-composition),
[receipt-backed recovery](../system/save.md#b7-liquid-recovery) and
[Book boundary](../system/book-ui.md#b7-water-details) are part of this adoption.
One per-item row and exact replacement operation are necessary because item
custody and current resources cannot express vessel kind/capacity; they do not
justify a fluids framework. B4 fuel remains its own time-bearing representation.
B3 is the sole new-slice dependency; B4, B5 and C1 integrate independently with
re-pinned release answers. Their future versions/IDs and source proof stay null.
