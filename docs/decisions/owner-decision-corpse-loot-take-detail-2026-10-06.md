# Owner decision: corpse-loot Take stays on corpse detail — 2026-10-06

The owner selected **Stay on corpse detail** when asked where the Book should go
after taking an item from a C3 hound corpse. The corpse detail keeps a Back option;
the confirmed pickup appears there once, and the item appears in Carrying.

This resolves the conflict between the ordinary item Take rule, which returns to
World, and the C3 corpse-loot rule. The active [Book contract](../system/book-ui.md#item-details-and-takedrop)
owns the general exception; the [C3 brief](../briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md#book-action-and-route-readiness)
applies it to the hound pelt. The C3 implementation and independent review must
prove the actual nested detail route, confirmed-only pickup history, Back navigation,
and cold-open behavior.
