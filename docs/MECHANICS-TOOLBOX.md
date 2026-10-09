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
5. **Spells use one engine** with per-spell requirements declared in the cartridge: spoken words (incantation text); an optional must-be-learned gate (existing learned facts, earned from quests or teachers); optional minimum level and attributes; optional reagents consumed (the crafting input consumption); a mana cost from a mana pool; optional secret words found in lore, checked like riddle answers. Intended mix: common spells open with reagents and mana, great spells are learned by quest with level and stat gates. Ranked as row 29.

## Ranked toolbox

Rank = likely need in a generic fantasy RPG x what it unlocks x effort, foundations first,
dependencies before dependents. Size: S under a day, M a few days, L a week or a split. **Today**:
have / partial / missing per the audit. Ids in parentheses are the
[archived queue](archive/LATER-MECHANICS.md) rows, whose acceptance seams still apply. Status is
`todo` until the slice PR flips it to `done #N`.

| # | Mechanic | Today | Size | Depends on | Reuse | Sampler | Status |
|---|---|---|---|---|---|---|---|
| 1 | Status effects over time: poison, disease, buffs, regen modifiers, timed expiry | partial: only bleed (`mechanics/bleed/`); "no generic status interpreter" | M | – | `mechanics/bleed/job.ts` timed job and consumption; `mechanics/resource.ts` rates | poison dart room drains HP per tick; antidote ends it; buff shrine raises a rate for an hour | todo |
| 2 | Stats derived from attributes: hit, damage, HP, carry from str/dex/con | partial: `stat_compare` gates only (`mechanics/policy.ts`); no attribute reader in combat | M | – | `mechanics/attributes/shared.ts`; `mechanics/combat/round_attack.ts` profile; `mechanics/containment/shared.ts` carry | two dummies, str 5 vs 15, hand-fixed damage and carry differ | todo |
| 3 | Item slots and affects (C2-M05): finger slots, granted modifiers | partial: slots capacity 1, no affects (`mechanics/equipment/rule.ts`) | M | 1, 2 | `mechanics/equipment/rule.ts` | ring of +2 per on either finger; remove restores | todo |
| 4 | Experience and levelling | missing | M | 2 | `mechanics/combat/credit.ts` death credit; `mechanics/fact.ts` int facts; quest reward writers | three rat kills reach level 2 and grant one attribute point | todo |
| 5 | Skill growth by use | missing: skills are bool facts (`mechanics/skills.ts`) | S | 2 | `mechanics/skills.ts`; `mechanics/action_recipe/rule.ts` check | five pick attempts raise `pick` until a harder lock opens | todo |
| 6 | Multi-target and allied combat: choose target, several foes, allies fight | partial: pack rounds (`mechanics/combat/round_flow.ts`), player hits one fixed target, no allies | L | 2 | `mechanics/combat/round_flow.ts` `packRound`; `combat/behavior.ts` `packPlan`; `mechanics/escort/shared.ts` | two goblins and one guard ally; player picks a target; ally attacks | todo |
| 7 | Critical hits and hit variance | partial: hit chance and damage range, no crit (`combat/round_attack.ts`) | S | 2 | `mechanics/combat/round_attack.ts` | seeded fight shows one doubled hit at the fixed crit chance | todo |
| 8 | Loot tables and random drops | missing: only fixed `loot_role` pelt/hide (`mechanics/population/birth.ts`) | S | – | `mechanics/population/birth.ts`; `mechanics/death/sequence.ts` custody; foundation RNG | rat drops a tail at 50% and a coin at 10%, seeded | todo |
| 9 | Random encounters | missing: populations are bounded and RNG-free | M | 8 | `mechanics/population/settle.ts` births; `mechanics/schedule/rule.ts` jobs | road room spawns a bandit 1 in 4 per hour, capped at one | todo |
| 10 | Time windows (C2-M11): hour and moon gates | partial: calendar has solar/lunar status (`mechanics/calendar.ts`), no gate | S | – | `mechanics/calendar.ts`; `mechanics/policy.ts` | door opens only at full moon; dev clock proves both sides | todo |
| 11 | Hidden passages and search (C2-M01) | partial: seek check finds a thing, not an exit (`cartridges/ashmere_missing_child/recipes/seek_wisp.json`) | S | – | `mechanics/movement/rule.ts`; `mechanics/action_recipe/rule.ts`; D10 discovered places | Search reveals a panel exit; forged Move refused before | todo |
| 12 | Traps (C2-M03) | missing | M | 1, 11 | `mechanics/barrier/rule.ts` state; `mechanics/action_recipe/rule.ts`; `mechanics/bleed/job.ts` | plate poisons once; disarm by check; reset policy authored | todo |
| 13 | Lockpicking | partial: luck-check recipe on a detail (`cartridges/ashmere_dusk/recipes/pick_lock.json`); barriers are key-only | S | 5 | `mechanics/barrier/rule.ts` `key_item`; `mechanics/action_recipe/rule.ts` | keyless chest opens on a skill check; failure may jam | todo |
| 14 | Dialogue skill checks (persuasion, intimidation) | partial: skill gating by fact, no roll in dialogue (`mechanics/dialogue/rule.ts`) | S | 2, 5 | `mechanics/dialogue/rule.ts`; `mechanics/action_recipe/rule.ts` check; `protocol/policy.schema.json` `stat_compare` | guard persuaded on a cha check; failure branch; one retry rule | todo |
| 15 | Reputation and affinity tiers: faction standing and per-NPC trust | partial: int facts with deltas (`mechanics/fact.ts`, `cartridges/ashmere_missing_child/facts.json` `maud_trust`); tiers open no gate | S | – | `mechanics/fact.ts`; `mechanics/policy.ts` `fact_compare`; `mechanics/commerce/shared.ts` price | standing gates a discount, a greeting and a hostile guard | todo |
| 16 | Sneak and hide (C3-M05) | missing: perception metadata only (`mechanics/light/shared.ts`) | M | 2 | `mechanics/light/shared.ts` perception; `mechanics/combat/behavior.ts` | hidden player ignored by a guard until a failed sneak | todo |
| 17 | Ranged combat | missing | M | 6, 7 | `mechanics/combat/round_attack.ts`; `mechanics/movement/shared.ts` adjacency | bow hits a foe one room away; ammo consumed; melee closes | todo |
| 18 | Consumables with timed effects (potions, elixirs) | partial: eat/drink restore instantly (`mechanics/food/shared.ts`) | S | 1 | `mechanics/food/shared.ts`; `mechanics/liquid/shared.ts` | potion gives +3 str for an hour; stacking rule | todo |
| 19 | Tool-gated resource harvest (C3-M01) | partial: harvest and stock (`mechanics/containment/harvest.ts`, `stock.ts`), no tool gate | M | – | `mechanics/containment/harvest.ts`; `mechanics/containment/stock.ts` | ore seam needs a held pickaxe; depletes; regrows by job | todo |
| 20 | Timed jobs and escrow (C3-M02) | partial: engine jobs exist (`mechanics/bleed/job.ts`, `crow/job.ts`); services are immediate (`mechanics/service/`) | L | – | `mechanics/service/rule.ts`; `mechanics/bleed/job.ts` | smith takes two ore; sword claimable after two hours; cancel path | todo |
| 21 | Durability and crafting quality (C3-M03) | partial: recipes with checks, no wear or quality (`mechanics/action_recipe/rule.ts`) | M | 2 | `mechanics/action_recipe/rule.ts`; `mechanics/equipment/rule.ts` | sword breaks after N hits; forge check sets a quality band | todo |
| 22 | Hireling orders (C2-M14A): hire, follow, stay, attack, guard | partial: escort follow only (`mechanics/escort/shared.ts`) | M | 6 | `mechanics/escort/shared.ts`; `mechanics/dialogue/payment.ts` | hire a guard; stay blocks following; attack order joins combat | todo |
| 23 | Wages and loyalty (C2-M14B) | missing | M | 22 | `mechanics/schedule/rule.ts`; `mechanics/commerce/shared.ts` | daily wage settles once; unpaid guard leaves | todo |
| 24 | Property ownership (C3-M12) | missing: D4 homes are descriptions only | M | – | `mechanics/commerce/shared.ts`; `mechanics/barrier/rule.ts`; `mechanics/containment/` | buy a hut; lock it; stranger refused; chest keeps items | todo |
| 25 | Bank: money and item deposit | partial: earned storage chest ([M20-B1](https://github.com/lorecrafting/lokacore/pull/171)), no money account | S | – | `mechanics/commerce/shared.ts`; `mechanics/containment/rule.ts` put | deposit ten pennies; withdraw at a second branch | todo |
| 26 | Sequence and combination puzzles | partial: riddles have (`mechanics/dialogue/shared.ts`); order and dial puzzles missing | M | – | `mechanics/quest/lifecycle.ts`; `mechanics/barrier/rule.ts`; `mechanics/dialogue/` | three levers in order open a door; A,C,B does not; dial of three digits | todo |
| 27 | Unidentified items (C2-M06) | missing | M | 3 | `mechanics/knowledge/rule.ts`; `mechanics/equipment/rule.ts` | "a dull ring" shows +2 after a sage identifies it; affect applies before | todo |
| 28 | Curses and blessing (C2-M07) | missing | M | 3 | `mechanics/equipment/rule.ts`; `mechanics/dialogue/` | cursed ring refuses remove until blessed | todo |
| 29 | Spell engine (configurable requirements) | missing; partial teacher learning: paid lesson and books ([D1](system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract), [D2](system/mechanics.md#d2-held-books-and-public-priory-selected-contract)) (C2-M08, C2-M09) | L | 1, 2, 4 | `mechanics/action_recipe/rule.ts` cost and check; `mechanics/knowledge/rule.ts` learned facts; `mechanics/dialogue/payment.ts` teacher fee; `mechanics/dialogue/shared.ts` `answerFits` typed word; recipe input consumption for reagents; `mechanics/resource.ts` mana pool | cast light from reagents and mana; ward needs a quest-taught word, level and stat; unknown or unlearned word refused; a secret word from lore works once known | todo |
| 30 | Rope and climb (C2-M02) | missing | S | – | `mechanics/movement/rule.ts`; `mechanics/resource.ts` damage | cliff: rope descends; no rope falls for fixed damage | todo |
| 31 | Weather | missing | M | 10 | `mechanics/calendar.ts`; `mechanics/schedule/rule.ts`; `mechanics/description_variant/rule.ts` | rain on a schedule changes descriptions and a movement cost | todo |
| 32 | Fast travel | partial: authored paid routes (`mechanics/transport/rule.ts`), no map travel | S | 11 | `mechanics/transport/rule.ts`; D10 visited map | travel between two visited waypoints for a fee and elapsed time | todo |
| 33 | Theft and fence (C3-M06) | missing | M | 16 | `mechanics/containment/`; `mechanics/commerce/shared.ts` | pickpocket a purse; stolen flag; fence buys stolen only | todo |
| 34 | Witnessed crime and wanted (C3-M07) | missing | M | 33 | `mechanics/light/shared.ts` perception; `mechanics/fact.ts` | seen theft sets wanted; unseen does not | todo |
| 35 | Trial (C3-M08) | missing | M | 34 | `mechanics/scene/rule.ts` | arrested at the watch house; fine or sentence scene | todo |
| 36 | Jail (C3-M09) | missing | L | 35 | `mechanics/death/sequence.ts` relocation; `mechanics/barrier/rule.ts` | serve a sentence or escape by tunnel; wanted stays | todo |
| 37 | Phased world events (C2-M12) | missing | L | 6, 9, 10 | `mechanics/schedule/rule.ts`; `mechanics/population/`; `mechanics/reaction.ts` | full-moon raid: spawn, fight, aftermath once per cycle | todo |
| 38 | Protect objective (C2-M13) | missing | M | 37 | `mechanics/quest/lifecycle.ts` | named defender alive at close wins; dead fails | todo |
| 39 | Boss phases (C2-M10) | missing | L | 1, 6 | `mechanics/combat/behavior.ts` | boss summons at 60% HP, withdraws at 25%, drops one crown | todo |
| 40 | Material-sensitive damage (C2-M04) | missing | S | 7 | `mechanics/combat/round_attack.ts` | silver vs iron against one wight: hand-fixed HP results | todo |
| 41 | Perishable food (C3-M04) | partial: water expiry (`mechanics/water/expiry.ts`) | S | – | `mechanics/water/expiry.ts`; `mechanics/food/shared.ts` | fish spoils after a day; smoked fish lasts | todo |
| 42 | Song and instrument buff (C3-M13) | missing | S | 1 | status effects (row 1) | song with a lute buffs present listeners | todo |
| 43 | Mounts and terrain costs (C3-M10) | missing | L | 2 | `mechanics/movement/`; `mechanics/escort/shared.ts` co-location | horse on road moves both; fen refuses; dismount | todo |
| 44 | Race objective (C3-M11) | missing | M | 43 | `mechanics/quest/lifecycle.ts` | reach the finish before the cart's scheduled arrival | todo |
| 45 | Pet growth (C2-M15) | missing | L | 9, 22 | `mechanics/population/birth.ts` | adopted pup grows at an age boundary; dead pup stays dead | todo |
| 46 | Achievements and collections | missing: journal only (`view/quest_journal.ts`) | S | 4 | `view/quest_journal.ts`; `mechanics/fact.ts` counters | "visited all five rooms" badge | todo |
| 47 | Death penalty options: XP loss, item drop | have corpse custody; options missing | S | 4 | `mechanics/death/sequence.ts` | cartridge chooses XP loss on death; sampler loses 10% | todo |
| 48 | Chapter carry-over (CC-M01..03): export, import, item and knowledge ports | missing | L | 3, 4 | `mechanics/quest/`, save receipts | sampler A exports a flag and a ring; sampler B imports once | todo |

## Toolbox slice process

[The workflow](WORKFLOW.md) applies; only this differs ([decision](decisions/owner-decision-mechanics-toolbox-2026-10-08.md)):

- **One slice = one row:** the generic capability, its sampler cartridge `cartridges/<mechanic>_sampler`
  with neutral ids, Elixir compiler parity for every new field, its
  [mechanics](system/mechanics.md) section, the [Book UI](system/book-ui.md) rule when the player
  sees something new, and the row's status flipped to `done #N` in the same PR.
- **Brief:** the PM writes it in the Beads issue; no brief-drafter agent, no stage labels.
- **Build:** own worktree, hosted PR lane, focused tests plus one red control
  ([test rules](../AGENTS.md#writing-tests-every-change-every-agent)).
- **Review:** one fresh Opus reviewer; findings as PR comments; no `docs/reviews` record, review
  index or second opinion. Fix rounds as in the workflow.
- **Gate:** `toolbox/*` pushes skip the local checks; the PM runs `gh workflow run ci.yml --ref <branch>` (and `book-e2e.yml` when the batch touches the Book) once per batch head and merges only on green for that exact head (`--match-head-commit`), after the verdict ([record](decisions/owner-decision-hosted-ci-toolbox-2026-10-09.md)).
- **Merge:** the PM merges after the verdict ([gate](decisions/owner-decision-preproduction-gate-2026-10-08.md)); no ROADMAP status commit.

## How to pick the next item

Take the lowest-numbered `todo` row whose **Depends on** rows are all `done`. Skip a row only when
the owner says so, or when the foundation phase is not done. Rows with the same dependencies may run
as parallel slices when they share no kernel files. Re-rank in a PR, not in chat.
