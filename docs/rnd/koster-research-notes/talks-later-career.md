# Raph Koster: later career (2005-2026), talks, ventures, admitted mistakes

Method note: ~35 tool calls. Several sources (massivelyop.com, pcgamer.com, raphkoster.com resource-system posts) returned 403 or truncated pages, so some claims rest on search-result summaries (marked "[search summary]") or on single secondary sources. Primary raphkoster.com text was read for: Still Logged In (talk post), Metaplace 2013 retrospective, "Game design is simple, actually" essay, Brief History of Murder (Game Developer excerpt), SWG auction-house post.

## 1. Talks and their lessons

### Takeaway
The best-documented talk is "Still Logged In" (GDC 2017): treat any persistent social space as a society you govern. Two others (Trust Spectrum, Practical Creativity) are confirmed to exist but I could not read their content. "Moore's Wrath" and "Game Design is Hard" were not found under those titles; the nearest is a "Moore's Wall" deck and a 2018 cost-of-games analysis.

### Cited Findings
- "Still Logged In: What Social VR and AR Can Learn From MMOs", GDC 2017 (3 Mar 2017); slides and video posted free. Koster said it was more somber than expected. — [raphkoster.com talk post](https://www.raphkoster.com/?p=30637) [search summary]; [commentary](https://www.raphkoster.com/2017/03)
- Lessons in Still Logged In (from the talk post): (1) you are designing a society, "I design places and worlds and societies, and not just games"; (2) operator is the government: plain-language code of conduct, "If you host an online community where people can cause harm to another person, you are on the hook"; (3) keep a rolling buffer of recent interactions so disputes can be adjudicated; (4) persistent identity so bans mean something; (5) "Block and mute have never been adequate enough tools"; (6) "Every feature you make should be looked at first as a weapon" and playtesters are not adversarial enough; (7) limit staff powers and log extraordinary commands (UO GM favor-trading cited); (8) assume virtual goods have real-world value (trade, theft); (9) plan for vulnerable users; (10) realism imports bias (e.g., XP penalty for short races); (11) small mostly-familiar groups, deliberately unrealistic avatars; (12) learn from text MUDs, "rendering is by far the least important part of this entire field"; (13) AR creates real-world consequences; (14) adopt a player rights declaration (2000 Declaration of the Rights of Players). — [talk post](https://www.raphkoster.com/?p=30637) (fetched summary; direct quotes as given by the fetch tool)
- Koster says many VR/AR developers "don't even think to look" at MMO history, "social media web people didn't look either." — [commentary](https://www.raphkoster.com/2017/03) (quoting New World Notes)
- "The Trust Spectrum", GDC 2018: framework built with a Google ATAP team led by Aaron Cammarata; described as "a practical design lens for designing multiplayer games, particularly ones involving co-operative play," based on psychology/sociology of human connection. The post excerpt cut off before the specific levels. — [raphkoster.com GDC18 page](https://www.raphkoster.com/2018/03). A Massively OP write-up says it aims to avoid making the best content depend on high-trust play such as elite raiding [search summary, unverified] — [search result](https://massivelyop.com/?p=250757)
- Other GDC 2018 sessions: AI Wish List panel (Koster wants AI/ML tools to help build living, interconnected worlds); "Ultima Online at 20" postmortem panel with Garriott, Starr Long, Rich Vogel. — [raphkoster.com GDC18 page](https://www.raphkoster.com/2018/03)
- "Practical Creativity", GDC Next, 3 Nov 2014: creativity as a trainable skill; science of creativity plus exercises; attendees leave with a game idea; toolset drawn from game design theory and psychology. — [raphkoster.com event page](https://www.raphkoster.com/event/gdcnext) [search summary]
- "Reinventing MMOs, a Metaplace antemortem", GDC 2008: MMOs cost too much (WoW-scale team and budget; monolithic servers rarely reused); thesis "Put worlds on the web, not the web in a virtual world." — [Engadget](https://www.engadget.com/2008-02-25-gdc08-raph-kosters-reinventing-mmos-a-metaplace-antemortem.html)
- Costs: a deck "Moore's Wall" (IBM Games On Demand, SOE era; PDF hosted 2026) says MMOs can cost up to ~3x AAA and need ~400 hours of content versus 8-12 for typical games; AAA budgets grew ~22x in 12 years. — [PDF](https://www.raphkoster.com/wp-content/uploads/2026/07/Moores-Wall-IBM-Games-On-Demand.pdf) [search summary only; the PDF text was unreadable to me]
- 2018 cost analysis (cost per megabyte, inflation adjusted): move away from "bytes" content toward community and systemic content; raise prices. — [GamesBrief, Jan 2018](https://www.gamesbrief.com/2018/01/raph-koster-on-the-cost-of-games-and-its-not-pretty/)
- June 2026 Massively OP discussion piece attributes to Koster: theme-park zones cost millions and go obsolete within months; costs rise ~10x per decade. Secondary, could not open. — [search result](https://massivelyop.com/2026/06/18/massively-overthinking-is-the-era-of-the-themepark-mmorpg-over/)
- "Game design is simple, actually" (3 Nov 2025): twelve-step essay. Fun is "making progress on prediction"; games are problems (constraints plus goal); operational loops and progression spirals; feedback must show "what you can do, that you did it, what difference it made, and whether it helped"; vary and escalate situations; games are made of nested loops; know your audience's motivations. — [raphkoster.com](https://www.raphkoster.com/2025/11/03/game-design-is-simple-actually/)
- Community-management specific talk: none found beyond Still Logged In.

### Inferences
- For Loka: Still Logged In is a ready checklist for the future shared Realm (identity, conduct code, logging, abuse-first feature review, staff-power logging, real value of items). The offline phase can skip most, but design item/trade data so these can be added.
- Cost thesis supports Loka's text format: systemic content over authored "bytes".

### Gaps
- No text found for "Moore's Wrath" or "Game Design is Hard" (possibly mis-remembered titles; "Moore's Wall" is the closest).
- Trust Spectrum's actual levels and takeaways not retrieved; GDC Vault not accessible.
- Practical Creativity techniques not retrieved.

## 2. Metaplace (2006-2010), Playdom and Disney

### Takeaway
Metaplace was a web-based, user-built virtual world platform that closed 1 Jan 2010. Koster's own diagnosis (2013): too many things for too many people, 2D look, building too hard, almost no marketing.

### Cited Findings
- Platform: generic cloud server architecture, user-owned spaces, Lua scripting, SketchUp import, web and mobile clients, linked worlds with portable identity; open 2007-2009, "tens of thousands" of worlds. — [raphkoster.com 2013/08](https://raphkoster.com/2013/08). Hypergrid Business says ~70,000 worlds (different figure) — [Hypergrid Business](https://www.hypergridbusiness.com/2009/12/metaplace-closing-a-warning-for-virtual-worlds-users/)
- Failure reasons (Koster): "we were too many things to too many different people"; users put off by 2D graphics and lack of a full MMO; building too hard; drag-and-drop behavior tools "probably didn't go far enough"; "got almost no marketing"; people "perpetually confused as to what it was." — [raphkoster.com 2013/08](https://raphkoster.com/2013/08)
- Shutdown announced 21 Dec 2009, offline 1 Jan 2010; company said consumer UGC "not gaining enough traction." Users had days to recover work. — [Hypergrid Business](https://www.hypergridbusiness.com/2009/12/metaplace-closing-a-warning-for-virtual-worlds-users/); [Eurogamer interview page](https://www.raphkoster.com/?p=17844)
- Koster said he stepped down as CEO when it shut down and the shutdown pace was no longer his call; pushed for data export. Source is an archived email, unverified — [Archive Team](https://wiki.archiveteam.org/index.php/Koster_Horseshit) [search summary]
- After closure Metaplace pivoted to social games (Island Life, My Vineyard), was acquired by Playdom in 2010, Playdom then bought by Disney; Koster was VP Creative Design, creative director of Deep Realms; left April 2013; then independent designer/consultant and advisor before founding Playable Worlds (2018). — [raphkoster.com About](https://www.raphkoster.com/?p=13896) [search summary]
- Book contains a Metaplace postmortem on "why it didn't work." — [Postmortems page](https://www.raphkoster.com/games/books/postmortems/)

### Inferences
- Lesson for Loka: a UGC/authoring platform needs one audience and easy behavior authoring; user content needs export and ownership guarantees (relevant to offline-first saves and a later Realm).

### Gaps
- Funding amounts, Disney-era design lessons and Playdom details not found. Koster's full Metaplace postmortem text not read.

## 3. Playable Worlds and Stars Reach (2018-2026)

### Takeaway
Stars Reach is a simulation-heavy, shardless, SWG-descended sandbox. It entered paid Steam Early Access 18 Aug 2026 after a 2025 Kickstarter, amid layoffs and mixed reviews.

### Cited Findings
- Founded 2018 by Koster and Eric Goldberg; $2.7M seed led by Bitkraft (article dated Oct 2019). Goals: support many playstyles, solo play, cloud architecture, simulation and AI for living worlds; "we're not out to build a museum to old gameplay." — [Playable Worlds](https://www.playableworlds.com/the-award-winning-designer-behind-ultima-online-and-star-wars-galaxies-says-its-time-for-his-dream-to-be-fulfilled/)
- Funding: ~$38M raised over five years as of Jan 2025 (Massively OP via search summary, [link](https://massivelyop.com/2025/01/11/raph-kosters-stars-reach-mmorpg-is-launching-a-kickstarter-in-february/)); Game File cites $45M (Aug 2026, paywalled) — [Game File](https://www.gamefile.news/p/stars-reach-interview-raph-koster-dirt-clouds-bunnies). Conflict not resolved; Kakao Games reportedly led a $25M round [search summary].
- Kickstarter: 25 Feb to 26 Mar 2025, $200K goal, funded in under an hour, ~$740K from ~5,200 backers per Kicktraq; press said over $750K. — [Kicktraq](https://www.kicktraq.com/projects/starsreach/stars-reach/); [MMORPG.gg](https://mmorpg.gg/stars-reach-fully-funds-in-less-than-an-hour-on-kickstarter-new-mmorpg-from-raph-koster/)
- Koster on Kickstarter: needed "market validation" for investors; rewards cosmetic, "you don't want to be selling advantage"; do not start a project on Kickstarter, finish most of the game first; "You can't build [a community] on the fly." — [Unity blog](https://unity.com/blog/raph-koster-playable-worlds-stars-reach-kickstarter)
- Status timeline: layoffs reported (headline Feb 2026; a similarly titled item may date to mid-2025, unclear) — [Massively OP, 15 Feb 2026](https://massivelyop.com/2026/02/15/mmo-week-in-review-still-not-to-rock-bottom/); paid Early Access announced 30 Jul 2026 — [Massively OP](https://massivelyop.com/2026/07/30/raph-kosters-mmorpg-stars-reach-officially-announces-paid-early-access-is-coming-august-18/); final pre-EA update 5 Aug 2026 (UI, crafting window, recipe book, cooking, loot tiers) — [Massively OP](https://massivelyop.com/2026/08/05/stars-reach-is-releasing-its-final-pre-early-access-update-to-overhaul-crafting-weapons-and-the-ui/); EA launch 18 Aug 2026 on Steam at $30/$50/$80 tiers — [Game Developer press release](https://www.gamedeveloper.com/press-release/sci-fi-mmorpg-stars-reach-launches-into-early-access-august-18); 27 Aug patch (stability, movement speed, craftable vendors) — [Massively OP](https://massivelyop.com/2026/08/27/stars-reachs-latest-early-access-patch-buffs-character-speed-and-adds-craftable-player-vendors/); 14 Sep hotfix (crafting, recipes, housing storage, public events) — [Massively OP](https://massivelyop.com/2026/09/14/stars-reach-continues-its-hotfixing-for-crafting-recipes-storage-and-public-events/). Latest item I found: 14 Sep 2026. Free-to-play at 1.0 "next year" is from one outlet [search summary]. Low player counts and "mixed" Steam reviews per a Massively OP Aug 2026 comment [search summary], unverified.
- Design pillars (official): reshape terrain/tunnel/terraform; "the best gear is crafted"; 40+ SWG-style professions each with skill tree, combinable; player cities and claimable planets; player governments; galactic trade driven by player professions. — [starsreach.com](https://www.starsreach.com) (fetched summary)
- Simulation: cellular automata, each cubic meter tracks humidity, temperature, structural integrity; water as many small agents — [Massively OP 2024](https://massivelyop.com/2024/06/28/raph-kosters-new-mmorpg-is-called-stars-reach-and-yes-its-basically-star-wars-galaxies-2/) [search summary]; ~200 material types, soil pH can cause cave-ins, lava cools, "chronophaser" ages rock — [Game File](https://www.gamefile.news/p/stars-reach-interview-raph-koster-dirt-clouds-bunnies); premise "if we simulate more, it creates fresh, novel gameplay and allows player creativity," wiki/strategy-guide resistant — [PCGamesN](https://www.pcgamesn.com/stars-reach/raph-koster-interview-wiki-resistant). Planets mix hand-made topography templates with parameters (MeinMMO) [search summary].
- 80.lv interview: skill tracks each with own XP and tree, "sampling platter" start, "There isn't any such thing as balancing a chef against a rifleman"; nature conservancy is the most active guild (repairs ecosystem); "running a big city should carry with it a lot more costs than just having a house"; "scale should increase risk of collapse"; "Getting big should increase your overhead"; SWG problem of "very successful players essentially locking up markets"; political systems partly in; forests regrow, tunneling leaves tailings. — [80.lv](https://80.lv/articles/interview-mmo-pioneer-raph-koster-on-stars-reach-and-the-future-of-sandbox-game-design)
- Economy is not intervened in; compared to Old School RuneScape — [PCGamesN](https://www.pcgamesn.com/stars-reach/raph-koster-interview-wiki-resistant)

### Inferences
- Stars Reach is a direct revisit of SWG (professions, crafting, player towns) plus UO's simulated world, with explicit fixes: anti-monopoly overhead scaling, cosmetic-only monetization, wiki resistance.
- Resource/ecology numbers: Loka can borrow "scale raises cost" for towns and housing.

### Gaps
- Exact Kickstarter final (conflict $740K vs "over $750K"). Current (Oct 2026) population, reviews and layoffs size not verified. Crafting system details (quality, resource model) not found beyond headlines. Massively OP pages were blocked, so several status points rest on search summaries.

## 4. Postmortems: Selected Essays Volume One (2018)

### Takeaway
A ~700-page first volume of a planned three, Altered Tuning Press, foreword by Richard Garriott, collecting postmortems plus new essays on MUDs, UO, SWG, Andean Bird and Metaplace.

### Cited Findings
- Seven parts: Early Days; MUDs; Ultima Online (resource system, player killing, economy model evolution, "A Story About a Tree"); Star Wars Galaxies (postmortem series, design overview, new NGE piece, "A Jedi Saga"); Transitions; Andean Bird ("Influences" speech); Metaplace (architecture, postmortem, social games). "Not a memoir or tell-all." — [raphkoster.com](https://www.raphkoster.com/games/books/postmortems/)
- 702 pages, ISBN 9780996793742, $59.99 paperback, 2018 — [Video Game Library](https://www.thevideogamelibrary.org/book/postmortems-selected-essays-vol-1) [search summary]

### Gaps
- Book text itself not read; only excerpts.

## 5. Admitted mistakes and lessons

### Takeaway
Koster has put on record: the Jedi design and Holocrons, UO's failed player self-policing and ecology, SWG's auction house hollowing out merchants, and a launch pressed by marketing and crunch.

### Cited Findings
- Jedi/Holocrons: Jedi were meant to be rare and unpredictable; LucasArts marketing wanted a Jedi by Christmas so holocrons revealed the next skill; once three people had a hint the secret spread; "After Holocrons, the game was dead; it was just that nobody knew it yet"; later patches including CU and NGE were attempts to recover; Jedi became a checklist for grinders ("The genie was out of the bottle"). — [SiliconANGLE, Apr 2015](https://siliconangle.com/2015/04/20/how-the-desire-for-jedi-killed-star-wars-galaxies/) (fetched)
- Launch/crunch: planned Jedi unlock system cut; replacement was "a very fateful decision made at the end of a 14- or 16-hour crunch day" (GDC 2021 postmortem). — [PC Gamer](https://www.pcgamer.com/au/star-wars-galaxies-devs-discuss-why-it-died) [search summary; article body not readable]
- NGE: he disputes that NGE alone killed SWG, pointing to earlier decisions; fan-wiki claim that he said NGE should not have been done as it was is unverified — [All the Tropes](https://allthetropes.fandom.com/wiki/Star_Wars_Galaxies/YMMV) [search summary, weak]
- SWG economy: server-wide auction house (added after WoW) created a "perfect information economy" and "When the merchant changes went in to SWG, the merchants went out"; "every inconvenience is potentially someone's game"; also admits local shops were inconvenient. Original economy: random finite resources, shop vendors, about half of players ran a shop at peak. — [raphkoster.com](https://www.raphkoster.com/?p=4080). Market lock-up by dominant players — [80.lv](https://80.lv/articles/interview-mmo-pioneer-raph-koster-on-stars-reach-and-the-future-of-sandbox-game-design)
- UO PK: "one of the biggest issues was simply that people would do things, lose notoriety, and not know why"; "In the name of player freedoms, I had put them through a slow-drip torture of two years of experiments"; bounty system gamed with alts and moved valuables; reputation system made towns less safe; on Trammel "I wouldn't have done it, personally," though the user base grew, emergent stories were lost and the player economy collapsed once goods were safe; "the dream of letting players police themselves was over." — [Game Developer](https://www.gamedeveloper.com/design/a-brief-history-of-murder-in-ultima-online) (fetched)
- UO ecology: predator-prey food chain (sheep/deer near villages, wolves/dragons further out) failed because players killed prey and predators faster than it rebalanced; simulation features removed because players "didn't behave as expected." Source is a 2004 blog's secondhand account, which does not name Koster — [James Tauber](https://jtauber.com/blog/2004/03/13/free_markets_and_ecosystem_simulation/). Koster's own series: [UO Resource System](https://www.raphkoster.com/2006/06/03) (not read in full)
- Community/live ops: UO GMs trading favors for items is cited as why staff powers must be limited and logged; players using virtual spaces for emotional support needs crisis processes. — [Still Logged In post](https://www.raphkoster.com/?p=30637)
- Metaplace: see section 2 (focus, marketing, authoring difficulty).
- Live-ops in Stars Reach: community needs to exist before launch/Kickstarter — [Unity blog](https://unity.com/blog/raph-koster-playable-worlds-stars-reach-kickstarter)

### Inferences
- Pattern: Koster's repeated lesson is that players will find and exploit any hidden or optimizable system, and that convenience features (auction house, safe zones) can erase the emergent play the world was built around. Fixes tend to cost something.
- Loka checklist items: no secret-progression gates that can be datamined; do not ship a global market early; model resource regrowth against the fastest harvest rate; test with adversarial players; keep marketing deadlines from setting design scope.

### Gaps
- Direct quotes on NGE, launch scope, and community management from Koster not retrieved. "A Jedi Saga" original post and GDC 2021 transcript not read.

## 6. Views on AI, procedural content and UGC

### Takeaway
No written Koster position on generative AI was found. Evidence: he uses "AI" for simulation agents, wanted ML tools for living worlds (2018), and discussed AI in a July 2026 podcast.

### Cited Findings
- 2018 panel: wants AI/ML tools that help build living, interconnected worlds. — [raphkoster.com GDC18](https://www.raphkoster.com/2018/03)
- Cellular automata described as "a large number of simple AIs"; 217 million critters in one demo segment. — [PCGamesN](https://www.pcgamesn.com/stars-reach/raph-koster-interview-wiki-resistant)
- Playable Worlds said it uses cloud compute for "generating content on the fly" and "more sophisticated AI for world simulation." — [80.lv](https://80.lv/articles/interview-mmo-pioneer-raph-koster-on-stars-reach-and-the-future-of-sandbox-game-design)
- re:Play with Greg Off, "The Puddle, the Splat, and the Droplets" (21 Jul 2026): description says he explains where AI helps game development and where it falls short; also procedural generation, player agency, emergent gameplay. No transcript found. — [Audible](https://www.audible.de/pd/B0H9SP1HRR)
- UGC: Still Logged In says UGC "tends to produce offensive results quickly"; Metaplace history is his UGC experience (section 2). Stars Reach "any object can act" and objects stream from server. — [talk post](https://www.raphkoster.com/?p=30637); [80.lv](https://80.lv/articles/interview-mmo-pioneer-raph-koster-on-stars-reach-and-the-future-of-sandbox-game-design)

### Inferences
- His emphasis is on simulation and systemic emergence, not generative AI content; I found no evidence Stars Reach uses generative AI in production (search tool's own conclusion).

### Gaps
- His stance on LLM/generative AI for content is not documented in anything I could read; worth listening to the July 2026 podcast.
