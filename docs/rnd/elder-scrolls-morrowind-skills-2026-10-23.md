# Morrowind's character system, and what Loka takes from it (2026-10-23)

Research note for the [abilities design](../game-design/abilities-design-2026-10-23.md). Owner ask
(paraphrased): everyone can learn basic spells, skills, combat and crafting, and may specialize by
joining a guild or house; how did Morrowind and Star Wars Galaxies (SWG) do it?

Sources: UESP pages read 2026-10-23 through a summarizing fetch tool, so spot-check numbers
against the pages. Tags: *(UESP)* wiki-derived; *(secondary)* not from Bethesda; *(memory)* the
writer's knowledge, not re-checked this session. SWG facts are in
[the SWG notes](koster-research-notes/star-wars-galaxies.md) and not repeated here.

## 1. Everything is open; class only sets speed and head start

Morrowind (2002) has 27 skills, nine in each of three specializations
([Skills](https://en.uesp.net/wiki/Morrowind:Skills), *UESP*):

| Specialization | Skills |
|---|---|
| Combat | Armorer, Athletics, Axe, Block, Blunt Weapon, Heavy Armor, Long Blade, Medium Armor, Spear |
| Magic | Alchemy, Alteration, Conjuration, Destruction, Enchant, Illusion, Mysticism, Restoration, Unarmored |
| Stealth | Acrobatics, Hand-to-hand, Light Armor, Marksman, Mercantile, Security, Short Blade, Sneak, Speechcraft |

Every skill has a governing attribute (Long Blade: Strength; Destruction: Willpower; Alchemy:
Intelligence). A class picks 5 major and 5 minor skills and one specialization; the other 17
are "miscellaneous". Nothing is forbidden. A warrior can cast, pick locks and brew potions.

**Starting values** (*UESP*): every skill 5; major +25; minor +10; specialization skills +5;
race bonuses on top; 50 at most at the start.

**Growth by use** (*UESP*): each action gives progress (0.02 for a second of running, up to 30
for a very good sale). One skill point needs

`(skill + 1) x class factor x specialization factor`

with class factor 0.75 for a major skill, 1 for minor, 1.25 for misc, and 0.8 inside your
specialization. So a class makes you **faster** at your skills. It does not make you able to use
them at all.

**Direct raises**: trainers, skill books and quest rewards add a point outright.

## 2. Levelling is where it broke

| Rule | Detail (*UESP*, [Level](https://en.uesp.net/wiki/Morrowind:Level)) |
|---|---|
| Level up | 10 raises of major or minor skills (misc do not count), then sleep |
| Attributes | pick 3 to raise; each gets a multiplier from the raises of skills it governs since the last level: 0 raises x1, 1-4 x2, 5-7 x3, 8-9 x4, 10+ x5 |
| Health | +10% of current Endurance per level, not backdated |

Players learned to plan around it ("efficient levelling"): leave a skill of each attribute as
misc, so you can raise it without levelling and bank x5 multipliers. Raise Endurance first,
because health is not backdated. The world's foes scale with level, so a character who levels
"wrongly" falls behind (*UESP*; *secondary*). This is Koster's rule again: **players decode every
formula** ([Koster report](koster-design-lessons-2026-10-15.md)).

Oblivion kept classes and level scaling and drew the same complaints. Skyrim dropped classes,
birthsigns-as-classes and the eight attributes. Todd Howard said Oblivion players chose a class
after half an hour, before they understood the skills, and often restarted; Skyrim lets you
"define your character as you play", with perks per skill instead of class bonuses
([Game Informer interview](https://gameinformer.com/b/news/archive/2011/01/13/road-to-skyrim-the-todd-howard-interview.aspx);
[TweakTown on classless builds](https://www.tweaktown.com/news/89748/all-new-bethesda-rpgs-to-offer-classless-builds-so-gamers-dont-waste-time/), *secondary*).

## 3. Trainers sell points, with two caps

([Trainers](https://en.uesp.net/wiki/Morrowind:Trainers), *UESP*)
- A trainer raises a skill one point for gold; price rises with your skill and falls with
  disposition, Mercantile and Fatigue. Each point takes 2 game hours.
- Cap 1: a trainer trains only up to their own skill (Master Trainers to 100).
- Cap 2: you cannot train a skill above its governing attribute.
- Trained points count toward levels and multipliers.

With enough gold a player could buy most of a character. Gold came easily from loot, so training
became a money-to-power pipe (*secondary*). Loka's rule is better: a fee **unlocks** a box, and
only use raises its level.

## 4. Magic: anyone casts anything, skill decides the odds

([Magic](https://en.uesp.net/wiki/Morrowind:Magic), [Spells](https://en.uesp.net/wiki/Morrowind:Spells), *UESP*)
- Six schools, each a skill: Alteration, Conjuration, Destruction, Illusion, Mysticism,
  Restoration.
- Maximum magicka = Intelligence x a multiplier (1 by default; race and birthsign raise it).
  Magicka does not regenerate except by rest, potions and some effects.
- **Cast chance** = `(school skill x 2 + Willpower/5 + Luck/10 - spell cost) x (0.75 + 0.5 x fatigue/max fatigue)`.
  A cheap spell works for almost anyone; a costly one fizzles for a novice. Fatigue
  (running, fighting) makes casting worse.
- Spells are bought from spell merchants, and members of the right guild can design their own
  (spellmaking); cost grows with magnitude, duration and area, x1.5 when aimed at a target.
- **Powers** (from race or birthsign) never fail, cost no magicka, and work once a day.
- Enchanting puts an effect on an item with a filled soul gem: cast when used, on strike, or
  constant while worn.
- Alchemy and enchanting are open to everyone. Stacking potions that raise Intelligence, then
  brewing stronger potions with it, made a known runaway loop (*memory*; widely documented by
  players).

## 5. Combat shares the same stats

Hit chance comes from weapon skill, Agility, Luck and Fatigue (*memory*; UESP Combat page). A
novice with a sword misses often, which players called "swing and miss" (*secondary*). Fatigue
is one pool that running, fighting, casting odds and even trainer prices read.

## 6. Factions: open guilds and one exclusive house

([Factions](https://en.uesp.net/wiki/Morrowind:Factions), [Great Houses](https://en.uesp.net/wiki/Morrowind:Great_Houses), [Mages Guild](https://en.uesp.net/wiki/Morrowind:Mages_Guild), *UESP*)

- **Guilds you may hold together**: Fighters Guild, Mages Guild, Thieves Guild, Imperial
  Legion, Imperial Cult, Tribunal Temple, Morag Tong.
- **Great Houses, choose one**: Hlaalu (trade, politics), Redoran (warriors), Telvanni
  (wizards). Each house is hostile (-1) to the other two, and the penalty grows with your rank.
- **Ranks** need favored attributes, favored skills at rising levels, and reputation from the
  faction's quests. Example, Mages Guild:

| Rank | Attributes | Favored skills | Reputation |
|---|---|---|---|
| Associate | INT 30, WIL 30 | none | 0 |
| Journeyman | INT 30, WIL 30 | one at 20 | 10 |
| Conjurer | INT 30, WIL 30 | one at 40, two at 10 | 30 (and 200 gold dues) |
| Wizard | INT 33, WIL 33 | one at 70, two at 25 | 80 (and a Wizard's Staff) |
| Arch-Mage | INT 35, WIL 35 | one at 90, two at 35 | 125 |

- **What rank gives**: trainers, services (enchanter, healer, alchemist), guild teleports,
  supply chests that refill, quests, titles. House rank also builds a stronghold in stages
  (*memory*).
- **Expulsion** for crimes against the faction; readmission after time or a fine (Mages Guild:
  automatic after 30 days) (*UESP*).

Identity in Morrowind comes from **what you joined and how high you rose**, not from what you are
allowed to do.

## 7. Morrowind and SWG side by side

| | Morrowind | SWG (pre-CU) | Loka today |
|---|---|---|---|
| Can a novice try anything? | yes | no: a box grants the action | box-gated, novice box free |
| Growth | use, scaled by class | typed XP spent on boxes | use counts per box; XP never spent |
| Specialization | class speed, faction rank | capacity budget (3 masters and a dabble) | capacity proposed (design §1.5) |
| Money and skill | trainers sell points | trainers charge for boxes | fee unlocks a box only |
| Magic | anyone casts; skill sets odds | only Jedi and buffs | learned words; costs in pools |
| Factions | guilds stack; one Great House | factions (Rebel, Imperial), cities | not built (content can do it) |
| Needs other players? | no (single-player) | yes, by design | offline first, Realm later |

## 8. Lessons for Loka

Copy:
1. **Basics open to all.** Every character can try every basic action. In Loka: the novice box
   of every basic is free and taught to everyone (in the prologue, §11 of the design).
2. **Specialists are better, not exclusive.** A novice's cast fizzles more, a novice's blade
   misses more. In Loka: deterministic ratings do this (a novice passes only easy checks).
3. **Factions carry identity.** Guilds you may stack; one house you must choose; ranks need
   favored skills plus deeds. Loka content can already express all of it with facts and
   `skill_compare` policies, no engine change.
4. **Ranks give places and people,** not bigger numbers: trainers, services, a hall, a title.
5. **Powers**: a once-a-day gift that never fails and costs nothing. A good shape for the
   wardens' resonance (a recipe with a one-day cooldown).
6. **One shared weariness pool** that many actions read (Loka has `mv`).

Avoid:
1. **Tying a global level to skill raises**, and attribute multipliers that reward planning
   over play. Loka's levelling comes from deeds (kills, quests), apart from skills: keep it.
2. **Gold buying skill points.** Keep fees as unlocks only.
3. **Classes chosen in the first half hour.** Let the player choose after they have tried the
   basics (Skyrim's lesson).
4. **Runaway crafting loops.** Cap buff stacking before alchemy-like recipes ship.
5. **"Swing and miss" at the start.** A first-hour basic must succeed against first-hour
   ratings.
