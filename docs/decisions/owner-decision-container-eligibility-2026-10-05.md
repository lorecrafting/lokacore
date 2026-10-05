# Authored receptacles only

Owner direction (paraphrased, 2026-10-05): only authored receptacles can hold items.
A brass key must not offer Put storage chest or clothing into itself.

The optional item field `container: true` grants eligibility; absence denies it.
Capacity bounds occupancy and a barrier closes a receptacle; neither grants eligibility.
Corpse templates explicitly remain receptacles for conserved forced custody.
See [containment](../system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets)
and the [compiler/loader contract](../system/cartridge.md#compiler).

PM implementation disposition: this is preproduction, with no API compatibility branch.
Frozen historical artifact bytes and encoding/hash answers remain unchanged. Artifacts
with children, capacities or lids on unmarked items are rejected by the current loader;
current behavior uses separately named, independently derived fixtures. Three current
transcripts replay the same commands; original recordings remain historical fixtures. The active
chapter advances to 0.0.3; exact-pin save refusal remains and no save is reset or migrated.

Composes with existing custody, lids, capacity, projected action pairs, equipment and
forced death transfers. No new capability, operation or stored custody field is added.

Owner follow-up (paraphrased): after chapter mechanics stabilize and before public release,
review a clean development baseline with current fixtures/traces active, obsolete
preproduction checks/evidence archived or removed from active runs, Git history retained
and no compatibility adapters. The [roadmap carry](../ROADMAP.md) defers that cleanup.
