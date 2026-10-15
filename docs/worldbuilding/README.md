# Worldbuilding: the stub tree

The worldbuilding subproject (Beads epic `loka-ikch`) builds Loka's own cosmology, lore and
profession systems from the ground up. It replaces the Ashmere setting (owner 2026-10-15; Ashmere
canon is not an input). This folder is the world bible's skeleton: one short stub per area that
needs a decision, with no lore, names or answers yet. Stubs are filled in order, promoted through
the canon tiers below, and each fact lives in exactly one stub (one fact, one place).

The engine owns mechanics and cartridges own numbers and lore
([owner decision](../decisions/owner-decision-world-parameters-2026-10-02.md)), so every stub
names the game systems it feeds, by toolbox row id ([toolbox](../MECHANICS-TOOLBOX.md)) or
installed capability ([mechanics](../system/mechanics.md)). The profession engine set (E1 craft,
E2 skill prerequisite, E3 build step) is in Beads `loka-kgd.108`, note "FABLE PROFESSIONS".

## How to use a stub

Every stub has the same shape: `Status`, `Purpose`, `Must answer` (the questions), `Must agree
with` (cohesion links), `Feeds` (systems). To fill one: answer its questions under a new
`## Decisions` heading, keep the questions, change `Status: stub` to the tier reached, and check
every linked stub still agrees (log any clash in the
[continuity log](00-foundations/continuity-log.md)). A stub that needs an owner call lists it in
[open questions](00-foundations/open-questions.md). Stubs stay short; a long answer becomes a
sibling file in the same area, linked from the stub. Raw owner notes go in [notes/](notes/README.md)
and are not canon until a stub absorbs them.

Hidden-elite stubs (area 03) each carry Koster's Jedi lesson as an open question: cartridge data
on the phone will be read and shared, so how secret can a hidden path be? Stubs ask; they do not
answer.

## Canon tiers

Modelled on the Star Wars Holocron's G/T/C/S/N ladder, reduced to what Loka needs:

| Tier | Meaning | Who sets it |
|---|---|---|
| `canon` | decided; cartridges and later stubs must agree; a change is a logged retcon | owner |
| `draft` | a filled answer under review; may still change without a retcon log | PM or writer |
| `idea` | one option among several; never cited as fact | anyone |
| `stub` | questions only | this PR |
| `retired` | superseded; kept one release for the continuity log | owner |

Cartridge content is canon only for what the bible says; a game's numbers (as in Star Wars games'
stats) are never lore. Player-made Realm content is a tier below the bible (the Realm stubs decide
the rules).

## Fill order

What must be decided before the rest can be written, after Sanderson (start from what the story
and play need; limits before powers), Tolkien (languages before names; deep history before the
present) and the Koster checklist (decide economy, consent and import rules before the Realm):

1. **Foundations** (00): premise and pillars, player fantasy, tone, Story vs Realm canon.
2. **Cosmology and the Power** (01), then **magic systems with their limits** (02): every people,
   faith and profession depends on what power is and what it costs.
3. **The warden order and the elite categories** (03): shape, rarity and secrecy policy, before
   professions and factions are drawn around them.
4. **Deep history and eras** (04) with **calendar and time** (17): dates, eras and the day-one
   state that every place and faction cites.
5. **Geography and ecology** (05, 06): where things are, what grows and hunts.
6. **Peoples and languages** (07, 08): languages and naming guides before any name is written.
7. **Religion, factions, law** (09, 10, 11).
8. **Economy, technology, crafting, professions** (12, 13, 14, 15): one pass together, since each
   constrains the others (interdependence, faucets and sinks, demand per profession).
9. **Daily life, arts, warfare, health** (16, 18, 19, 20).
10. **Story, characters, places, quests** (21, 22, 23, 24), then **mysteries** (25) as the register of
    what the earlier areas hid.
11. **Realm** (26) rules are written before the Realm exists; **glossary, continuity log and open
    questions** (00) are kept throughout.

## Cohesion checklist

Before a stub is promoted to `draft` or `canon`:

