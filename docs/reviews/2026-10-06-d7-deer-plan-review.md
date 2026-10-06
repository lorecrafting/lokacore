# D7 bounded deer planning review — 2026-10-06

Reviewed `fec51d6d` against published `e9db5bdf`. Independent docs-only review; no source, owner save, native session or runtime proof changed.

## Requirements derived before diff

The archived chapter-one population row requires three instance deer with fresh homes in Willow Shade, Drowned Oak and Orchard, two-world-day replacement, wandering, sight flight and hide loot. Published C3 admits a paired member/item birth in one home and bounded two-room plan, exact slot generations, one control job, hourly legal wander and death-only replacement. Published C4 retains canonical job ordering, engaged-member wander suppression and a same-clock flight guard. D7 must make the original deer targetable and killable before a live sight departure, conserve its exact hide through corpse and custody, validate historical/pending work on cold reopen, and avoid new world numbers in engine code.

## Verdict: CHANGES REQUIRED for source assignment

1. **Should-fix — missing required day/night boundary values.** `docs/system/cartridge.md:1268-1274` selects equal day/night targets but does not select `night_start` or `night_end`, both required by the current plan schema and used by `kernel/ts/src/mechanics/population/shared.ts:44-48,111-116,144-147`. If a developer authors the three plans from this contract, they must invent two world values or copy the hound values without authorization. Select explicit D7 values, even though equal targets make the boundaries behaviorally neutral.

2. **Should-fix — deer arrival lacks a defined event producer.** `docs/system/mechanics.md:1479` and `docs/system/protocol.md:1121` require a sight job when a deer arrives in the player's room, bound to an originating co-presence event. Current population wandering writes only `entity.transfer` (`kernel/ts/src/mechanics/population/shared.ts:194-231`); unlike ordinary player movement and scheduled NPC movement, `runPopulation` emits no `entity_entered_room` event. A deer wandering into the player's room can therefore remain present indefinitely without a flight deadline if source follows the existing event seam. Specify the narrow population arrival event and its logical-time/causation binding, or explicitly bind from the checked population transfer in the same dispatch.

3. **Should-fix — attack profile remains deliberately unselected.** `docs/system/cartridge.md:1274` and `docs/briefs/chapter-one/d7-deer-brief-2026-10-05.md:19` require an attackable deer but leave its chance and damage for a later decision. The schema requires those values (`kernel/ts/src/content/cartridge_population.ts:74-91`), so source cannot author a legal NPC without inventing them. Select literal values and verify C1's combat bounds before assigning implementation; this is already acknowledged in the plan.

The three paired rooms are reciprocal in the actual cartridge; the plan can support separate original identities, legal refuge, a +150 combat round before +300 sight flight, exact +172800 eligibility and ordinary corpse/hide custody. HP1 and 100g are selected.

Ponytail Review: lean already; the three one-slot plans reuse C3 and avoid a new multi-home scheduler. No additional complexity finding. Docs-only review: no tests or mutation runs required. `git diff --check e9db5bdf fec51d6d` passed.
