# PM decision: C3 bounded living Fen hounds — 2026-10-05

Under the [mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
the PM adopts [C3 population and deliberate fight](../system/mechanics.md#c3-bounded-living-hounds-selected-contract),
[chapter parameters](../system/cartridge.md#c3-hound-population-and-loot),
[typed creation/composition](../system/protocol.md#c3-spawned-bundles-and-population-composition),
[save integrity](../system/save.md#c3-living-population-recovery),
[Book](../system/book-ui.md#c3-living-hound-and-loot-details) and the
[implementation brief](../briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md).
This is planning adoption, not source GO, independent approval or executed proof.

Explicitly amend the [archived population row](../archive/spec/00a-chapter-one-content.md#populations):
4/6 are eligible daytime/nighttime slot targets beneath cap6, with living nighttime
surplus retained at dawn. A shortage is not permission to bypass a dead slot's
one-day delay. Restrict initial area to Hound Run and Adder Nest, preserving the
required Reed Bank/Mire/rescue/corpse routes. Only deliberate Attack initiates
combat in C3. C4 alone owns aggression, actual pack assistance and enemy flight;
C5 owns bleeding. Bell disable waits for its later reviewed reaction consumer.

The smallest consumer uses six slots and one plan-owned job, ordinary adjacent
wandering, and exactly one hound plus one real pelt per new generation. No per-beast
scheduler, random ecology, rare loot table, skinning, sale offer or decay system is
needed. Death transfers the existing pelt to a new hound corpse; replacement creates
new identities and preserves historical corpses/loot. Live/work bounds do not claim
bounded lifetime save size. The template-only NPC and held-item creation exception
must be validated in both portable foundations; schema-only provenance is not an
installed live spawn implementation.

C3-P1 correction separates fixed slot mutation targets from plan job control. Each
transition checks its own complete prior row; control has no duplicated membership
index. Fatal combat updates only its victim slot, never control; the population
job updates control and only actual birth/replacement slots. Preserve canonical
job-ID order and distinct writer groups even at equal deadlines. Require wander
interval <= replacement delay so death never needs to reschedule the plan job.
Population-first skips an engaged victim; combat-first skips its newly dead, not-due
slot. Same-slot cross-group writes still fault `conflicting_write`. This resolves
the plan's whole-row collision without a scheduler rewrite or conflict exemption.

The one-day replacement is optional replenishment. No required quest, main route,
loss retry, corpse/loot recovery or first Book proof depends on it. A surviving
opponent is immediately retryable; a defeated opponent's pelt is immediately
available. Replacement/fault proof advances the existing trusted clock under a
controlled test host, without adding player Wait or requiring a real next-day wait.

Inspected local main `98cc60b1647d031eed790ca085681bbe62af9d73`, chapter0.0.18/API1.16,
contains B1/B3 and approved C1 planning. C1 implementation is active; B5/other earlier
cartridge integrations and their actual predecessor pins are unknown. B5 is not
a mechanics dependency of hounds, but its release edit must serialize before any
successor pin is derived. Re-pin the reviewed integrated B1/C1/combat dependencies
before source assignment. C3 successor release/API/hash/IDs, source head, PR,
independent verdicts and proof remain null. No source files or owner save are changed.
