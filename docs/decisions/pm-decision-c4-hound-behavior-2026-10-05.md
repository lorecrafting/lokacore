# PM decision: C4 hound response, pack assistance and flight — 2026-10-05

Under the [mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
the PM selects [C4 behavior](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract),
[pack/flight parameters](../system/cartridge.md#c4-pack-response-and-wounded-flight),
[composition](../system/protocol.md#c4-pack-encounter-and-flight-composition),
[save](../system/save.md#c4-pack-and-flight-recovery),
[Book](../system/book-ui.md#c4-pack-response-and-enemy-flight-details) and the
[implementation brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md).
This is PM planning adoption, not independent approval, source GO or proof.

C4: hounds respond to deliberate player aggression, assist their admitted pack and
flee when wounded. Resolve the earlier provisional brief's night-auto-aggression
recommendation in favor of this smallest [current-plan](../MISSING-CHILD-PLAN.md)
consumer. Explicitly defer the [archived population row](../archive/spec/00a-chapter-one-content.md#populations)'s
aggressive20–6 clause. C3 still owns its bounded day/night population and wandering;
C4 does not duplicate spawning, add hostile room entry or invent safe-mode flags.
Required journeys and actual corpse recovery remain free of unsolicited combat.

Admit exact same-plan, living co-present unengaged hounds once when Attack opens
one encounter; retain the attacked instance as primary and first opponent. One
enemy opportunity rotates canonically per round, retaining odd/even initiative,
the shared eight-raw-draw budget and C1 resolver. A dead/departed selected member's
opportunity is skipped, never reassigned during that round. This expressly amends
pack initiative under [the Legend reconciliation](pm-decision-legend-mechanics-reconciliation-2026-10-04.md#current-mechanics-policy);
pack help is an actual rotating attack, not an extra swing for every helper.

Strict below25% HP attempts a deterministic legal area flight before that member's
attack. Preserve the same injured identity/pelt, no death/loot/credit, no player
fare and no chase. No legal exit leaves one ordinary opportunity at most. One
nullable last-flight clock in the existing slot prevents same-deadline wander
after flight; preserve canonical job ordering, distinct groups and ordinary
cross-writer conflict refusal. No new behavior scheduler/framework is needed.
Player Flee/death closes the entire pack occurrence; remaining helpers cannot
strike after escape or same-body shrine revival.

Inspected planning base `10b023e827cba4f056aa82870764afb07236938c` contains
chapter0.0.19 declaring kernel API at least1.17. The reviewed C3 plan's final
approval covers fix `0127bf4c9c02f944941008d3962982c1144fd2e2`; C1's plan is
independently approved. Neither C1 nor C3 source is complete at this planning
baseline. Their reviewed integrated source/release predecessors must be re-pinned
before assignment, including intervening shared cartridge/schema/save edits.
C4 successor release/API/hash/IDs, source head, PR, verdicts and runtime proof
remain null. No source, owner save, merge, remote publication or native work occurs.