- Every `Must agree with` link was re-read and still agrees; clashes are in the continuity log.
- The answer invents nothing another stub owns (one fact, one place); it links instead.
- Names follow the naming guides (08) and are in the glossary with the owning stub.
- Every power, item or rule states its cost and limit (Sanderson's second law) and its place in
  faucets and sinks (12).
- Every secret is in the mysteries register with its tier and reveal (25), and its data-mining
  exposure is stated.
- The systems in `Feeds` exist, or the gap is in the mechanics gap register (00).
- Offline Story and Realm readings are both stated where they differ (26).
- The Ashmere setting is not cited as a source.

## Sources consulted

- Brandon Sanderson, laws of magic: [First Law](https://www.brandonsanderson.com/blogs/blog/sandersons-first-law),
  [Second Law](https://www.brandonsanderson.com/blogs/blog/sandersons-second-law),
  [Third Law](https://www.brandonsanderson.com/blogs/blog/sandersons-third-law); summary with the
  Zeroth Law at [Coppermind](https://coppermind.net/wiki/Sanderson%27s_Laws_of_Magic); the BYU
  lecture series ("Writing Science Fiction and Fantasy",
  [2020 playlist](https://www.youtube.com/playlist?list=PLSH_xM-KC3Zv-79sVZTTj-YA6IAqh8qeQ)),
  worldbuilding lectures.
- J. R. R. Tolkien: *The Lord of the Rings*, Appendices A to F (chronology, calendars, languages
  and writing systems); languages-first method in *Letters* no. 165
  ([LOTR appendices](https://en.wikipedia.org/wiki/The_Lord_of_the_Rings#Appendices)).
- Star Wars: the Force, eras and factions; the Holocron continuity database's canon tiers
  (G, T, C, S, N) ([canon overview](https://starwars.fandom.com/wiki/Canon)).
- Patricia C. Wrede, *Fantasy Worldbuilding Questions*
  ([SFWA](https://www.sfwa.org/2009/08/04/fantasy-worldbuilding-questions/)).
- TTRPG setting bibles: *Forgotten Realms Campaign Setting* (Greenwood, 1987 and 2001 editions:
  deep history, regional gazetteers, pantheon, calendar) and *Eberron Campaign Setting* (Baker,
  2004: tone pillars, magic as the world's engine, every element has a hook)
  ([Eberron](https://en.wikipedia.org/wiki/Eberron)).
- Raph Koster: LegendMUD, Ultima Online and Star Wars Galaxies lessons, in the repo at
  [docs/rnd/koster-design-lessons-2026-10-15.md](../rnd/koster-design-lessons-2026-10-15.md) with
  its [research notes](../rnd/koster-research-notes/legendmud-ultima-online.md); its checklist
  section feeds areas 03, 12, 14, 15, 23 and 26.
- Worldbuilding checklists: the Wrede list above, the SFWA worldbuilding resources, and
  [Worldbuilding Stack Exchange's](https://worldbuilding.stackexchange.com/) recurring categories
  (used only to check the area list for gaps).
- Loka inputs: [MECHANICS-TOOLBOX.md](../MECHANICS-TOOLBOX.md), [mechanics.md](../system/mechanics.md),
  [world-parameters.md](../world-parameters.md), Beads `loka-ikch` and `loka-kgd.108`.

## Table of contents

Area folders are numbered in fill order. Counts are stubs per area.

### 00-foundations

Foundations: premise, tone, player, canon housekeeping (12 stubs).

- [Premise and pillars](00-foundations/premise-and-pillars.md)
- [Themes and questions](00-foundations/themes.md)
- [Tone and style guide](00-foundations/tone-and-style-guide.md)
- [Narration voice](00-foundations/narration-voice.md)
- [Player fantasy](00-foundations/player-fantasy.md)
- [The player's role in the world](00-foundations/player-role-in-world.md)
- [Inspirations and anti-inspirations](00-foundations/inspirations-and-anti-inspirations.md)
- [Lore to cartridge mapping](00-foundations/cartridge-mapping.md)
- [Mechanics gap register](00-foundations/mechanics-gap-register.md)
- [Glossary](00-foundations/glossary.md)
- [Continuity and contradictions log](00-foundations/continuity-log.md)
- [Open questions for the owner](00-foundations/open-questions.md)

### 01-cosmology

Cosmology and metaphysics (9 stubs).

- [Structure of the cosmos](01-cosmology/cosmos-structure.md)
- [Metaphysics: what is real](01-cosmology/metaphysics.md)
- [The Power: the cosmic force behind the wardens](01-cosmology/the-power.md)
- [Creation and origin myth](01-cosmology/creation-myth.md)
- [Gods and great powers](01-cosmology/gods-and-powers.md)
- [Afterlife and the metaphysics of death](01-cosmology/afterlife-and-death-metaphysics.md)
- [Cosmic time and cycles](01-cosmology/time-and-cycles.md)
- [The cosmic threat or pressure](01-cosmology/cosmic-threat.md)
- [What the world itself does not know](01-cosmology/the-unknown.md)

### 02-magic

Magic and power systems (14 stubs).

- [Magic systems overview](02-magic/magic-overview.md)
- [First law: understanding before solving](02-magic/first-law-understanding.md)
- [Second law: limits over powers](02-magic/second-law-limits-and-costs.md)
- [Third law: expand before adding](02-magic/third-law-expand-before-adding.md)
- [Source and access: who can use magic and how it is learned](02-magic/source-and-access.md)
- [Costs, risks and failure](02-magic/costs-and-risks.md)
- [Limits and impossibilities](02-magic/limits-and-impossibilities.md)
- [Interactions between systems](02-magic/interactions-between-systems.md)
- [Magic and society](02-magic/magic-and-society.md)
- [Magic items and artifacts](02-magic/magic-items-and-artifacts.md)
- [Spells: catalog structure](02-magic/spells-catalog-structure.md)
- [Rituals and long magic](02-magic/rituals-and-long-magic.md)
- [Corruption, curses and blessings](02-magic/corruption-curses-and-blessings.md)
- [Sensing, perception and concealment](02-magic/sensing-and-perception-magic.md)

### 03-orders

The warden order and the hidden elites (16 stubs).

- [Hidden elites: overview](03-orders/hidden-elites-overview.md)
- [The warden order](03-orders/warden-order.md)
- [Warden code and doctrine](03-orders/warden-code-and-doctrine.md)
- [The warden path: finding and entering the order](03-orders/warden-path-and-unlock.md)
- [Warden powers and limits](03-orders/warden-powers-and-limits.md)
- [Warden history and schisms](03-orders/warden-history-and-schism.md)
- [Warden places](03-orders/warden-places.md)
- [Elite category: martial](03-orders/elite-category-martial.md)
- [Elite category: arcane](03-orders/elite-category-arcane.md)
- [Elite category: craft](03-orders/elite-category-craft.md)
- [Elite category: social and civic](03-orders/elite-category-social-civic.md)
- [Elite category: wild](03-orders/elite-category-wild.md)
- [Elite category: shadow](03-orders/elite-category-shadow.md)
- [Elite rivalries and relations](03-orders/elite-rivalries-and-relations.md)
- [Elite rarity and power budget](03-orders/elite-rarity-and-power-budget.md)
- [Elites in the shared Realm](03-orders/elites-and-the-realm.md)

### 04-history

Deep history and eras (14 stubs).

- [Deep time outline](04-history/deep-time-outline.md)
- [Era: creation](04-history/age-of-creation.md)
- [Era: the age of myth](04-history/age-of-myth.md)
- [Era: ancient](04-history/ancient-era.md)
- [Era: classical](04-history/classical-era.md)
- [Era: the fall or cataclysm](04-history/the-cataclysm-or-fall.md)
- [Era: the dark age](04-history/dark-age.md)
- [Era: recent](04-history/recent-era.md)
- [The present day](04-history/present-day.md)
- [The future and what is foretold](04-history/future-and-prophecy.md)
- [Master timeline](04-history/timeline-master.md)
- [Legendary events](04-history/legendary-events.md)
- [Lost civilisations and ruins](04-history/lost-civilizations-and-ruins.md)
- [Historiography: who records and what is wrong](04-history/historiography.md)

### 05-geography

Geography: worlds, lands, climate, travel (13 stubs).

- [Planes and worlds](05-geography/planes-and-worlds.md)
- [Planet and sky](05-geography/planet-and-sky.md)
- [Continents and seas](05-geography/continents-and-seas.md)
- [Climate and weather](05-geography/climate-and-weather.md)
- [Biomes](05-geography/biomes.md)
- [Region template](05-geography/region-template.md)
- [The starting region](05-geography/starting-region.md)
- [Maps and cartography](05-geography/maps-and-cartography.md)
- [Travel, distances and the room scale](05-geography/travel-and-distances.md)
- [Natural resources and their distribution](05-geography/natural-resources.md)
- [Hazards and exposure](05-geography/hazards-and-exposure.md)
- [The underground and the depths](05-geography/underground-and-depths.md)
- [Waterways and the sea](05-geography/waterways-and-sea.md)

### 06-ecology

Ecology: flora, fauna, monsters (10 stubs).

- [Flora](06-ecology/flora.md)
- [Fauna](06-ecology/fauna.md)
- [Monsters and beasts](06-ecology/monsters-and-beasts.md)
- [Monster ecology and populations](06-ecology/monster-ecology.md)
- [Domesticated animals and mounts](06-ecology/domesticated-animals-and-mounts.md)
- [Magical creatures](06-ecology/magical-creatures.md)
- [Diseases and parasites](06-ecology/diseases-and-parasites.md)
- [Harvestables and regrowth](06-ecology/harvestables-and-regrowth.md)
- [Food chain and balance](06-ecology/food-chain-and-balance.md)
- [Extinct and mythic creatures](06-ecology/extinct-and-mythic-creatures.md)

### 07-peoples

Peoples, species and cultures (12 stubs).

- [Species roster](07-peoples/species-roster.md)
- [Species template](07-peoples/species-template.md)
- [Cultures roster](07-peoples/cultures-roster.md)
- [Culture template](07-peoples/culture-template.md)
- [Hometowns and origins](07-peoples/hometowns-and-origins.md)
- [Social structure and class](07-peoples/social-structure-and-class.md)
- [Gender, family and kinship](07-peoples/gender-family-and-kinship.md)
- [Life stages and coming of age](07-peoples/life-stages-and-coming-of-age.md)
- [Diaspora and migration](07-peoples/diaspora-and-migration.md)
- [Relations and prejudice between peoples](07-peoples/relations-between-peoples.md)
- [Names and identity](07-peoples/names-and-identity.md)
- [NPC archetypes by culture](07-peoples/npc-archetypes-by-culture.md)

### 08-languages

Languages and naming (10 stubs).

- [Language families](08-languages/language-families.md)
- [The common tongue](08-languages/common-tongue.md)
- [Scripts and literacy](08-languages/scripts-and-literacy.md)
- [Naming guide: people](08-languages/naming-guide-people.md)
- [Naming guide: places](08-languages/naming-guide-places.md)
- [Naming guide: things, materials, creatures](08-languages/naming-guide-things.md)
- [Phonology template](08-languages/phonology-template.md)
- [Sacred and secret languages](08-languages/sacred-and-secret-languages.md)
- [Idioms, oaths and swearing](08-languages/idioms-oaths-and-swearing.md)
- [Translation and comprehension in play](08-languages/translation-in-play.md)

### 09-religion

Religion, belief and rites (9 stubs).

- [Religions roster](09-religion/religions-roster.md)
- [Religion template](09-religion/religion-template.md)
- [The truth of belief](09-religion/truth-of-belief.md)
- [Clergy and temples](09-religion/clergy-and-temples.md)
- [Rites and sacraments](09-religion/rites-and-sacraments.md)
- [Heresies and cults](09-religion/heresies-and-cults.md)
- [Religion and the Power](09-religion/religion-and-the-power.md)
- [Pilgrimage and holy places](09-religion/pilgrimage-and-holy-places.md)
- [Death rites](09-religion/death-rites.md)

### 10-factions

Factions and politics (11 stubs).

- [Factions roster](10-factions/factions-roster.md)
- [Faction template](10-factions/faction-template.md)
- [Governments and states](10-factions/governments-and-states.md)
- [Nobility and titles](10-factions/nobility-and-titles.md)
- [Guilds and companies](10-factions/guilds-and-companies.md)
- [Secret societies](10-factions/secret-societies.md)
- [Criminal organisations](10-factions/criminal-organizations.md)
- [Military orders and companies](10-factions/military-orders.md)
- [Reputation and standing](10-factions/reputation-and-standing.md)
- [Diplomacy and current wars](10-factions/diplomacy-and-current-wars.md)
- [Succession and legitimacy](10-factions/succession-and-legitimacy.md)

### 11-law

Law, crime and justice (9 stubs).

- [Legal systems](11-law/legal-systems.md)
- [Crimes and punishments](11-law/crimes-and-punishments.md)
- [Enforcement: watch and guards](11-law/enforcement-watch-and-guards.md)
- [Trials and justice](11-law/trials-and-justice.md)
- [Property and ownership law](11-law/property-and-ownership-law.md)
- [Contracts, oaths and debt](11-law/contracts-oaths-and-debt.md)
- [Outlaws, bounties and the wanted](11-law/outlaws-bounties-and-wanted.md)
- [Law across borders](11-law/law-across-borders.md)
- [Player crime, griefing and consent](11-law/player-crime-and-consent.md)

### 12-economy

Economy: currency, trade, faucets and sinks (13 stubs).

- [Currency](12-economy/currency.md)
- [Prices and the value scale](12-economy/prices-and-value-scale.md)
- [Trade routes and markets](12-economy/trade-routes-and-markets.md)
- [Resources and raw materials](12-economy/resources-and-raw-materials.md)
- [Faucets and sinks](12-economy/faucets-and-sinks.md)
- [Scarcity and abundance](12-economy/scarcity-and-abundance.md)
- [Banking and credit](12-economy/banking-and-credit.md)
- [Taxes, tolls and fees](12-economy/taxes-tolls-and-fees.md)
- [Labour and wages](12-economy/labor-and-wages.md)
- [Shops and merchants](12-economy/shops-and-merchants.md)
- [Player market and friction](12-economy/player-market-and-friction.md)
- [Economy ledger and metrics](12-economy/economy-ledger-and-metrics.md)
- [Economy: offline to Realm import](12-economy/realm-import-policy.md)

### 13-technology

Technology and materials (10 stubs).

- [Technology level](13-technology/technology-level.md)
- [Materials catalog](13-technology/materials-catalog.md)
- [Metallurgy and alloys](13-technology/metallurgy-and-alloys.md)
- [Tools and machines](13-technology/tools-and-machines.md)
- [Energy, light and fire](13-technology/energy-light-and-fire.md)
- [Transport technology](13-technology/transport-technology.md)
- [Communication and information](13-technology/communication-and-information.md)
- [Medicine technology](13-technology/medicine-technology.md)
- [Weapons and armour technology](13-technology/weapons-and-armor-technology.md)
- [Magic versus technology](13-technology/magic-vs-technology.md)

### 14-crafting

Crafting traditions and chains (10 stubs).

- [Crafting philosophy: interdependence](14-crafting/crafting-philosophy.md)
- [Crafting chains](14-crafting/crafting-chains.md)
- [Schematics and recipes](14-crafting/schematics-and-recipes.md)
- [Quality and experimentation](14-crafting/quality-and-experimentation.md)
- [Stations and workshops](14-crafting/stations-and-workshops.md)
- [Resource attributes and rotation](14-crafting/resource-attributes-and-rotation.md)
- [Durability, repair and decay](14-crafting/durability-repair-and-decay.md)
- [Consumables: food, drink and medicine](14-crafting/consumables-food-and-medicine.md)
- [Crafting traditions by culture](14-crafting/crafting-traditions-by-culture.md)
- [Masterwork and signature](14-crafting/masterwork-and-signature.md)

### 15-professions

Professions and skill trees (19 stubs).

- [Profession system overview](15-professions/profession-system-overview.md)
- [Skill tree grammar](15-professions/skill-tree-grammar.md)
- [Capacity budget and surrender](15-professions/capacity-budget-and-surrender.md)
- [XP kinds and growth by use](15-professions/xp-kinds-and-growth.md)
- [Starting professions roster](15-professions/starting-professions-roster.md)
- [Starter category: combat](15-professions/starting-combat.md)
- [Starter category: crafting](15-professions/starting-crafting.md)
- [Starter category: gathering and survival](15-professions/starting-gathering-survival.md)
- [Starter category: healing](15-professions/starting-healing.md)
- [Starter category: social and entertainer](15-professions/starting-social-entertainer.md)
- [Starter category: merchant and trader](15-professions/starting-merchant-trader.md)
- [Starter category: scholar and arcane](15-professions/starting-scholar-arcane.md)
- [Starter category: civic and builder](15-professions/starting-civic-builder.md)
- [Advanced professions roster](15-professions/advanced-professions-roster.md)
- [Elite unlock grammar](15-professions/elite-unlock-grammar.md)
- [Trainers and teaching](15-professions/trainers-and-teaching.md)
- [Titles and recognition](15-professions/titles-and-recognition.md)
- [Profession demand map](15-professions/profession-demand-map.md)
- [Profession balance and playtest](15-professions/profession-balance-and-playtest.md)

### 16-daily-life

Daily life (13 stubs).

- [Food and drink](16-daily-life/food-and-drink.md)
- [Clothing and fashion](16-daily-life/clothing-and-fashion.md)
- [Housing and architecture](16-daily-life/housing-and-architecture.md)
- [Furniture and household goods](16-daily-life/furniture-and-household.md)
- [Family and household roles](16-daily-life/family-and-household-roles.md)
- [Work and the daily schedule](16-daily-life/work-and-daily-schedule.md)
- [Festivals and holidays](16-daily-life/festivals-and-holidays.md)
- [Hospitality and inns](16-daily-life/hospitality-and-inns.md)
- [Hygiene, health and sanitation](16-daily-life/hygiene-health-and-sanitation.md)
- [Education and apprenticeship](16-daily-life/education-and-apprenticeship.md)
- [Leisure and games](16-daily-life/leisure-and-games.md)
- [Travel customs](16-daily-life/travel-customs.md)
- [Manners, greetings and taboos](16-daily-life/manners-greetings-and-taboos.md)

### 17-time

Calendar, time and astronomy (10 stubs).

- [Calendar](17-time/calendar.md)
- [Day and night](17-time/day-and-night.md)
- [Sky bodies seen from the ground](17-time/planet-and-sky-link.md)
- [Seasons](17-time/seasons.md)
- [Moons and tides](17-time/moons-and-tides.md)
- [Astronomy and stars](17-time/astronomy-and-stars.md)
- [Astrology and omens](17-time/astrology-and-omens.md)
- [Time reckoning and eras](17-time/time-reckoning-and-eras.md)
- [Elapsed time and phone play](17-time/elapsed-time-and-phone-play.md)
- [Weather model](17-time/weather-model.md)

### 18-arts

Arts, music and literature (8 stubs).

- [Music and instruments](18-arts/music-and-instruments.md)
- [Songs and the bardic tradition](18-arts/songs-and-bardic-tradition.md)
- [Literature and books](18-arts/literature-and-books.md)
- [Visual arts and crafts](18-arts/visual-arts-and-crafts.md)
- [Theatre, storytelling and oral tradition](18-arts/theatre-storytelling-and-oral.md)
- [Architecture styles](18-arts/architecture-styles.md)
- [Proverbs, folklore and tales](18-arts/proverbs-folklore-and-tales.md)
- [In-world documents and readables](18-arts/in-world-documents-and-readables.md)

### 19-warfare

Military and warfare (10 stubs).

- [Warfare and armies](19-warfare/warfare-and-armies.md)
- [Weapons catalog](19-warfare/weapons-catalog.md)
- [Armour and shields](19-warfare/armor-and-shields.md)
- [Tactics and formations](19-warfare/tactics-and-formations.md)
- [Fortifications and sieges](19-warfare/fortifications-and-sieges.md)
- [Mercenaries and hirelings](19-warfare/mercenaries-and-hirelings.md)
- [Naval and mounted warfare](19-warfare/naval-and-mounted-warfare.md)
- [War and magic](19-warfare/war-and-magic.md)
- [Martial arts and duelling](19-warfare/martial-arts-and-dueling.md)
- [Damage kinds and materials](19-warfare/damage-kinds-and-materials.md)

### 20-health

Health, death and afterlife (9 stubs).

- [Injury and healing](20-health/injury-and-healing.md)
- [Disease and plague](20-health/disease-and-plague.md)
- [Medicine, herbs and remedies](20-health/medicine-herbs-and-remedies.md)
- [Death and what follows](20-health/death-and-what-follows.md)
- [Resurrection and return rules](20-health/resurrection-and-return-rules.md)
- [Ageing and lifespan](20-health/aging-and-lifespan.md)
- [Mental health, madness and fear](20-health/mental-health-madness-and-fear.md)
- [Poisons and antidotes](20-health/poisons-and-antidotes.md)
- [Healers and hospitals](20-health/healers-and-hospitals.md)

### 21-story

The main storyline, chapters and themes (10 stubs).

- [Main storyline arc](21-story/main-storyline-arc.md)
- [Chapter structure](21-story/chapter-structure.md)
- [Chapter template](21-story/chapter-template.md)
- [Antagonists and pressures](21-story/antagonists-and-pressures.md)
- [Acts and turning points](21-story/acts-and-turning-points.md)
- [Endings and player agency](21-story/endings-and-player-agency.md)
- [Side stories and storylets](21-story/side-stories-and-storylets.md)
- [Chapter carry-over](21-story/chapter-carry-over.md)
- [Story mode versus Realm events](21-story/story-mode-vs-realm-events.md)
- [Prophecy and foreshadowing](21-story/prophecy-and-foreshadowing.md)

### 22-characters

Characters as archetypes (10 stubs).

- [Character archetypes](22-characters/character-archetypes.md)
- [Mentor archetypes](22-characters/mentor-archetypes.md)
- [Companion archetypes](22-characters/companion-archetypes.md)
- [Antagonist archetypes](22-characters/antagonist-archetypes.md)
- [Authority figures](22-characters/authority-figures.md)
- [Common folk and service NPCs](22-characters/common-folk-and-service-npcs.md)
- [NPC template](22-characters/npc-template.md)
- [NPC schedules and lives](22-characters/npc-schedules-and-lives.md)
- [Relationships and trust](22-characters/relationships-and-trust.md)
- [Player character origins](22-characters/player-character-origins.md)

### 23-places

Places: settlements, landmarks, dungeons (12 stubs).

- [Settlement types](23-places/settlement-types.md)
- [Settlement template](23-places/settlement-template.md)
- [The starting settlement](23-places/starting-settlement.md)
- [Capital and major cities](23-places/capital-and-major-cities.md)
- [Landmarks and wonders](23-places/landmarks-and-wonders.md)
- [Dungeons and ruins](23-places/dungeons-and-ruins.md)
- [Dungeon template](23-places/dungeon-template.md)
- [Wilderness sites](23-places/wilderness-sites.md)
- [Sacred sites](23-places/sacred-sites.md)
- [Hidden places and secrets](23-places/hidden-places-and-secrets.md)
- [Housing plots and land](23-places/housing-plots-and-land.md)
- [Player towns and settlements](23-places/player-towns.md)

### 24-quests

Quests and story hooks (9 stubs).

- [Quest types](24-quests/quest-types.md)
- [Quest template](24-quests/quest-template.md)
- [Story hooks catalog](24-quests/story-hooks-catalog.md)
- [Rumours and information flow](24-quests/rumours-and-information-flow.md)
- [Rewards and stakes](24-quests/rewards-and-stakes.md)
- [Deadlines and failure](24-quests/deadlines-and-failure.md)
- [World events](24-quests/world-events.md)
- [Faction quests](24-quests/faction-quests.md)
- [Profession quests](24-quests/profession-quests.md)

### 25-mysteries

Mysteries and secrets (5 stubs).

- [Mysteries register](25-mysteries/mysteries-register.md)
- [Secrets tiers: who knows what](25-mysteries/secrets-tiers.md)
- [Reveals schedule](25-mysteries/reveals-schedule.md)
- [Red herrings and false lore](25-mysteries/red-herrings-and-false-lore.md)
- [Data-mining exposure](25-mysteries/data-mining-exposure.md)

### 26-realm

Offline Story versus the shared Realm (9 stubs).

- [Story versus Realm canon](26-realm/story-vs-realm-canon.md)
- [Shared world rules](26-realm/shared-world-rules.md)
- [Import policy: offline into the Realm](26-realm/import-policy.md)
- [PvP and consent](26-realm/pvp-and-consent.md)
- [Social ladder and trust](26-realm/social-ladder-and-trust.md)
- [Staff and governance](26-realm/staff-and-governance.md)
- [Player towns and land supply](26-realm/player-towns-and-land-supply.md)
- [Persistence and export](26-realm/persistence-and-export.md)
- [Live ops and change policy](26-realm/live-ops-and-change-policy.md)
