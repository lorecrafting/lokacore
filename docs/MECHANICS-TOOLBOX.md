# Mechanics toolbox

The ranked plan for front-loading every common RPG mechanic as a generic engine capability plus a
tiny sampler cartridge, so the owner can later assemble their own world from finished parts
([owner decision](decisions/owner-decision-mechanics-toolbox-2026-10-08.md)). Chapter 1 stays
frozen as a mechanics sample. This page owns the ranking and each row's status; the rules of an
installed mechanic live in [mechanics](system/mechanics.md), the sampler precedent is
`cartridges/ashmere_sampler`, and the slice process is [the workflow](WORKFLOW.md) with the
[differences below](#toolbox-slice-process). The gap audit behind the ranking (read-only, main at
`3cb71825`, 2026-10-08) is folded into the **Today** column; paths are repo-relative.

## Foundation phase

Done when all four hold (Beads `loka-va9`, `loka-51b`):

1. The in-flight Chapter 1 polish batch is merged ([polish lane](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)),
   so the design system and Book template are stable before samplers are built on them.
2. **Unpinned dev preview:** the [browser preview](web-preview.md) can load any compiled cartridge
   artifact chosen at run time, so a sampler compiled with `mix loka.compile` shows in seconds.
   Dev-only: the bundled chapter pin, exact-pin refusal and save integrity rules of
   [cartridge](system/cartridge.md#current-bundled-chapter) are unchanged for real saves.
3. **Dev-only clock advance:** a development control, outside the player's Book, that moves the
   elapsed-time input forward by a chosen amount so timed mechanics (jobs, windows, decay) can be
   checked without waiting. Today only the e2e tests fake the clock (`mobile/app/tests/*.e2e.ts`
   override `Date.now`); the player [fixed-time rule](decisions/owner-decision-fixed-time-2026-10-03.md) stays.
4. The browser walkthrough (`mobile/app`: `npm run walkthrough`) and the headless simulator
   (`kernel/ts/test/sim.ts`) each run on a sampler cartridge, proven once on `ashmere_sampler`.
   Done (batch M1): `LOKA_WALK=<id>` and `--cartridge <artifact>`
   ([how](BUILDERS-GUIDE.md#preview-an-edit)).

## Already in the engine

Not ranked; reuse as is. Merchant buy/sell/buy-back with skill discount
(`kernel/ts/src/mechanics/commerce/`), light and fuel (`mechanics/light/`), carry weight
(`mechanics/containment/shared.ts` `too_heavy`), death with corpse custody and same-body return plus
NPC replacement (`mechanics/death/`, `mechanics/population/`), calendar with solar and lunar phase
(`mechanics/calendar.ts`), NPC schedules and jobs (`mechanics/schedule/`), position-driven regen
and the rest dream (`mechanics/resource.ts`, `mechanics/scene/rest.ts`), eat/drink restoring a
resource (`mechanics/food/`, `mechanics/liquid/`), bandage (`mechanics/bleed/`), containers and
earned storage (`mechanics/containment/`), riddles with a letter bank (`mechanics/dialogue/shared.ts`
`answerFits`), quest chains with outcome-keyed journal (`mechanics/quest/`, `view/quest_journal.ts`),
escort follow (`mechanics/escort/`), paid transport routes (`mechanics/transport/`), bounded
wandering populations (`mechanics/population/`), recipes with luck and attribute checks
(`mechanics/action_recipe/rule.ts`), and discovered places, map and Knock
([D10](system/mechanics.md#d10-discovered-places-observations-and-knock-selected-contract)).

## Owner decisions (2026-10-08, paraphrased)

Answers to the plan's open questions ([record](decisions/owner-decision-mechanics-toolbox-2026-10-08.md#answers-to-the-open-questions)):

1. **Levelling is class-free.** Experience grants attribute points; skills grow by use; classes may come later as starting packages.
2. **Ranged combat** starts with a same-room first strike; shooting into adjacent rooms comes later.
3. **Dev clock and unpinned preview** sit in a dev panel shown only with `?dev=1`; never in release.
4. **The Chapter 1 E1 recorder stays in CI** as the engine regression net.
5. **Spells use one engine** with per-spell requirements declared in the cartridge: spoken words (incantation text); an optional must-be-learned gate (existing learned facts, earned from quests or teachers); optional minimum level and attributes; optional reagents consumed (the crafting input consumption); a mana cost from a mana pool; optional secret words found in lore, checked like riddle answers. Intended mix: common spells open with reagents and mana, great spells are learned by quest with level and stat gates. Ranked as row 29, now split into 29a and 29b.

## Ranked toolbox

**Rank** is the batch, and table order within a batch is the order to build
([re-rank decision](decisions/owner-decision-toolbox-rerank-2026-10-09.md), from the
[roadmap review](reviews/2026-10-09-mechanics-roadmap-review.md)): shared vocabulary first (property
tags, damage kinds, statuses and attributes on NPCs and things), then what a dungeon-crawl sampler
needs, then social, combat, magic, gear, companions, economy, world events, law, the tail,
settlement and meta. Batch Settle (rows S1 to S4) comes from an owner question on housing and town
building: Realm-first in value, sampled in Story mode. Batch Realm (row R1, staff and builder
permissions) is deferred to the online Realm. Row ids are stable: the code, tests and
[mechanics](system/mechanics.md) anchors cite "toolbox row N", so ids are not renumbered. G rows
are the review's gaps, S rows the settlement group, R rows the Realm; 2b (HP maximum, in row 2's
status), 6a/6b/6c, 20a/20b, 29a/29b, 37a/37b, 43a/43b
and 48a/48b/48c are splits. Size: S under a day, M a few days, L a week or a split. **Today**:
have / partial / missing per the audit. Ids in parentheses are the
[archived queue](archive/LATER-MECHANICS.md) rows, whose acceptance seams still apply. Status is
`todo` until the slice PR flips it to `done #N`; `in progress #N` marks an open batch PR;
`merged into row N` and `split into …` keep a retired row's history; `content only` means the row
closes with cartridge content and no engine change.

| # | Rank | Mechanic | Today | Size | Depends on | Reuse | Sampler | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | M1 | Status effects over time: poison, disease, buffs, regen modifiers, timed expiry | partial: only bleed (`mechanics/bleed/`); "no generic status interpreter" | M | – | `mechanics/bleed/job.ts` timed job and consumption; `mechanics/resource.ts` rates | poison dart room drains HP per tick; antidote ends it; buff shrine raises a rate for an hour | done (batch M1): `cartridges/status_sampler`, [rules](system/mechanics.md#status-effects-over-time-toolbox-row-1); a buff is a signed per-tick amount, true regen-rate modifiers deferred (PM 2026-10-09) |
| 2 | M1 | Stats derived from attributes: hit, damage, HP, carry from str/dex/con | partial: `stat_compare` gates only (`mechanics/policy.ts`); no attribute reader in combat | M | – | `mechanics/attributes/shared.ts`; `mechanics/combat/round_attack.ts` profile; `mechanics/containment/shared.ts` carry | two dummies, str 5 vs 15, hand-fixed damage and carry differ | done (batch M1): `cartridges/derived_sampler`, [rules](system/mechanics.md#stats-derived-from-attributes-toolbox-row-2); hit, damage and carry; HP max split to `loka-kgd.8` (PM 2026-10-09); HP max in progress #344 (`loka-kgd.8`) |
| 3 | M2 | Item slots and affects (C2-M05): finger slots, granted modifiers | partial: slots capacity 1, no affects (`mechanics/equipment/rule.ts`) | M | 1, 2 | `mechanics/equipment/rule.ts` | ring of +2 per on either finger; remove restores | in progress #344 (`loka-kgd.10`) |
| 4 | M2 | Experience and levelling | missing | M | 2 | `mechanics/combat/credit.ts` death credit; `mechanics/fact.ts` int facts; quest reward writers | three rat kills reach level 2 and grant one attribute point | in progress #344 (`loka-kgd.11`) |
| G1 | M3 | Property tags on items, barriers and rooms: burnable, metal, wooden, sharp, liquid-holding, fragile | missing: rows invent private flags | S | – | item, barrier and room schemas; Elixir compiler parity | a wooden door and an iron door; a check on `burnable` passes only on the wooden one | todo |
| G2 | M3 | Damage model: damage kinds and resistances, critical hits and variance, material-sensitive damage (merges 7, 40) | partial: hit chance and damage range, no crit, no kinds (`combat/round_attack.ts`) | S-M | 2, G1 | `mechanics/combat/round_attack.ts`; G1 material tags | seeded fight shows one doubled hit at the fixed crit chance; silver vs iron against one fire-resistant wight gives hand-fixed HP results | todo |
| 7 | M3 | Critical hits and hit variance | partial: hit chance and damage range, no crit (`combat/round_attack.ts`) | S | 2 | `mechanics/combat/round_attack.ts` | seeded fight shows one doubled hit at the fixed crit chance | merged into row G2 |
| 40 | M3 | Material-sensitive damage (C2-M04) | missing | S | 7 | `mechanics/combat/round_attack.ts` | silver vs iron against one wight: hand-fixed HP results | merged into row G2 |
| 5 | M3 | Skill growth by use | missing: skills are bool facts (`mechanics/skills.ts`) | S | 2 | `mechanics/skills.ts`; `mechanics/action_recipe/rule.ts` check | five pick attempts raise `pick` until a harder lock opens | todo |
| G5 | M3 | Opposed checks: actor skill or attribute vs the target's | missing: each detail checks a fixed threshold | S | 5 | `mechanics/action_recipe/rule.ts` check; `mechanics/skills.ts`; `mechanics/attributes/shared.ts` | one recipe check against targets rated 3 and 7: skill 5 passes the first and fails the second (NPC-side attributes extend it with G3) | todo |
| 8 | M3 | Loot tables and random drops | missing: only fixed `loot_role` pelt/hide (`mechanics/population/birth.ts`) | S | – | `mechanics/population/birth.ts`; `mechanics/death/sequence.ts` custody; foundation RNG | rat drops a tail at 50% and a coin at 10%, seeded | todo |
| 11 | M4 | Hidden passages and search (C2-M01) | partial: seek check finds a thing, not an exit (`cartridges/ashmere_missing_child/recipes/seek_wisp.json`) | S | – | `mechanics/movement/rule.ts`; `mechanics/action_recipe/rule.ts`; D10 discovered places | Search reveals a panel exit; forged Move refused before | todo |
| 10 | M4 | Time windows (C2-M11): hour and moon gates | partial: calendar has solar/lunar status (`mechanics/calendar.ts`), no gate | S | – | `mechanics/calendar.ts`; `mechanics/policy.ts` | door opens only at full moon; dev clock proves both sides | todo |
| 30 | M4 | Rope and climb (C2-M02) | missing | S | – | `mechanics/movement/rule.ts`; `mechanics/resource.ts` damage | cliff: rope descends; no rope falls for fixed damage | todo |
| G3 | M5 | Statuses and attributes on NPCs and things | partial: statuses and attributes on the player body only (rows 1, 2); "NPCs have no attributes" | M | 1, 2 | `mechanics/status/`; `mechanics/attributes/shared.ts`; status save row keyed by body, with save recovery | a poison dart drains a guard per tick; a door takes a burning status | todo |
| 13 | M5 | Lockpicking | partial: luck-check recipe on a detail (`cartridges/ashmere_dusk/recipes/pick_lock.json`); barriers are key-only | S | 5, G5 | `mechanics/barrier/rule.ts` `key_item`; `mechanics/action_recipe/rule.ts` | keyless chest opens on a skill check; failure may jam | todo |
| G12 | M5 | Force or bash a barrier | missing: barriers are key-only (`mechanics/barrier/rule.ts`) | S | 2, G1 | `mechanics/barrier/rule.ts`; `mechanics/attributes/shared.ts` | a fragile door gives to a str check; an iron door does not | todo |
| 18 | M5 | Consumables with timed effects (potions, elixirs) | partial: eat/drink restore instantly (`mechanics/food/shared.ts`) | S | 1, G3 | `mechanics/food/shared.ts`; `mechanics/liquid/shared.ts` | potion gives +3 str for an hour; stacking rule | todo (content only, on row 1) |
| 42 | M5 | Song and instrument buff (C3-M13) | missing | S | 1, G3 | status effects (row 1) | song with a lute buffs present listeners | todo (content only, on row 1: `status.apply` to listeners) |
| G13 | M5 | Hunger, thirst and fatigue drains | partial: food and drink restore a resource (`mechanics/food/`, `mechanics/liquid/`) | S (content) | 1 | row 1 negative per-tick status; food `cures` | hunger drains one point an hour; bread ends it | todo (content only, on row 1) |
| 15 | M6 | Reputation and affinity tiers: faction standing and per-NPC trust | partial: int facts with deltas (`mechanics/fact.ts`, `cartridges/ashmere_missing_child/facts.json` `maud_trust`); tiers open no gate | S | – | `mechanics/fact.ts`; `mechanics/policy.ts` `fact_compare`; `mechanics/commerce/shared.ts` price | standing gates a discount, a greeting and a hostile guard | todo |
| G11 | M6 | NPC disposition: hostile, wary, friendly, read by combat, dialogue and shops | partial: standing is an int fact (row 15); no derived hostility | S | 15 | `mechanics/fact.ts`; `mechanics/combat/behavior.ts`; `mechanics/commerce/shared.ts` | low standing makes a guard attack and a shop refuse | todo |
| 14 | M6 | Dialogue skill checks (persuasion, intimidation) | partial: skill gating by fact, no roll in dialogue (`mechanics/dialogue/rule.ts`) | S | 2, 5, G5 | `mechanics/dialogue/rule.ts`; `mechanics/action_recipe/rule.ts` check; `protocol/policy.schema.json` `stat_compare` | guard persuaded on a cha check; failure branch; one retry rule | todo |
| G9 | M6 | Social verbs: say, whisper, shout with range; emotes | missing | S-M | – | `mechanics/dialogue/` topics | say a keyword and the NPC answers; an emote shows to the room | todo |
| 6 | M7 | Multi-target and allied combat: choose target, several foes, allies fight | partial: pack rounds (`mechanics/combat/round_flow.ts`), player hits one fixed target, no allies | L | 2 | `mechanics/combat/round_flow.ts` `packRound`; `combat/behavior.ts` `packPlan`; `mechanics/escort/shared.ts` | two goblins and one guard ally; player picks a target; ally attacks | split into 6a, 6b, 6c |
| 6a | M7 | Target choice in the same room | partial: player hits one fixed target | M | 2 | `mechanics/combat/round_flow.ts` `packRound` | two goblins; player picks a target | todo |
| 6b | M7 | NPC-vs-NPC damage, allies and kill credit | missing: `combat/credit.ts` assumes the player is the killer | M | 6a, G3 | `mechanics/escort/shared.ts`; `mechanics/combat/credit.ts` with the party-credit contract | a guard ally attacks a goblin; credit follows the declared contract | todo |
| 6c | M7 | Several foes with a pack plan | partial: pack rounds (`mechanics/combat/round_flow.ts`) | M | 6a | `combat/behavior.ts` `packPlan` | two goblins act on one pack plan against the player | todo |
| 12 | M7 | Traps (C2-M03) | missing | M | 1, 11, G3 | `mechanics/barrier/rule.ts` state; `mechanics/action_recipe/rule.ts`; `mechanics/bleed/job.ts` | plate poisons once; disarm by check; reset policy authored | todo |
| G6 | M7 | Noise and smell perception | partial: perception is light-only (`mechanics/light/shared.ts`) | M | – | `mechanics/light/shared.ts` perception | a failed lockpick is heard by a guard in the next room | todo |
| 29 | M8 | Spell engine (configurable requirements) | missing; partial teacher learning: paid lesson and books ([D1](system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract), [D2](system/mechanics.md#d2-held-books-and-public-priory-selected-contract)) (C2-M08, C2-M09) | L | 1, 2, 4 | `mechanics/action_recipe/rule.ts` cost and check; `mechanics/knowledge/rule.ts` learned facts; `mechanics/dialogue/payment.ts` teacher fee; `mechanics/dialogue/shared.ts` `answerFits` typed word; recipe input consumption for reagents; `mechanics/resource.ts` mana pool | cast light from reagents and mana; ward needs a quest-taught word, level and stat; unknown or unlearned word refused; a secret word from lore works once known | split into 29a, 29b |
| 29a | M8 | Spell cast admission: word, learned gate, level, attributes, reagents, mana | missing; teacher learning exists (D1, D2) | M | 1, 2, 4 | `mechanics/action_recipe/rule.ts` cost and check; `mechanics/knowledge/rule.ts`; `mechanics/dialogue/shared.ts` `answerFits`; `mechanics/resource.ts` mana | light from reagents and mana; ward needs a quest-taught word, level and stat; unknown or unlearned word refused; a secret word from lore works once known | todo |
| 29b | M8 | Spell effects: `status.apply`, damage kind, light | missing | M | 29a, G2, G3 | row 1 statuses; G2 damage kinds; `mechanics/light/` | light spell lights a dark room; a fire bolt deals fire damage | todo |
| G4 | M8 | Generic "use X on Y" verb resolved by G1 properties | missing: each interaction is a per-detail recipe (`seek_wisp.json`, `pick_lock.json`) | M | G1 | `mechanics/action_recipe/rule.ts` | pour water on a fire, oil on a hinge; nobody authored the pair | todo |
| 19 | M8 | Tool-gated resource harvest (C3-M01) | partial: harvest and stock (`mechanics/containment/harvest.ts`, `stock.ts`), no tool gate | M | – | `mechanics/containment/harvest.ts`; `mechanics/containment/stock.ts` | ore seam needs a held pickaxe; depletes; regrows by job | todo |
| 17 | M9 | Ranged combat | missing | M | 6a, G2 | `mechanics/combat/round_attack.ts` | bow strikes first at a foe in the same room; ammo consumed; melee follows (shooting into adjacent rooms later, owner answer 2) | todo |
| 21 | M9 | Durability and crafting quality (C3-M03) | partial: recipes with checks, no wear or quality (`mechanics/action_recipe/rule.ts`) | M | 2 | `mechanics/action_recipe/rule.ts`; `mechanics/equipment/rule.ts` | sword breaks after N hits; forge check sets a quality band | todo |
| 27 | M9 | Unidentified items (C2-M06) | missing | M | 3 | `mechanics/knowledge/rule.ts`; `mechanics/equipment/rule.ts` | "a dull ring" shows +2 after a sage identifies it; affect applies before | todo |
| 28 | M9 | Curses and blessing (C2-M07) | missing | M | 3 | `mechanics/equipment/rule.ts`; `mechanics/dialogue/` | cursed ring refuses remove until blessed | todo |
| G8 | M10 | Group primitive: leader, members, co-move, shared credit | partial: escort follow only (`mechanics/escort/`) | M | 6b | `mechanics/escort/shared.ts`; `mechanics/combat/credit.ts` | two followers move with the leader; leaving the group stops the follow | todo |
| 22 | M10 | Hireling orders and wages (C2-M14A, C2-M14B; merges 23): hire, follow, stay, attack, guard | partial: escort follow only (`mechanics/escort/shared.ts`) | M | 6b, G8 | `mechanics/escort/shared.ts`; `mechanics/dialogue/payment.ts`; `mechanics/schedule/rule.ts` wage | hire a guard; stay blocks following; attack order joins combat; daily wage settles once; unpaid guard leaves | todo |
| 23 | M10 | Wages and loyalty (C2-M14B) | missing | M | 22 | `mechanics/schedule/rule.ts`; `mechanics/commerce/shared.ts` | daily wage settles once; unpaid guard leaves | merged into row 22 |
| 9 | M10 | Random encounters | missing: populations are bounded and RNG-free | M | 8 | `mechanics/population/settle.ts` births; `mechanics/schedule/rule.ts` jobs | road room spawns a bandit 1 in 4 per hour, capped at one | todo |
| G7 | M11 | Locks: per-entity access types to policy, with ownership and grants (Evennia lockstrings). Any entity, exit or container may declare `locks` {access type: `VersionedPolicy`} for enter, traverse, get, put, open, lock, furnish, build, control, evaluated by `mechanics/policy.ts` (all/any/not plus leaves); new leaves `owner` (actor owns target), `role` (owner, resident, guest, public; guild and party later via G8), `holder` (a grant row exists); runtime grant and revoke commands write saved grant rows; taken items carry a `stolen` provenance; a wanted player's property stays theirs. Staff and builder permissions are row R1 | missing; archived design: [property, housing and persistent places](archive/spec/21-composable-world-primitives.md#property-housing-and-persistent-places), `property@1` row | M | – | `mechanics/policy.ts`; `mechanics/containment/`; `mechanics/barrier/rule.ts` | a guest may enter an owned hut but not take from its chest; revoke the grant and entry refuses; a stranger is refused | todo |
| 24 | M11 | Property ownership and bank (C3-M12; merges 25) | missing: D4 homes are descriptions only | M | G7 | `mechanics/commerce/shared.ts`; `mechanics/barrier/rule.ts`; `mechanics/containment/`; `mechanics/containment/rule.ts` put | buy a hut; lock it; stranger refused; chest keeps items; deposit ten pennies; withdraw at a second branch | todo |
| 25 | M11 | Bank: money and item deposit | partial: earned storage chest ([M20-B1](https://github.com/lorecrafting/lokacore/pull/171)), no money account | S | – | `mechanics/commerce/shared.ts`; `mechanics/containment/rule.ts` put | deposit ten pennies; withdraw at a second branch | merged into row 24 |
| 20 | M11 | Timed jobs and escrow (C3-M02) | partial: engine jobs exist (`mechanics/bleed/job.ts`, `crow/job.ts`); services are immediate (`mechanics/service/`) | L | – | `mechanics/service/rule.ts`; `mechanics/bleed/job.ts` | smith takes two ore; sword claimable after two hours; cancel path | split into 20a, 20b |
| 20a | M11 | Escrow custody (C3-M02): inputs leave the player exactly once | partial: services are immediate (`mechanics/service/`) | M | – | `mechanics/service/rule.ts`; `mechanics/bleed/job.ts` | smith takes two ore once; a retry takes none | todo |
| 20b | M11 | Timed job claim and cancel (C3-M02) | partial: engine jobs exist (`mechanics/bleed/job.ts`, `crow/job.ts`) | M | 20a | `mechanics/service/rule.ts`; engine jobs | sword claimable after two hours; cancel path returns the ore | todo |
| 37 | M12 | Phased world events (C2-M12) | missing | L | 6, 9, 10 | `mechanics/schedule/rule.ts`; `mechanics/population/`; `mechanics/reaction.ts` | full-moon raid: spawn, fight, aftermath once per cycle | split into 37a, 37b |
| 37a | M12 | Phased world event trigger and spawn (C2-M12) | missing | M | 6c, 9, 10 | `mechanics/schedule/rule.ts`; `mechanics/population/` | full-moon raid spawns one bundle per cycle; reopening does not respawn it | todo |
| 37b | M12 | Phased world event aftermath (C2-M12) | missing | M | 37a | `mechanics/reaction.ts` | raid aftermath applies once per cycle | todo |
| 38 | M12 | Protect objective (C2-M13) | missing | M | 37b | `mechanics/quest/lifecycle.ts` | named defender alive at close wins; dead fails | todo |
| 39 | M12 | Boss phases (C2-M10) | missing | L | 6c, G3 | `mechanics/combat/behavior.ts` | boss summons at 60% HP, withdraws at 25%, drops one crown | todo |
| 16 | M13 | Sneak and hide (C3-M05) | missing: perception metadata only (`mechanics/light/shared.ts`) | M | 2, G6 | `mechanics/light/shared.ts` perception; `mechanics/combat/behavior.ts` | hidden player ignored by a guard until a failed sneak | todo |
| 33 | M13 | Theft, fence and witnessed offense (C3-M06, C3-M07; merges 34): theft, assault and trespass as offense kinds | missing | M | 16, G6, G7 | `mechanics/containment/`; `mechanics/commerce/shared.ts`; `mechanics/light/shared.ts` perception; `mechanics/fact.ts` | pickpocket a purse; stolen flag; fence buys stolen only; seen theft sets wanted, unseen does not | todo |
| 34 | M13 | Witnessed crime and wanted (C3-M07) | missing | M | 33 | `mechanics/light/shared.ts` perception; `mechanics/fact.ts` | seen theft sets wanted; unseen does not | merged into row 33 |
| 41 | M13 | Perishable food (C3-M04) | partial: water expiry (`mechanics/water/expiry.ts`) | S | – | `mechanics/water/expiry.ts`; `mechanics/food/shared.ts` | fish spoils after a day; smoked fish lasts | todo |
| 35 | M14 | Trial (C3-M08) | missing | M | 33 | `mechanics/scene/rule.ts` | arrested at the watch house; fine or sentence scene | todo |
| 36 | M14 | Jail (C3-M09) | missing | L | 35 | `mechanics/death/sequence.ts` relocation; `mechanics/barrier/rule.ts` | serve a sentence or escape by tunnel; wanted stays | todo |
| 43 | M14 | Mounts and terrain costs (C3-M10) | missing | L | 2 | `mechanics/movement/`; `mechanics/escort/shared.ts` co-location | horse on road moves both; fen refuses; dismount | split into 43a, 43b |
| 43a | M14 | Terrain movement costs (C3-M10) | missing | M | 2 | `mechanics/movement/` | road costs one, fen refuses | todo |
| 43b | M14 | Mount relation (C3-M10) | missing | M | 43a, G8 | `mechanics/escort/shared.ts` co-location | horse on road moves both once; fen refuses and moves neither; dismount leaves the horse | todo |
| 44 | M14 | Race objective (C3-M11) | missing | M | 43b | `mechanics/quest/lifecycle.ts` | reach the finish before the cart's scheduled arrival | todo |
| 31 | M14 | Weather as a room status plus a description variant | missing | M | 10, 43a, G3 | `mechanics/calendar.ts`; `mechanics/schedule/rule.ts`; `mechanics/description_variant/rule.ts` | rain on a schedule changes descriptions and a movement cost | todo |
| 45 | M14 | Pet growth (C2-M15) | missing | L | 9, G8 | `mechanics/population/birth.ts` | adopted pup grows at an age boundary; dead pup stays dead | todo |
| 32 | M14 | Fast travel as transport content | partial: authored paid routes (`mechanics/transport/rule.ts`), no map travel | S | 11 | `mechanics/transport/rule.ts`; D10 visited map | an authored route between two visited waypoints for a fee; the trip runs as a transport job over real elapsed time or is instant with no clock change, never a clock skip ([fixed time](decisions/owner-decision-fixed-time-2026-10-03.md)) | todo (content only, transport) |
| S1 | Settle | Functional furnishing: placed objects in an owned room grant effects by property (bed: rest bonus; forge or workbench: crafting station gate; chest: storage) | missing | M | G1, G7, 24 | G1 tags; G7 ownership; row 24 slots and `mechanics/containment/`; `mechanics/action_recipe/rule.ts` | a bed placed in an owned hut raises the rest rate; a forge there admits a smithing recipe | todo |
| S2 | Settle | Construction: build a structure or room addition from materials and labour over real elapsed time, creating a new room and exit at runtime | missing: rooms and exits are authored in the cartridge | L | 20b, G7 | row 20 timed job; `mechanics/movement/`; the cartridge declares buildable sites and blueprints, the engine owns no numbers | a declared site takes timber and two hours of work, then a new room and exit exist | todo; runtime-created rooms and exits change the world-graph contract: decision record first |
| S3 | Settle | Settlement: a town as an owned group of buildings with residents, services, upkeep, stock, and NPCs attracted by built structures | missing | L | S1, S2, G7, G8, 9, 22, 24 | `mechanics/population/`; `mechanics/schedule/rule.ts`; `mechanics/commerce/shared.ts`; `mechanics/containment/stock.ts` | a built smithy attracts a smith; unpaid upkeep closes the service | todo |
| S4 | Settle | Settlement defense and events: raids from random encounters or world events, guards from hirelings | missing | M | S3, 6c, 37b | rows 9, 37, 22 | a raid reaches the town; hired guards defend it | todo |
| R1 | Realm | Staff and builder permissions (Realm): account-level hierarchy (player < helper < builder < admin), a `perm` policy leaf, staff-only commands and build tools gated by it | missing; needs online Realm authority | M | G7 | `mechanics/policy.ts` leaves; G7 locks | a builder account may run a build command; a player account is refused | deferred: online Realm |
| 46 | M15 | Achievements and collections | missing: journal only (`view/quest_journal.ts`) | S | 4 | `view/quest_journal.ts`; `mechanics/fact.ts` counters | "visited all five rooms" badge | todo (content on row 4: `fact` counters plus a journal view) |
| 47 | M15 | Death penalty options: XP loss, item drop | have corpse custody; options missing | S | 4 | `mechanics/death/sequence.ts` | cartridge chooses XP loss on death; sampler loses 10% | todo (cartridge option on row 4) |
| 48 | M15 | Chapter carry-over (CC-M01..03): export, import, item and knowledge ports | missing | L | 3, 4 | `mechanics/quest/`, save receipts | sampler A exports a flag and a ring; sampler B imports once | split into 48a, 48b, 48c |
| 48a | M15 | Chapter export (CC-M01): acknowledged completion exports declared continuity | missing | M | 3, 4 | `mechanics/quest/`, save receipts | sampler A exports a flag once, even after a lost reply | todo |
| 48b | M15 | Chapter import (CC-M02): optional prior start from a declared import or defaults | missing | L | 48a | save transaction; versioned ports | sampler B imports the flag once; a malformed import refuses atomically | todo |
| 48c | M15 | Item and knowledge ports (CC-M03) | missing | M | 48b | `mechanics/equipment/`; `mechanics/knowledge/` | a ring exported from sampler A arrives once in sampler B | todo |
| G10 | M15 | Player-written text: write a note, sign or book | partial: readables exist | S | – | readable items | write a note; another reader reads it | todo |
| 26 | M15 | Sequence and combination puzzles | partial: riddles have (`mechanics/dialogue/shared.ts`); order and dial puzzles missing | M | – | `mechanics/quest/lifecycle.ts`; `mechanics/barrier/rule.ts`; `mechanics/dialogue/` | three levers in order open a door; A,C,B does not; dial of three digits | todo (confirm content only first: an int fact plus reaction rules) |

## Toolbox slice process

[The workflow](WORKFLOW.md) applies; only this differs ([decision](decisions/owner-decision-mechanics-toolbox-2026-10-08.md)):

- **One slice = one row:** the generic capability, its sampler cartridge `cartridges/<mechanic>_sampler`
  with neutral ids, Elixir compiler parity for every new field, its
  [mechanics](system/mechanics.md) section, the [Book UI](system/book-ui.md) rule when the player
  sees something new, and the row's status flipped to `done #N` in the same PR.
- **Content-only rows** (marked `content only`) ship cartridge content and its sampler on the
  named row's engine, with no engine change; the status flips to `done #N (content only)`.
- **Opt-in:** every new mechanic is opt-in by a cartridge field; Chapter 1 and the seeded corpus
  stay unchanged (precedent: `world.derived`).
- **Brief:** the PM writes it in the Beads issue; no brief-drafter agent, no stage labels.
- **Build:** own worktree, hosted PR lane, focused tests plus one red control
  ([test rules](../AGENTS.md#writing-tests-every-change-every-agent)).
- **Review:** one fresh Opus reviewer per item, no second opinion; one Fable review of the batch on its final head; findings as PR comments ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)). Fix rounds as in the workflow.
- **Merge:** the PM merges after the verdict on green hosted runs ([workflow step 7](WORKFLOW.md#loop)); no ROADMAP status commit.

## How to pick the next item

Take the first `todo` row in table order (table order is the rank) whose **Depends on** rows are all
`done`. Skip a row only when
the owner says so, or when the foundation phase is not done. Rows with the same dependencies may run
as parallel slices when they share no kernel files. Re-rank in a PR, not in chat.
