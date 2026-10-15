# Raph Koster's design theory and principles (for the Loka design checklist)

Method note: pages were read through a summarizing fetch tool, so quotes are as relayed by that tool and are short. Where only secondary sources were reachable, this is marked. Verify any quote you plan to publish against the original.

## A Theory of Fun for Game Design

### Takeaway
Koster defines "fun" narrowly as the brain's reward for learning patterns (mastering a problem mentally). Games become boring when the patterns are mastered ("grokked"), or are frustrating when too hard. I could not retrieve the book text or the 10-year slides, so the detail below comes from Koster's blog plus secondary summaries.

### Cited Findings
- Koster's own definition: fun is "the positive feedback given by the brain for cognitive learning." He calls this narrow sense "kfun" and admits it departs from everyday usage. — [Koster, "Sorts of fun, sorts of kfun?" (2005)](https://www.raphkoster.com/2005/11/01/sorts-of-fun-sorts-of-kfun/)
- Koster says aesthetic delight ("primarily an act of recognition"), visceral reactions, and social status maneuvers are not core fun; they can accompany it (fiero and schadenfreude are distinct from fun). He also writes "kfun lurks everywhere." — same source
- Short form widely quoted: fun is "the act of mastering a problem mentally." — secondary: [Game Studies Wiki chapter notes](https://game-studies.fandom.com/wiki/A_Theory_of_Fun_for_Game_Design?oldid=4074) (via search snippet; page itself returned HTTP 402 when fetched, so unverified)
- Grokking: top level of understanding, akin to muscle memory; the brain "chunks" information and automates it to free conscious thought. — secondary: same wiki (snippet); [Goodreads/review summaries](https://www.goodreads.com/book/show/18182) (snippet only)
- Boredom: once the patterns are mastered the challenge turns trivial; richer games with more variables last longer than tic-tac-toe. Koster reportedly also gets bored when games are too easy or too hard. — secondary, same wiki snippet. Treat the tic-tac-toe wording as paraphrase; I found no verbatim Koster quote.
- Games are "exceptionally tasty patterns to eat up" (one reviewer's quote, page 14). — secondary: [search summaries](https://www.goodreads.com/book/show/18182)
- Games teach by being models of reality: his follow-up book pitch says games "are broken down and revealed as models of reality." — [Koster, Grammar of Gameplay announcement](https://www.raphkoster.com/?p=487)
- Anything with rules, consequences and achievable mastery is a game: "something with rules, where your actions have consequences, and you can achieve some kind of mastery." — note-taker's paraphrase of Koster: [Raemon's notes on Koster](https://www.greaterwrong.com/posts/uicb62iovv6HC5g7E/raph-koster-on-virtual-worlds-vs-games-notes)
- Critique: Ian Bogost and others object to making fun the main purpose of games. — secondary: search summary of [Game Studies Wiki](https://game-studies.fandom.com/wiki/A_Theory_of_Fun_for_Game_Design?oldid=4074)
- 10-year retrospective exists as slides and GDC Vault video. I could not read either. — [Koster page](https://www.raphkoster.com/games/presentations/a-theory-of-fun-10-years-later/), [GDC Vault](https://www.gdcvault.com/play/1016632/A-Theory-of-Fun-10)

### Inferences
- Checklist items for Loka: every system should present a learnable pattern with a readable feedback loop; ask "what does the player learn, and when is it fully learned?" Crafting recipes, skill trees and market prices are patterns that will be grokked and then go stale unless depth or variation arrives.
- Offline, single-player Loka needs mastery runway (new variables over time), not just more content.
- Narrow definition means "fun" is not the only target; status, beauty and social payoffs need separate design (his own distinction).

### Gaps
- No primary-text quotes on grokking, chunking, "what games teach" (e.g. his argument that games teach through abstraction and that "boring" is the mind's signal of mastery), or the 2013 edition's added material. The book is not freely online; get the book itself or the 10-year slides PDF (fetch failed: file over size limit).

## Laws of Online World Design

### Takeaway
A collection of aphorisms from the MUD-Dev community, only some by Koster. The strongest themes: players form a community that is the real product, economies are hard and need constant drains, violence and abuse are inevitable, never trust the client, and persistence means a permanent commitment.

### Cited Findings
- Origin: Koster collected aphorisms from the MUD-Dev list after J. C. Lawrence's suggestion; "some of the laws are indeed my own" but most attribution is lost. — [Laws intro](https://www.raphkoster.com/games/laws-of-online-world-design/)
- "Koster's Law": "The quality of roleplaying is inversely proportional to the number of people playing." Name coined by Mike Sellers, and Koster says he did not coin it. Counter-observation (Hyrup): "The higher the fee, the better the roleplayers." — [Laws list](https://www.raphkoster.com/games/laws-of-online-world-design/the-laws-of-online-world-design/); attribution in [intro](https://www.raphkoster.com/games/laws-of-online-world-design/)
- Koster's Theorem: "Virtual social bonds evolve from the fictional towards real social bonds." Good ties move out of the game. — [Laws list](https://www.raphkoster.com/games/laws-of-online-world-design/the-laws-of-online-world-design/)
- Community size: "Ideal community size is no larger than 250"; beyond that subcommunities form. Baron's Theorem: "Hate is good" (conflict forges bonds). Elmqvist's Law: players find it more rewarding to save the world together. Hanarra: new players are the best critics. — same
- Economy: online economies are hard; without ongoing expenditures you get "Monty Haul syndrome"; "players will expect all labor to result in profit"; give players a sense of ownership. — same
- PK: "It is always more rewarding to kill other players than to kill whatever the game sets up as a target." Violence is inevitable. Mike Sellers' hypothesis: deep worlds that don't meet human conflict needs see excessive bullying/PKing. — same
- Persistence: "expect to keep your team on it indefinitely." — same
- Client: "The client is in the hands of the enemy." Also Hyrup: "If something can be abused, it will be." Lambert: larger action pools give more exploit opportunities. Darklock: cheating is an apparently advantageous violation of player assumptions. — same
- Bartle: the laws page names Bartle only as a contributor (co-creator of the first MUD), not a law. His four types (Achievers, Socializers, Explorers, Killers) appear on the companion "Rules" page as something to cater to, or the game stagnates. These are Bartle's, not Koster's. — [Rules page](https://www.raphkoster.com/games/laws-of-online-world-design/the-rules-of-online-world-design/)
- Rules page (GDC roundtable notes; contributors mixed): "It's a service, it's a world, it's a community"; "keep a team on this forever"; static content gets published within days; "Depth is the key to an online game's success"; housing/land and unique identity create ownership and raise the cost of leaving; "expressive fertility" is J. C. Lawrence's; Schubert Triangle (simulation, gameplay, community) is Damion Schubert's. — [Rules page](https://www.raphkoster.com/games/laws-of-online-world-design/the-rules-of-online-world-design/)
- Fetch-tool caveat: the "community is the content" phrase did not appear in the pages I read. Do not attribute it to the Laws without checking.

### Inferences
- Loka checklist: (1) every income source needs a matching sink, designed up front; (2) players treat labor as entitled to profit, so crafting must never lose money for a competent player; (3) housing and named identity are retention levers; (4) Realm server must be authoritative, so offline-first client state needs reconciliation rules before the shared Realm; (5) anything static in content will be spoiled, so favor systemic variety; (6) plan staffing for live operation of the Realm.
- Koster's Theorem suggests designing for friends bringing their own relationships, not forcing in-fiction bonds.

### Gaps
- Per-law numbering/attribution is lost by Koster's own admission. I did not read every law (the page was summarized, not dumped).

## Economies, sinks and faucets

### Takeaway
Koster frames MMO money as faucet-drain: currency is minted by the game and deleted by sinks; stats must be watched continuously. Players expect labor to pay, and realism can hurt fun.

### Cited Findings
- SWG report (Apr 30, 2004): money entering is "minted" by the game; "the vast majority of the money coming in enters the system via missions"; loot is a distant second; "The sink is basically the whole game"; drains delete money; wealth is Pareto-distributed (top players are billionaires). — [Koster, Astromech Stats: Economy Stats](https://www.raphkoster.com/games/essays/astromech-stats-economy-stats/)
- Overinflated economies make the game "more boring" because players have more than they should afford. — secondary search snippet of the same report: [source](https://www.raphkoster.com/?p=25954)
- UO lessons: "we actually had to take OUT realistic economy sim aspects because they weren't fun"; "Every tiny change sent massive tremors though the entire game"; "labor implies profit!"; NPC shopkeepers were being taken out of the loop for a player-driven economy; main concern is newbie access to starter goods. — [Koster, UO economy page](https://raphkoster.com/gaming/economy.shtml)
- Mudflation controls (item decay, deletion, tracking every drain against influx). — secondary only: [Boing Boing 2007](https://boingboing.net/2007/01/19/mudflation-inflation.html/amp); I did not read Koster's original post.
- Trade as mutual-benefit process; games handle it poorly because bounded designed systems rarely allow unanticipated standard-of-living gains. — Koster's blog comments: [GDCO social mechanics post](https://www.raphkoster.com/?p=3649)

### Inferences
- Loka: per-profession ledger of faucets and sinks; repair, decay, taxes, housing upkeep as sinks; guarantee newbie access to base goods; cap wealth concentration; log economy stats from day one. Offline mode can use NPC prices; the Realm should shift to player prices gradually (UO pattern).

### Gaps
- No Koster text titled "sinks and faucets" with that exact phrasing; he uses "faucet/drain." His 2007 mudflation post was not retrieved. The 2010 economics content inside the social mechanics deck covers rival goods only.

## Declaring the Rights of Players (avatars)

### Takeaway
A 2000 hypothetical "Declaration of the Rights of Avatars," modelled on the French 1789 declaration, arguing that those holding power over virtual spaces owe players due process, property protection and privacy.

### Cited Findings
- Dated Jan 26, 2000; published Aug 27, 2000; reprinted in 2006 in *The State of Play*; Metaplace ToS (2008) said it was modelled on it. — [Koster essay](https://www.raphkoster.com/?p=16044); [search summary](https://www.raphkoster.com/?p=16044)
- Preamble: "Avatars are the manifestation of actual people in an online medium." The 19 articles (paraphrased by fetch tool) include: published code of conduct before punishment, proportional penalties, presumption of innocence, no punishment for opinions, enforcers' powers revocable, fees must be known in advance and paying grants no special rights, data integrity and persistence protected as property, privacy against snooping, and a community has "no constitution at all" without universal code observance and separated powers. — [essay](https://www.raphkoster.com/?p=16044)
- Koster's own framing: "It's a hypothetical exercise." — same

### Inferences
- Loka: publish a code of conduct and sanction ladder before launching the Realm; write a save-data and property guarantee (important with housing and crafted items); define what staff can see in chats.

### Gaps
- Exact article wording not reproduced (tool paraphrased). Original URL also at raphkoster.com/gaming/playerrights.shtml (not fetched).

## Social mechanics (GDC Online 2010 "Classic Social Mechanics"; GDC 2011 "Social Mechanics for Social Games")

### Takeaway
Koster catalogues about 40 multiplayer mechanics, built up from the single-player core (helping, status, races) through opposition, rival goods, deception, roles and rituals to network and societal structures.

### Cited Findings
- Title caveat: the 2010 talk is "Social Mechanics: The Engines Behind Everything Multiplayer" (GDCO). A revised version was given at the 2011 Social and Online Games Summit, reportedly titled "Social Mechanics for Social Games." — [Koster post](https://www.raphkoster.com/?p=3649); [search results](https://raphkoster.com/2011/page/11). Not fully verified.
- Slides (162 pages): [socialmechanics.pdf](https://www.raphkoster.com/gaming/gdco2010/socialmechanics.pdf)
- Mechanic ladder: helping; status; races; leaderboards; tournaments; rival vs non-rival goods; flower-picking (non-zero-sum) vs dot-eating (zero-sum); tug of war; handicapping; secrets (imperfect information as a rival good); booing; deception and bluffing; prisoner's dilemma; gamemaster pattern; roles; hot potato; rituals ("Olly Olly Oxen Free", "gg" marking state transitions). — same slides
- Single player defined: "A game that is not played in opposition to, or in parallel with, or collaboratively with, someone else. (In other words, hardly anything.)" — same slides
- Persistent competitive arenas: "lead to the average player being a loser" (dice power-law demo). Hubs in scale-free networks are efficient but a collapse occurs if hubs are removed (cites SWG and Pirates of the Burning Sea). — same slides
- Social structure: trust up close is non-transitive; "faith at a distance" is a social contract; MMOs develop stronger social structure than social games because of shared economic participation. Public goods and commons dilemmas are a "ultimate political game." — same slides
- Gifts and wall posts in social games vs MMO retention is a stated use case. — [post](https://www.raphkoster.com/?p=3649)

### Inferences
- Loka: use non-rival gathering (flower-picking) for shared resources to avoid griefing; offer rituals (guild-level-ups, crafted-item ceremonies) and low-friction helping early; avoid long power-law competitive ladders.
- Many mechanics are cheap in text/MUD form (gifts, helping, rituals, secrets).

### Gaps
- I only read the first half in detail via text extraction; the 40-mechanic list is not fully enumerated here.

## Narrative versus systems, authored versus emergent story

### Takeaway
Koster says narrative is feedback, not a mechanic; authored story is costly and consumed. Systems should carry play.

### Cited Findings
- "Narrative in a game is not a mechanic. It's a form of a feedback." "The game is in figuring out what the rules are for the black box." Narrative content is "destined to be expensive, short, and over." "If the systems of your game are outweighed by the feedback, you should grow suspicious." — [Koster, Narrative is not a game mechanic (Jan 2012)](https://www.raphkoster.com/2012/01/20/narrative-is-not-a-game-mechanic/)
- Emergent story is not addressed in the post; it surfaces in comments only. Same source (fetch read only the first 100k of 120k characters).
- Counterpoint: PopMatters argues he treats narrative as static information. — [PopMatters](https://popmatters.com/153895-narrative-is-a-game-mechanic-2495891347.html) (snippet only)
- UO NPCs became quest dispensers, which he "fought for a long time." — Raemon's notes, [secondary](https://www.greaterwrong.com/posts/uicb62iovv6HC5g7E/raph-koster-on-virtual-worlds-vs-games-notes)

### Inferences
- A text engine is narrative-heavy by default, so Loka should budget authored text as a consumable and pay for it with systems that regenerate content (professions, economy, towns).

### Gaps
- No Koster text found stating "emergent story" as a design policy; infer from UO/SWG world-first approach only.

## Trust spectrum

### Takeaway
A co-op design lens with five rungs from no trust to intimate, built with Google ATAP and Aaron Cammarata.

### Cited Findings
- Rungs: no trust, low trust, medium, high, truly intimate; axes include parallelism, asymmetry, resource pools, risk, agency, information, success metrics, exchange, time pressure. "Low trust is simply more accessible." Avoid a "broken line" with nothing between low and high trust; don't force intimacy; watch the "quarterback problem." — [Koster, The Trust Spectrum](https://www.raphkoster.com/?p=32038)
- Virtually all games are played at all levels of the spectrum (via press coverage; page 403 on fetch). — [MassivelyOP](https://massivelyop.com/?p=158956) (search snippet only)

### Inferences
- Loka: stage Realm interactions on a ladder: shared market (no trust), gifts and guild chat (low), party crafts (medium), shared housing or caravans (high).

### Gaps
- Post date not extracted; second part of the page (37k characters) unread.

## Game grammar and ludemes

### Takeaway
Koster models games as atoms (mechanics/"verbs") that combine by grammar, separate from content, metaphor and narrative.

### Cited Findings
- Book pitch: split games into mechanics, content, metaphor, narrative; "atomic theory of game design"; verbs, choices, skill, feedback, cost of failure. — [Koster announcement](https://www.raphkoster.com/?p=487)
- 2005 GDC slides: ludeme credited to Ben Cousins; "chess pieces aren't content, they are verbs." Sources disagree on who coined "ludeme." — [slides](https://www.raphkoster.com/gaming/atof/grammarofgameplay.pdf) (via search summary); [search results](https://www.raphkoster.com/wp-content/uploads/2026/07/A-Grammar-of-Gameplay.pdf)
- Layering mechanics produces new games (his tag example in the social deck). — [slides](https://www.raphkoster.com/gaming/gdco2010/socialmechanics.pdf)

### Inferences
- Loka: keep a verb inventory per profession; treat recipes and items as content, verbs as the system; check cost of failure per verb.

### Gaps
- "Game Design is Hard" talk not located. The grammar PDF was not read directly.

## Single-player versus multiplayer, and persistence

### Takeaway
Koster blurs the line (nearly nothing is truly single-player) and treats persistent worlds as living services with permanent obligations.

### Cited Findings
- See the single-player definition in the social mechanics slides above — [slides](https://www.raphkoster.com/gaming/gdco2010/socialmechanics.pdf); in a comment he frames single-player as the absence of multiplayer. — [post](https://www.raphkoster.com/?p=3649)
- Persistence: UO objects stayed on the ground, monsters interacted, and housing eventually caused a land crisis; he built tools so players police PK themselves and treated "running to daddy" (calling admins) as failure. — [Raemon's notes](https://www.greaterwrong.com/posts/uicb62iovv6HC5g7E/raph-koster-on-virtual-worlds-vs-games-notes) (secondary)
- "keep a team on this forever"; shutting down costs player trust. — [Rules page](https://www.raphkoster.com/games/laws-of-online-world-design/the-rules-of-online-world-design/)

### Inferences
- Loka can be single-player first and still design social hooks (helping, leaderboards, gifts) in offline mode. A Realm brings finite-land housing pressure, so decide land supply and upkeep early.

### Gaps
- No Koster essay found arguing single versus multiplayer directly beyond the above.
