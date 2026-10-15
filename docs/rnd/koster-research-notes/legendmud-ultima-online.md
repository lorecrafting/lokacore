# Raph Koster: LegendMUD and Ultima Online design lessons

Method note: facts below come from pages fetched this session (WebFetch summaries, not verbatim page reads) or from search-result snippets. Items marked [SNIPPET] rest only on a search snippet. Items marked [UNCERTAIN] are weakly sourced or in conflict. Several raphkoster.com pages were long and only partly read.

## LegendMUD: Koster's role, dates, grounding in history and myth, systems, lessons

### Takeaway
LegendMUD was a text, Diku-derived, historically themed MUD opened 14 Feb 1994, founded by a friend group. Koster (with his wife Kristen) was a very large content contributor and implementor, later took over administration, and he insists he did not create it alone. Its classless, hometown-gated skill design and its "myth as concrete reality" history zones fed directly into UO.

### Cited Findings
- Opened publicly 14 Feb 1994; derived from DikuMUD, later heavily customized; Mud Connector "Mud of the Month" Oct 1995; over 8,000 rooms and 60+ areas as of Spring 2007 — [Wikipedia: LegendMUD](https://en.wikipedia.org/wiki/LegendMUD)
- Founding: players of Worlds of Carnage started LegendMUD after that game went down. Sherry Menton (history major, college friend) came up with the basic idea and theme; she and Rick Delashmit were original implementors. Raph and Kristen joined well before launch, did a very large share of original content, became implementors, and took over when the founders stepped back. Raph: he did not create LegendMUD by himself — [Stratics interview, raphkoster.com](https://www.raphkoster.com/?p=22536)
- Raph's own account of his path: college friends introduced him to MUDs around 1992, leading to job offers from Origin and Meridian 59. Rick Delashmit was hired by Origin for an Ultima prototype and recommended Raph and Kristen. Lord British reportedly logged into Legend to look around, and some players doubted his identity — [Stratics interview](https://www.raphkoster.com/?p=22536)
- Wikipedia: Richard Bartle credits the design team as led by Koster; Koster earlier worked on Worlds of Carnage (first DikuMUD with embedded scripting language) — [Wikipedia](https://en.wikipedia.org/wiki/LegendMUD). Other pages claim founders were Menton and Delashmit with the Kosters joining pre-launch, so "founder/leader" wording is contested; Raph's own statement above is the safer wording.
- [SNIPPET] Koster was implementor handle "Ptah"; Kosters took over administration circa 1995; he retired as active immortal in 1997 to focus on UO — [episteme mirror of Wikipedia](https://episteme.tllm.fr/wiki/LegendMUD) / [breezewiki MUD wiki](https://breezewiki.discard.no/mud/wiki/LegendMUD). Secondary mirrors, not verified against primary.
- History and myth grounding: world built on real places at various points in history, treating each age's beliefs as real ("myths are concrete reality"). Example: a San Francisco industrial-era character can learn guns but not magic; an ancient Irish character can learn druidic skills but not field surgery — [Wikipedia](https://en.wikipedia.org/wiki/LegendMUD)
- Hometown determines available skills and thus affinity for magic, nature or technology; each town offers different skills; a non-magical-town character cannot master all of magic. Classless hybrid plus a level system — [Stratics interview](https://www.raphkoster.com/?p=22536). Skills learned from NPCs, some lessons require a small quest — [Wikipedia](https://en.wikipedia.org/wiki/LegendMUD)
- Content variety: embedded baseball games, Shakespeare at the Old Globe stage, WWI trench warfare, blackjack in London dockside pub back rooms. Raph attributes the variety to broad themes, easy tools and no graphics making content cheap — [Stratics interview](https://www.raphkoster.com/?p=22536)
- Roleplay/social: players nominated peers for a "best roleplayer" award; an out-of-character lounge anyone could teleport into; Raph later added a similar emote-puppeteering system to Star Wars Galaxies — [Stratics interview](https://www.raphkoster.com/?p=22536)
- Quest design: Raph rated some Legend quests above any he later played in MMOs (e.g. reviving a jungle town, followed by a color wave and ghostly inhabitants returning). He also said the game was basically Diku-style (levels, classes, fetch-and-carry) and that he had burned out on that style — [Stratics interview](https://www.raphkoster.com/?p=22536)
- Lessons he states: features that work in a MUD can break in an MMO (announcing every quest badge to all players would be "intolerable spam" at scale); MMOs absorbed only one current of MUD history; he recommends studying Armageddon (immersive roleplay) and DartMUD (virtual world design) — [Stratics interview](https://www.raphkoster.com/?p=22536)
- "A Story About a Tree" (Koster essay on a reported player death, Karyn) was seen by Bartle as key in virtual-world ethics; the death was never verified — [Wikipedia](https://en.wikipedia.org/wiki/LegendMUD)
- Wikipedia (via search snippet) says the classless concept shaped UO powerfully — [Wikipedia](https://en.wikipedia.org/wiki/LegendMUD) [SNIPPET-level claim; I did not see Koster say this himself]

### Inferences
- For Loka (offline, phone, text): the hometown-gated skill set plus small NPC quests is a cheap, text-native way to give identity without classes, and "each era's beliefs are true" gives a zone-theming rule.
- Legend's per-player announcements and OOC lounge are small-community features; Koster himself says they do not scale.

### Gaps
- No primary source found for his exact title/dates (implementor handle, 1997 departure).
- Nothing found on Legend's roleplay-enforcement rules or its current status beyond Wikipedia.
- Koster's own postmortem on what Legend taught him is thin: only the Stratics interview.

## UO use-based skills, 700 cap, macroing

### Takeaway
UO: all skills open to everyone, each use gives a chance to rise, 700-point total pool, with loss from other skills at cap. Rates were uneven, dynamic scaling failed, and players macroed (including the "8x8" RNG exploit). Koster's lesson: players decode every formula; fix the feedback loop; make skills enablers, not the goal; track usage metrics.

### Cited Findings
- 700 total skill points; gaining at cap removed a point from another skill (not necessarily least used); unused skills originally decayed; all skills open from start; originally watching others could advance skills; no difficulty rating so trivial actions advanced skills — [Koster, "Use-based systems" (2006)](https://www.raphkoster.com/2006/07/18/use-based-systems/)
- Use rates differed widely (swords swung often, "talking to the dead" rare). Dynamic scaling by usage failed for lack of a baseline and advancement kept slowing; players macroed chasing rolls whose chance fell to about one in ten thousand — same source
- Players trapped powerful monsters in houses to farm; "8x8 macroing": the RNG was seeded from chunk egg ID so results were predictable, and moving 8 tiles reset odds; later patches added "guaranteed gain" and "power hour" — same source
- Lessons: "No matter what you do, players will decode every formula, statistic, and algorithm in your world via experimentation"; practice that does not challenge becomes boring; failure was costless so players "bottomfed" on easy actions; fix the feedback loop; skills should enable other gameplay, not be the goal; keep usage-rate metrics — same source
- Laws of Online World Design: "No matter what you do, someone is going to automate the process of playing your world"; watching what players automate shows what is tedious/not fun — [Laws of Online World Design](https://www.raphkoster.com/games/laws-of-online-world-design/the-laws-of-online-world-design/)
- Crafters trading gold for skill points: "Every single crafter in the game went into the hole immediately, because they gladly traded gold for skill points" — [Koster, The evolution of UO's economy](https://www.raphkoster.com/games/snippets/the-evolution-of-uos-economy/)
- Fans describe the up/lock/down skill states for managing the cap [SNIPPET, fan/retrospective sources, not Koster] — [GameBanshee retrospective](https://gamebanshee.com/k4xp)
- 2019: Koster said the use-based system did not reward social activity such as running roleplay taverns ("the game would not acknowledge that"); Galaxies was designed to fix this by rewarding such activity — [Game Developer, Oct 2019](https://www.gamedeveloper.com/design/welcome-back-koster-why-an-mmorpg-vet-is-back-building-a-new-virtual-world)

### Inferences
- Loka offline: no live macro threat, but the same grind-to-gain loop exists for a player who spams one action. Use difficulty-gated gains and failure cost.
- A hard total cap with explicit raise/lock/lower states is simple to implement locally.

### Gaps
- Why exactly 700 (vs. other numbers) not found in Koster's words. Later cap changes (e.g. 720 with gear) are only from a Reddit snippet, unverified.
- "Use-based systems" article only read for first ~100k of ~189k characters.

## UO economy: resources, faucets, sinks, inflation

### Takeaway
Early UO was a closed loop with spawns injecting gold and too few drains; NPC shops and skill-point crafting incentives distorted everything. Stable at about 1 USD to 200 gold for a while, then currency collapsed after Renaissance.

### Cited Findings
- Faucets: spawns injected currency; Renaissance made gold from spawns easier; a login payment is called "the radical subsidy" — [Koster, evolution of UO's economy](https://www.raphkoster.com/games/snippets/the-evolution-of-uos-economy/)
- Sinks: too few drains even with item decay; house decay and quitting players removed some wealth; equilibrium was not designed — same source
- Inflation: stable rate about 1 USD to 200 UO gold from ~3 months after launch until after Koster left; after Renaissance a gold coin was worth about 100x less (his estimate); currency values were hardcoded (critter rewards, castle prices), making fixes hard; usual endpoint is wiping goods; same problem seen in Habitat in 1985 — same source
- NPC vendors: early shops adjusted prices/stock to sales, bought speculatively, and acted as "a gold spigot" rewarding macroing and skill gain; trivial distances meant no local markets — same source
- Zach Simpson's "In-Game Economics of Ultima Online" (1999, Origin; presented at CGDC March 2000) is the key analysis and popularized "faucet-drain economy" — [Koster on ecology](https://www.raphkoster.com/?p=46439); [Simpson paper (gwern mirror, only header read)](https://gwern.net/doc/economics/1999-04-07-simpson-theingameconomicsofultimaonline.html)
- Laws: without drains, "Monty Haul syndrome"; players hate drains — [Laws](https://www.raphkoster.com/games/laws-of-online-world-design/the-laws-of-online-world-design/)
- UO rares were bugs (e.g. pickable water tile, "true black" dye with missing hue) that grew into a collector minigame; Koster: "Far more often than you would think, you get magic through serendipity." He ties the water tiles to eBay sales and gold farming — [How UO rares were born](https://www.raphkoster.com/2010/11/24/how-uo-rares-were-born/); [Ten Lessons Learned](https://www.raphkoster.com/games/presentations/ten-lessons-learned-2/)

### Inferences
- Loka single-player: gold has no market, so any shop that buys at fixed price becomes an infinite faucet unless buyback is capped. Pair every faucet with a sink.

### Gaps
- Simpson's body text (faucet/sink numbers) not read; WebArchive blocked.
- Player-run economy specifics (vendors, resellers) not covered.

## Housing

### Takeaway
Little primary Koster material found. Secondary sources show scarce land caused price inflation, fixed partly by new land (Malas) and by decay rules.

### Cited Findings
- House decay and lost contents were a drain; "no need to refresh" under Renaissance expected to dip currency — [Koster, economy](https://www.raphkoster.com/games/snippets/the-evolution-of-uos-economy/)
- Laws: "Ownership is key"; building and owning gives a "barrier to departure" — [Laws](https://www.raphkoster.com/games/laws-of-online-world-design/the-laws-of-online-world-design/)
- Early housing exploits (stacked chairs to roofs, keys) added to PK problems — [Game Developer, brief history of murder in UO](https://www.gamedeveloper.com/design/a-brief-history-of-murder-in-ultima-online)
- [SNIPPET] Malas added land because limited open land caused unreasonable price inflation — [Wikipedia: UO expansions](https://en.wikipedia.org/wiki/Ultima_Online_expansions). Publish 16 (2002): a new house puts the account's other houses into condemned status, decaying in 5 days — [uo.com](https://uo.com/?p=11280)
- [SNIPPET] Lars Doucet (Game Developer) cites UO's housing crisis on populated shards as a land-scarcity example; Koster responded with notes I could not retrieve — [Massively OP](https://massivelyop.com/?p=351826)

### Gaps
- No primary account of the land rush or Koster's reflections; no house placement design detail. Treat as unresearched.

## Player killing, reputation, Trammel/Felucca

### Takeaway
Launch relied on town guards and a toothless single notoriety value; successive patches (color names, virtue guards, bounties, then Spring 1998 Reputation System with fame/karma and murder counts) did not stop PK. The Trammel/Felucca split doubled the userbase but Koster opposed it.

### Cited Findings
- Timeline: guards only at launch; Oct 1997 color-coded names; bounties/murder reports; traps (a trap with 3,000+ kills); Spring 1998 Reputation System (hidden fame and karma; blue/gray/red; five murders turn red; count decays 1 per 8 hours of play; stat loss on death for murderers); EverQuest's PK switch drew players; Koster wrote UO lost "many hundreds of thousands of players"; Trammel/Felucca around 2000, userbase "doubled once this went in"; "put paid to the early wild and crazy era"; "The dream of letting players police themselves was over" — [Game Developer: a brief history of murder in UO](https://www.gamedeveloper.com/design/a-brief-history-of-murder-in-ultima-online)
- Koster opposed a PK switch: "trading away player self-determination for security"; he would have continued stat loss and murder counts; thought player cities controlling PvP could have worked; "the PK problem basically undermined everything" — [Escapist, Koster on Fire](https://www.escapistmagazine.com/raph-koster-on-fire/)
- He said the split "came at the cost of a lot of magical stuff" while doubling subscribers — [Koster, Making of UO](https://www.raphkoster.com/2012/02/17/making-of-uo-articles-at-mmorpg-com/)
- [SNIPPET] Gordon Walton: PK drove away 70% of new players; Bartle called the split the beginning of UO's decline; "ghost town" Felucca — [Wikipedia: Ultima Online](https://en.wikipedia.org/wiki/Ultima_Online) (conflicting framing; dates vary by source)
- 1998 design essay: Koster treated PK as a crude exercise of power that builds culture ("Cultures define and refine themselves through conflict") — [raphkoster.com essay2](https://raphkoster.com/gaming/essay2.shtml)
- Admission: players "found ways to hurt each other with the toys we gave them"; the team often removed features — [Escapist](https://www.escapistmagazine.com/raph-koster-on-fire/). Also UO pushed the industry away from PvP for years — [Ultima Codex](https://ultimacodex.com/2017/10/raph-koster-on-ultima-onlines-influence/)
- Laws: "It is always more rewarding to kill other players than ... whatever the game sets up"; "Violence is inevitable" — [Laws](https://www.raphkoster.com/games/laws-of-online-world-design/the-laws-of-online-world-design/)

### Inferences
- Loka offline needs no PK; a future shared Realm should decide PvP consent up front (Koster's regret is the late bolt-on).

### Gaps
- Gordon Walton 70% figure only via snippet. Exact Trammel date unclear (sources say ~2000/Renaissance in 2000-01).

## Virtual ecology: what was planned, cut, and why

### Takeaway
Koster's design: resources as labels, creatures with food/shelter/desire needs, spawn driven by resource surplus. It worked in alpha, was rewritten and slowed in beta, and was effectively disabled mainly for performance. He denies players "killed everything" caused it.

### Cited Findings
- Design: resources are labels; objects PRODUCE, FOOD, SHELTER, DESIRE; creatures seek food, then shelter, then desires (Maslow-like); rabbit/wolf/dragon examples (dragon desires GOLD, GEM, MAGIC); wolf packs pool bites — [Koster, UO's resource system](https://www.raphkoster.com/?p=517)
- Spawn driven by resource surplus ("spontaneous generation"); creatures leveled up; chunk eggs per 8x8 chunk; spawn regions later replaced resource-driven spawning — [part 2](https://www.raphkoster.com/?p=519)
- Why it failed: radial search and pathfinding were costly; search frequency cut and creatures put to sleep when no players nearby; some team members thought it a boondoggle; beta rewrite was "slow behaviors" (bear took minutes to find visible honey); quest-linking stage never happened — [part 1](https://www.raphkoster.com/?p=517), [part 2](https://www.raphkoster.com/?p=519)
- Koster rebuttal: AI disabled for cost, not players; rewritten "by an engineer who didn't really like or understand it"; resource values survive in crafting/harvesting; the collapse came from the economy loop (players made wool shirts to grind crafting, hoarded, central bank ran out of wool) — "The ecology collapsed for a different reason" — [Did players destroy the UO ecology?](https://www.raphkoster.com/?p=46439)
- Dragon/deer story: the "dragons eating deer" example came from design samples he and Kristen sent with job applications [SNIPPET] — [GameSpot preview](https://www.gamespot.com/articles/ultima-online-preview/1100-2559974/). Garriott's version: players swarmed like ants and killed every creature as soon as it spawned [SNIPPET, via GameBanshee/Ars], contradicted in cause by Koster above.
- Reader comments (not Koster) claim near-extinction hunting — [part 1 comments](https://www.raphkoster.com/?p=517)
- Garriott warns against simulated ecology; Koster still wants to try — [Ultima Codex](https://ultimacodex.com/2017/10/raph-koster-on-ultima-onlines-influence/)
- GDC Online 2012 talk by Vogel, Koster, Long promised lessons on "crazy dragons eating deer" — [GDC announcement](https://www.raphkoster.com/?p=4228)

### Inferences
- Loka offline: a shallow resource-needs ecology (supply regrowth per region, run only on loaded zones) avoids Koster's CPU problem. Cap player-visible hoarding and give each resource a regrowth rate.

### Gaps
- Skimmed "Did players destroy" page via summary; Garriott/Ars quote unverified.

## Famous incidents (Lord British) and the virtues

### Takeaway
Lord British died in the Aug 1997 beta stress test from a fire field cast by Rainz; the virtues were not directly implemented at launch.

### Cited Findings
- 9 Aug 1997 beta event: Rainz stole/found a fire field scroll via high stealing skill and cast it; invulnerability had not been re-enabled after a reset, guards despawned to cut lag; "hehe nice try" reply; Rainz not banned for the kill — [GameBanshee](http://www.gamebanshee.com/kuwhf); who flipped invulnerability: Starr Long called it human error, Garriott called it a bug [SNIPPET] — [Wikipedia: Lord British](https://en.wikipedia.org/wiki/Lord_British). Sources disagree on details (Village Voice names the avatar differently).
- Other anecdotes: portals hidden under bridges, corpse dismembering — [GameBanshee](http://www.gamebanshee.com/kuwhf)
- Virtues: 1998 Koster essay says UO "does not directly support the Virtues"; players express them anyway; Lord British, not the Avatar, as model — [essay2](https://raphkoster.com/gaming/essay2.shtml). Later activation of virtues over years (Honesty 2011, Humility and Spirituality 2015) [SNIPPET] — [UO Codex wiki](https://www.wiki.ultimacodex.com/wiki/Virtues_in_Ultima_Online)

### Gaps
- No Koster account of Lord British's death found; no Koster account of why virtues weren't done at launch.

## Koster's admitted mistakes (UO)

### Takeaway
He calls UO "a profoundly broken experience in many many ways".

### Cited Findings
- "many of the things that were tried in UO didn't work"; systems "broke under unforeseen player stresses"; "many were simply bad ideas"; team young (mid-twenties) — [Ultima Codex](https://ultimacodex.com/2017/10/raph-koster-on-ultima-onlines-influence/)
- Opposed Trammel switch yet admitted the userbase doubled — [Game Developer](https://www.gamedeveloper.com/design/a-brief-history-of-murder-in-ultima-online)
- Economy: closed loop, subsidy, wipe-level fix problems — [economy](https://www.raphkoster.com/games/snippets/the-evolution-of-uos-economy/)
- UO designed for ~250 concurrent, forecast ~30,000 lifetime units; 50,000 tester signups forced multi-server; client rewritten 1995-96; core team from late summer 1995; launched 26 Sep 1997 — [Did players destroy](https://www.raphkoster.com/?p=46439), [Making of UO](https://www.raphkoster.com/2012/02/17/making-of-uo-articles-at-mmorpg-com/)
- Ten Lessons Learned: "we were young and stupid and didn't realize we were building something impossible"; accept you lose control — [Ten Lessons](https://www.raphkoster.com/games/presentations/ten-lessons-learned-2/)
- His book Postmortems: Selected Essays Volume One (2018) collects UO essays (resource system, playerkilling, economy) — [MIT Press Bookstore](https://mitpressbookstore.mit.edu/book/9780996793742); not read.

### Gaps
- Massively OP 2018 interview returned 403; GDC 2012 UO postmortem video not retrieved.
