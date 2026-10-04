# Owner decision: LegendMUD mechanical baseline — 2026-10-03

**Current-status pointer, 2026-10-04:** the original wording and provenance remain preserved.
Later adopted mechanics and scope follow the [current PM reconciliation](pm-decision-legend-mechanics-reconciliation-2026-10-04.md);
its selections do not alter the owner quotations below.

## Owner words

Recorded by Codex from this session, verbatim:

> Okay lets base our system of LegendMUDs

> Also do a more thorough search and understanding of LEgendMUDs system

The owner then clarified that LegendMUD is the game and approved looking into LegendHUB as its
supporting wiki. That clarification is paraphrased here.

## Direction adopted

**PM interpretation of the approved direction:** use LegendMUD as the default reference for
Loka's character, resource, skill, magic and combat mechanics. Before implementing a mechanic,
research the applicable Legend rule, reconcile the existing Loka plan and describe any deliberate
departure. This is an approved direction, not approval of every coefficient or historical rule
found on the web. The [research reference](../reference/legendmud-system.md) distinguishes official
help, dated staff updates, community guides, a pinned calculator proxy, and unknowns.

The engine still owns mechanics and cartridges own numbers and world settings
([world-parameter decision](owner-decision-world-parameters-2026-10-02.md)). Loka retains its world,
prose, quests, ancestries and factions. Adopting this baseline does not import Legend's historical
areas, hometown catalog, full skill catalog or online economy into a bundled offline chapter.
Those are scope choices for their content and mechanic slices.

## Reconciliation before implementation

The archived [first-cartridge design](../archive/spec/00-first-cartridge-design.md#4-feature-list)
and its [release ladder](../archive/spec/00-first-cartridge-design.md#11-release-ladder-three-chapters-one-world)
remain historical plans. This forward decision changes their mechanical planning basis where
needed; it does not silently change installed capabilities or rewrite their implementation contract.

| Area | Existing Loka plan or implementation | Required reconciliation |
|---|---|---|
| Attributes | STR/DEX/CON/INT/SPI/PER; installed attributes are content-defined starts | Legend uses Mind. Resolve the INT/Mind content vocabulary and identifiers in the first character-design slice; no schema/key rename here |
| Pool maxima | Installed cartridge maximum/start and fixed gain; old Diku-derived defaults | Plan CON→HP, Mind→MA, DEX→MV derivation against verified level-aware rules; current content values are not Legend formula implementations |
| Recovery | Per-game-hour installed gain; archived Diku position multipliers | Specify cadence and modifiers in the time/recovery slice. Official REST describes equal REST/SLEEP rates; do not infer the old Loka multipliers from Legend |
| Skill access | Six named chapter-one skills in the old ladder | Use classless, stat/level/prerequisite-qualified acquisition from teachers as baseline; select and verify the release subset in the skill slice |
| Skill progression | Old ladder says learn-by-doing | Universal use growth and neglect decay are unverified current Legend rules. Separate acquisition practices, stat-based effectiveness and any deliberately adopted proficiency growth |
| Guilds | Old guild/secondary-guild progression | Reconcile any class-like exclusivity with classless access; guilds may remain story affiliations, but their mechanical gates need an explicit design |
| Attribute training | Old chapter-three guildhall/pennies training plan | Reconcile direct stat purchases with Legend's base/quest/equipment model before building a writer; chapter three remains the old scheduling reference, not proof of Legend behavior |
| Gear and combat stats | Twelve equipment slots installed; modifiers and combat later | Plan capped effective stats, separate derived roll/AC/mitigation/spell stats and equipment allowances; verify the resolver rather than equate AC with dodge |
| Magic | Old chapter-two spell/word and guild design | Use learned word combinations as baseline; choose the small release subset and verify qualification, practices, cast levels and failure mechanics |
| Death and persistence | Combat/death later; transactional offline saves already required | Verify death/recall/recovery rules and explicitly adapt them to offline play; rent restrictions never weaken the existing save guarantee |

This table is the planning carry, not a new implementation checklist for Gate C1. Numerical
examples in the research reference describe LegendHUB's level-50 builder; they are not release
starting values or arbitrary-level formulas approved for Loka.

## Scope and implementation trigger

The [approved chapter-one stage](owner-decision-chapter-one-plan-2026-10-02.md) remains twelve
slices and Gate C1. Combat, death, skills and the later time model stay after that gate. The
current Lantern proof's values and clock behavior remain governed by the
[untimed-Lantern decision](owner-decision-untimed-lantern-2026-10-02.md).

Before the first implementation slice for a reconciled area, amend the active `docs/system`
clause with its source/version, applicability, controlled expected examples and any Loka departure.
Unverified equations remain `null`; a public calculator is not a full game-engine contract.
Resolve a conflict explicitly before changing code, protocols, fixtures or cartridge parameters.
The PM plans the slices under the existing delivery workflow; this record does not approve a
new release scope or install a capability.
