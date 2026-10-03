# LegendMUD system reference

Research retrieved **2026-10-03**. This describes LegendMUD and the limits of its public evidence.
Loka's adoption and reconciliation rules live in the
[owner decision](../decisions/owner-decision-legendmud-baseline-2026-10-03.md).

## How to read the evidence

LegendMUD is the game. LegendHUB is a community wiki, equipment database and character builder
linked by [LegendMUD's homepage](https://www.legendmud.org/index.php/Welcome_to_Legend).
LegendHUB's footer explicitly disclaims staff affiliation and warns that entries can be wrong.
Neither its website nor its public repository is the game engine.

| Label | What it establishes | Limit |
|---|---|---|
| Official public help | A published game description, with revision dates where available | A live page can preserve an old rule |
| Official historical update | A dated staff announcement of an installed change | Later changes may supersede it |
| Calculator proxy | Recent LegendHUB code/specifications that report comparisons with production C | We cannot inspect or run that private C |
| Community guide | Player explanations and catalogs | Not a complete or authoritative current rule set |
| Unknown (`null`) | Public research did not establish the rule | Never fill the gap with a Diku/D&D assumption |

The calculator is pinned to repository commit
[`8afdedc3dff48a5168fbac1aa9becfe3bd3a1280`](https://github.com/rufuslegend/legendhub/commit/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280)
(2026-09-08). Its August 2026 correction specifications are stronger evidence for derived stats
than undated guides. It models a **level-50 character**, not an arbitrary-level combat simulator.
The [official help index](https://www.legendmud.org/index.php/Help_Files) says its web port is
incomplete and directs readers to in-game HELP. No game account was created for this research.

## Characters and the six attributes

Legend is classless: a character's stats, origin and acquired skills define its build.
Classless does not mean everyone can learn everything. The official
[Skills description](https://www.legendmud.org/index.php/Skills) (2018-06-06) makes stats affect
both eligibility and effectiveness. Origin can constrain access; the
[community creation guide](https://www.legendhub.org/wiki/details.html?id=721) (2019) lists
Ancient Agrabah/Tara, Medieval Kleinstadt/Lima and Industrial London/San Francisco.
Those hometowns are world content, not six universal classes.

| Attribute | Documented derived contribution | Other role and evidence limit |
|---|---|---|
| Strength (STR) | Natural melee damroll, equipment damroll allowance, melee damage cap | Weapon/skill eligibility; carrying formula `null` |
| Mind (MIND) | Mana maximum/regeneration, spell damage and part of spell critical | Magic eligibility; concentration equation `null` |
| Dexterity (DEX) | Movement maximum/regeneration, hitroll, equipment hitroll allowance, natural AC | Official newbie guide links it to dodging; exact dodge probability `null` |
| Constitution (CON) | HP maximum/regeneration; Battle Training mitigation contribution | Toughness and skill eligibility; complete mitigation resolver `null` |
| Perception (PER) | Part of spell critical | Official Skills describes archery effectiveness; exact ranged hit equation `null` |
| Spirit (SPI) | Part of spell critical | Skill eligibility; historical low-Spirit penalty's current equation `null` |

Derived entries use the pinned calculator specifications linked below; the
[official newbie guide](https://www.legendmud.org/index.php?redirect=no&title=Guide_for_New_Players)
corroborates the six names and HP/MA/MV meanings.

Creation ranks the attributes before a roll. The
[2019 remort announcement](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_New_Feature:_Remorting)
explains opposing ranked pairs summing to 66, a total of 198 and initial values no higher than 50;
remort permits choosing the first three values within its ordering rules. The original random
roll distribution and present normal-creation constraints remain `null`.

The calculator separates base/quest attributes, equipment and affects, raw totals, cap increases
and effective current values. The default primary cap is **100**, not a starting score. A raised
cap permits values above 100; excess raw totals do not affect derived calculations. Example:
raw STR110 with cap104 produces current STR104. Gear can also determine whether a learned skill
remains usable. [Capped-stat design, 2026-08-07](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-07-builder-capped-roll-stats-design.md).

Stat visibility is disputed: official [SCORE](https://www.legendmud.org/index.php/SCORE) says
progressive reveal at levels 2–7, but a
[2017 staff update](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Important_News_Regarding_New_Chars)
says 5–10. Current reveal thresholds: `null`.

## Resource pools and recovery

HP is health; MA is mana; MV funds movement. These are separate current/max pools, not primary
attributes. The [2020 birthday update](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Birthday_Code_Update)
changed random level gains to four points per level, raised the stat-independent movement start
to 150, and retained stat and quest contributions. This is not a claim that fresh characters have
only 20 HP: the stat contribution must also be considered.

For the **level-50 builder**, let C, M and D be capped current CON, MIND and DEX. Let T truncate
toward zero. These are natural maxima plus recorded resource-quest bonuses, before gear/affects:

| Pool | Calculator formula | Literal example without quest/gear bonuses |
|---|---|---|
| HP | `216 + T(50 * Ceff / 10) + questHP` | CON89/90/91/100 → 661/666/676/766 |
| MA | `296 + T(50 * M / 10) + questMA` | MIND100 → 796 |
| MV | `346 + T(50 * D / 10) + questMV` | DEX100 → 846 |

`Ceff = C`; above 89 add `C - 90`. The stat-independent bases correspond to
`20/100/150 + 4*(level-1)`. Do not extrapolate the builder's complete behavior to every level.
Sources: [HP correction](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-06-builder-hp-formula-design.md),
[mana base](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-07-builder-mana-base-design.md),
[movement correction](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-07-builder-movement-design.md).

Regeneration is another derived stat. At level 50 the builder caps equipment plus an inside-cap
stat bonus at 20. That bonus is `T((stat-75)/5)` above 79, otherwise zero. The governing stat is
CON/MIND/DEX for HP/MA/MV. Natural additions outside the cap are:

- HP: `T(CON/10)`, plus `T((CON-100)/10)` above 100.
- MA: `T(MIND/10)`, plus `T((MIND-100)/2)` above 100.
- MV: `T((DEX-49)/5)` above 53, otherwise zero.

Spells and Innate Regeneration add outside the equipment cap. At stat100, the inside bonus is5
and natural outside term10: zero equipment gives15, capped equipment gives30 before other
bonuses. These are **builder regen values**; their present cadence and position/combat modifiers
are `null`. [Regeneration correction](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-07-builder-regeneration-design.md).

Official [REST](https://www.legendmud.org/index.php/REST) (2018-06-08) states that resting and
sleeping recover equally fast; sitting/standing are slower. Resting/sleeping increase vulnerability,
and sleeping suppresses awareness of some events. The [FAQ](https://www.legendmud.org/index.php/FAQ)
says hunger/thirst slow recovery rather than directly kill. Exact multipliers, cadence,
combat recovery, bleeding and movement/terrain costs remain `null`.

## Learning skills: qualification, acquisition, use

These are three distinct concepts. Official [FAQ](https://www.legendmud.org/index.php/FAQ):
ALLSKILLS lists currently qualifying skills; SKILLS lists learned skills even when no longer usable.
A teacher can list what it knows when asked to teach/learn; asking for the skill learns it.
Teachers are distributed through the world.

The [community learning guide](https://www.legendhub.org/wiki/details.html?id=733) (2019) describes
level/stat/hometown requirements, prerequisites, mutually exclusive choices, fees and teacher
quests. Its old individual thresholds are examples, not a current requirements registry.
The [2018 QUERY FULL update](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_A_note_on_%27query_full%27)
confirms alternate qualifying blocks: a skill can have more than one route through stats or prerequisites.

The [2018 Practices announcement](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Practices)
defines remaining practices as:

`level + 3 - learned skills - known words - known second-circle words`

Four acquisition points are available at level1, with one more per level. A skill consumes one;
a second-circle magic word consumes two in total. Practices here are an acquisition budget,
not automatically repeated training of a proficiency percentage.

The official Skills page names bardic, medical, ranger, tradesman, thief, warrior/knight,
gunmen and weapon-proficiency families. Its examples include first aid/surgery, tracking/archery,
haggle/repair/cooking, lockpick/backstab/trapping and wrestling/headbutt/warcry. These are
families, not character classes. Basic/advanced/expert weapon proficiency affects combat.

**Universal learn-by-doing is unverified.** The older
[archived overview](https://archive.legendmud.org/Overview/skills.html) mentions improvement
through use and decline through neglect. The newer Skills page omits that claim and ties performance
to stats. Neither universal proficiency growth nor universal skill decay should enter Loka as a
verified current Legend rule. Spell cast-level growth has separate community evidence below.

## Magic, herbalism and derived spell stats

Official [Magic](https://www.legendmud.org/index.php/Magic) (2017-07-08) describes learning words
and combining them into spells. Divination uses Know/Conceal; a mage then chooses
Create/Destroy or Cause/Remove. Herbalism is a separate collection of skills for plants,
potions, poultices, amulets and related effects.

The [community magic guide](https://www.legendhub.org/wiki/details.html?id=734) (2019) describes
CHANT before words; mutually exclusive Create/Cause verbs; Ancient Arabian third-circle access;
ALLWORDS/WORDS/ALLSPELLS; and a SPELLBOOK that records attempted combinations. Repeated casting
can raise cast level and lower failure chance; concentration also matters. Exact current growth,
cast-level caps and failure formula: `null`. Community combination catalogs have more recent edits:
[Create](https://www.legendhub.org/wiki/details.html?id=695) (2025-07-15),
[Cause](https://www.legendhub.org/wiki/details.html?id=694) (2025-06-17).

The pinned [calculator](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/www/src/public/js/services/game-stats.js)
models natural spell damage as `T((MIND-52)/2)` and natural spell critical as
`T((MIND-60)/4) + T(max(PER-60,0)/8) + T(max(SPI-60,0)/8) + 5`.
Spell damage and critical equipment allowances are40 each; mana reduction has total cap50.
These displayed stats do not reveal a full spell resolver.

The [2017 Arcane Mastery update](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Arcane_Mastery_and_Spell_updated)
describes fixed spell base damage/mana, spell damroll as percentage damage, critical bonuses,
spell lag and an unarmed/no-autoattack caster specialization. Arcane Mastery excludes some
weapon skills; its conditional mana reduction was clarified by the
[2019 cap announcement](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Mana_Reduction_%27Cap%27).
Treat exact historical lag, damage/resistance ordering and specialization effects as requiring
current verification; do not import them merely because a calculator exposes similarly named stats.

## Combat and equipment

Combat is ongoing rounds of attacks, with active skills/spells and command lag/reuse timers.
The official newbie guide demonstrates initiating combat and waiting several rounds.
This is not evidence of a D&D d20 attack roll or player-by-player turn order.

The 2026 [AC correction](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-16-builder-ac-formula-design.md)
reports a **2022 combat rewrite**. Old mixed-stat AC and hit tables must not override this evidence.
For standing, neutral-wary, non-vehicle characters, calculator-proxy formulas are:

| Derived value | Formula | Example |
|---|---|---|
| Natural hitroll | `T((DEX-1)/3)` | DEX100 → 33 |
| Hitroll equipment allowance | `30 + max(DEX-90,0)` | DEX100 → 40 |
| Natural damroll | `T((STR-1)/3)` | STR100 → 33 |
| Damroll equipment allowance | `30 + max(STR-90,0)` | STR100 → 40 |
| Natural AC | `100 - T((DEX-30)/2)` | DEX30/100 → 100/65 |

Hit/damroll buffs and abilities can add outside the equipment allowance. Disabled alternate-stat
feature flags are not active rules. Sources:
[hitroll](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-06-hitroll-rules-design.md),
[damroll](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-06-damroll-rules-design.md).
AC also has equipment, affects, training, stance and vehicle contributions; the table is not final AC.

The [damage-cap design](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-07-builder-damcap-design.md)
models base102, plus `T((STR-50)/2)` above50, another `T((STR-99)/2)` above100,
plus64 for a two-handed primary weapon and explicit item/affect modifiers. STR100 gives127,
or191 with that two-handed bonus before other modifiers. Some skill exceptions are outside the model.
A [2018 staff explanation](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_A_note_on_damage_cap)
caps a whole attack line, potentially multiple swings; present post-rewrite ordering remains `null`.

The pinned calculator adds `T(max(CON-75,0)/5)` natural mitigation with Battle Training,
otherwise zero. Its total displayed mitigation cap is
`T(max(min(CON,70)-30,0)/2)`, plus10 with Battle Training. CON100 therefore has a natural
contribution5 and cap30 with that ability. This still does not establish the actual damage-reduction
or resistance resolver. Dodge, parry and
block are separate combat questions: **their current probabilities, checks and resolution order
are `null`**. Knowing DEX affects dodge does not supply a dodge percentage.

[2018 weapon updates](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Code_Update_2018-08-16)
replaced weapon weight's combat role with speed factor. Swings depended on speed factor,
quality, governing STR/DEX/CON and proficiency tier. Damage type and proficiency are independent:
bladed need not mean STR. Current exact swing/weapon-damage/critical equations: `null`.
[2019 timing](https://www.legendmud.org/index.php/Welcome_Board_Archive_-_Code_Updates_06.01.2019)
documented 4.5-second rounds and 0.25-second pulses, with skill lag distinct from reuse timers.
These are historical timings, not measurements of the present server or prescribed Loka timing.

The [community equipment guide](https://www.legendhub.org/wiki/details.html?id=730) (2019)
emphasizes gear as a means of meeting skill stats. Inspect with Appraise or Identify Object
reveals equipment properties. Donation boxes, NPC/player shops and auctions supply gear.
Current slot compatibility, wield-strength limits and encumbrance penalties: `null`.

## Progression, death and other constraints

Official [Internal Mechanics](https://www.legendmud.org/index.php/Internal_Mechanics)
(revised 2019-09-08) describes quest and exploration XP alongside combat. Its old implementation
details are not a blueprint for Loka. Level50 and era progression are described by the
[community era guide](https://www.legendhub.org/wiki/details.html?id=738) (2019).
Current XP thresholds, era point costs and rewards need verification.
The pinned [era-ability design](https://github.com/rufuslegend/legendhub/blob/8afdedc3dff48a5168fbac1aa9becfe3bd3a1280/docs/superpowers/specs/2026-08-19-builder-era-abilities-design.md)
models these passive per-rank effects; they are not a complete era-ability catalog:

| Era | Ability | Effect per rank | Maximum ranks |
|---|---|---|---|
| Ancient | Mental Enhancement | +10 MA | 3 |
| Ancient | Arcane Focus | +1 spell damage and critical | 5 |
| Medieval | Hardened Skin | −3 AC | 5 |
| Medieval | Increased Potential | +1 to each primary attribute cap | 5 |
| Medieval | Physical Enhancement | +20 MV | 3 |
| Medieval | Weapon Focus | +5 hitroll and damroll | 1 |
| Medieval | Innate Regeneration | +1 to all three regen stats | 3 |
| Industrial | Physical Endurance | +10 HP | 3 |

Remort is a repeatable level50 restart that resets learned skills/words and cast levels while
retaining specified possessions and era progression; its present access rules remain `null`.

The [community death guide](https://www.legendhub.org/wiki/details.html?id=735) (2019) describes
an XP-gain penalty timer below50, immediate XP loss at50, recall-point return, and corpse recovery
with lights/boats/soulbound exceptions. Official [Major Updates](https://www.legendmud.org/index.php/Major_Updates)
corroborates the under50 death change in February2019. The old FAQ's immediate half-XP/750k-cap
claim must not be treated as current. Exact death penalty, corpse decay and resurrection formulas: `null`.

[Official RENT](https://www.legendmud.org/index.php/RENT) describes an equipment-value allowance
of `1000*(level+1)`, not a recurring gold fee. The
[community rent guide](https://www.legendhub.org/wiki/details.html?id=739) (2019-07-14)
adds Packrat expansion and over-rent restrictions. It conflicts with old FAQ warnings about
losing equipment after a disconnect. Present over-rent persistence behavior: `null`.
Rent allowance is distinct from weight/encumbrance and is not a reason to weaken Loka's save guarantees.

The [community economy guide](https://www.legendhub.org/wiki/details.html?id=744) (2019)
distinguishes an item's estimated value from a shop's actual offer; NPC shops, player shops and
auctions trade goods. Monetized items are excluded from rent but cannot be used or saved normally.
Those online economic constraints are not automatically suitable for an offline chapter.

## Before implementing a Loka rule

Use the [adoption decision's reconciliation table](../decisions/owner-decision-legendmud-baseline-2026-10-03.md#reconciliation-before-implementation).
For each mechanic slice, freeze its source/version and controlled examples; specify applicability
by level, equipment, position and effects; resolve a public-source disagreement or record an
explicit Loka departure; then amend `docs/system` and implement within the approved scope.

Public evidence has not recovered the full resolver. Current in-game HELP or maintainer-confirmed
rules are still needed for hit/dodge/parry/block order and odds, weapon swings and damage, skill
success, concentration, arbitrary-level pools, recovery cadence, encumbrance, saves/resistances,
and death penalties. Until verified or deliberately designed for Loka, those rules stay `null`.
