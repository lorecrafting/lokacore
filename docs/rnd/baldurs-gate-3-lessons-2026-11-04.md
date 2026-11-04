# Baldur's Gate 3: what worked, and what Loka can take (2026-11-04)

Research note. Not canon. Sources are listed at the end. A claim marked **(inferred)** is my reading, not something a source says. A source marked **(headline only)** is one where the page body could not be read, so only its headline is cited.

Prior notes already cover some of this ground, so this note does not repeat them: failing forward in the Disco Elysium style, and quietly tracked behaviour in the Ultima IV style (`docs/rnd/rpg-and-mud-design-breakthroughs-2026-11-03.md`). This note adds only what BG3 contributes on top.

## Summary

BG3 worked because Larian played "weird Dungeon Masters" who expect the player to try anything: the game remembers what you did and says so later, a fallback ("n+1") routes the key item or plot back to you so no choice breaks the main story, every rule is meant to hold everywhere ("If it's not systemic, it doesn't go in"), and the visible d20 makes risk part of the fun. The cost was huge (about 2 million words, a spreadsheet of ending paths that "just keep scrolling", one quest replayed 18 times to test), and the weak spots are the ones that scale with content: a dense, slow Act 3, endings that needed patches, inventory and class rules that overwhelmed players, and camp scenes that could be missed without warning. For a solo writer the cheap mechanisms are worth copying, not the scale, and Loka already has the engine for nearly all of them; the cost is mostly the owner's lines.

Cost key: **Engine** S (content only, or a tiny change), M (a new field or reader), L (a new system). **Writing** is a rough count of player-facing lines or text keys the owner must write.

---

## What really worked

### 1. Reactivity: the game remembers, and says so

**Evidence**
- Vincke at BAFTA: the team approached design as "weird Dungeon Masters". He also said: "The players are going to find everything and we just have to anticipate what all these players want to do." ([PC Gamer via Yahoo](https://malaysia.news.yahoo.com/larian-gave-baldurs-gate-3-022539159.html))
- Lead writer Chrystal Ding said ending paths lived in a spreadsheet where "you just keep scrolling and scrolling and scrolling", and that testing them "takes a small army". (same source)
- Writing director Adam Smith said the player's path is the canonical story; there is no single correct way to play. (same source)
- Smith on cost: "just to test every branch of this story, I needed to play the game 18 times." He also said: "You can't get it all in one playthrough." ([Game Rant](https://gamerant.com/baldurs-gate-3-interview/))
- The "17,000 endings" are variations, not unique endings. Ding: "it's not 17,000 different unique endings." Small differences come from earlier choices, such as which key NPCs died ([Wccftech](https://wccftech.com/baldurs-gate-3-writer-clarifies-17000-endings-claim/), [Shacknews](https://www.shacknews.com/article/136296/baldurs-gate-3-ending-17000-variations)). The script is reported at about 2 million words, with over 170 hours of cinematics. These are pre-release figures.
- Vincke: "I want to make sure that we keep on investing heavily in things that maybe 0.001% of the audience will see." ([Game World Observer](https://gameworldobserver.com/2023/09/06/swen-vincke-dnd-interview-badlurs-gate-3-player-empathy))
- Player data shows that minority paths get played. In the launch-era stats, 34.9% of players attacked the Grove with the goblins ([PC Gamer](https://www.pcgamer.com/i-cant-believe-35-of-baldurs-gate-3-players-already-took-the-evil-route/)). During Early Access, Larian said it watched what players did and might change plot twists that few players chose ([TheGamer](https://www.thegamer.com/baldurs-gate-3-launch-changes/)).

**Why it lands (inferred).** Players feel the reactivity through small acknowledgements: a line, a changed greeting, a remark in the ending. A whole new branch is rarely what they notice. Most of the "17,000" is exactly that kind of small variation.

**For Loka:**
- **Callback lines on individual acts (the D9 village-consequences pattern).** NPCs read a committed fact and give a distinct line. Apply this to acts, not to the overall leaning: Kira noticing whether you carried Dov's fruit back (the outline already pays the fruit at 22, 38, 42 and 47), whether you kept the trowel, what you told Maren about your dream. One or two later NPCs each say one line.
  - Engine S: dialogue `narration_variants`, W6 entity description variants, `fact_compare`.
  - Writing: about 2 lines per act, so about 8–12 lines for 4–6 acts.
  - Rule: one or two lines per act, never a matrix of combinations.
  - Do not read the four leanings back as a verdict in the prologue. Outline §6 holds them for the paid books. Whether the Chronicler's closing line may vary by leaning is an owner question.
- **Ask about a topic (FD7)** is the cheapest reactivity Loka has. Each known topic gets one line per NPC, and an NPC with no answer uses its `unknown` line.
  - Engine S.
  - Writing: 1 line per NPC per topic that matters. Pick 3–4 topics (the trowel, the Blight, the stars, Seren) for 3–4 NPCs, so about 10–16 lines.
- **Witness ledger (FD5)** for one or two acts seen by others. For example, if Kira sees you take Dov's fruit, she remarks on it later.
  - Engine S.
  - Writing: 1–2 lines per act.

### 2. The fallback rule: no choice breaks the main story ("n+1")

**Evidence**
- PC Gamer reports at least 24 ways the artefact can reach the player, and calls this Larian's New Vegas-style "n+1" system for players who ignore the plot ([PC Gamer](https://www.pcgamer.com/games/baldurs-gate/baldurs-gate-3-has-at-least-24-ways-shadowheart-can-hurl-the-main-macguffin-at-you-as-part-of-larians-new-vegas-style-n1-system-for-plot-oblivious-players-it-might-be-even-more), headline only).
- On the wiki: if you never recruit Shadowheart, the artefact appears when you camp, and it is always acquired by the end of Act One ([bg3.wiki](https://bg3.wiki/wiki/Mysterious_Artefact)).
- GameSpot's video "The Box That Broke Baldur's Gate 3" describes how one early decision about the box cascaded into development problems ([GameSpot](https://gamespot.com/videos/the-box-that-broke-baldurs-gate-3/2300-6458407/), description only).
- In the prologue, if you fail to open Shadowheart's pod, you still find her after the crash ([bg3.wiki](https://bg3.wiki/wiki/Escape_the_Nautiloid)).
- Vincke on letting players kill almost anyone: "We don't know who you want to kill, but you will want to kill someone." (PC Gamer via Yahoo, above)

**For Loka:**
- **Seed guarantee.** Each seed the outline pays off later gets a fallback, so the payoff can never point at nothing. The seeds are the trowel (8 to 32), the pressed flower (37 to 47) and Dov's fruit (15). The pendant needs none, since beat 46 places it. The fallback is a reaction on the payoff's story point, guarded by "item not held" or "fact unset", that places the item or sets the fact with one line. If the player left the trowel in the field, for example, Tomas hands it over at the cradle room with one line.
  - Engine S: reaction@1 `fact.assign`, `item.move`, `npc.move`.
  - Writing: about 1 line per seed, so 3–5 lines.
  - Larian's lesson: build the fallback first, not after testers find the hole.
- **Never let an action remove a story NPC.** The prologue's named NPCs must not be combat targets: no hostile `disposition` on story NPCs. Beat 42 ("you hold him back or strike him") must be a dialogue choice or scripted action whose narration is the blow, not a combat@1 Attack. An Attack could kill Dov and break beat 47 ("Dov silent"). Engine S. Writing: none extra.

### 3. "Systemic": rules that hold everywhere, and more than one way through

**Evidence**
- Vincke: "'Systemic' is the in-house word. If it's not systemic, it doesn't go in." Also: "if you put something in a game, it has to be consistent throughout the game." ([Game Informer](https://www.gameinformer.com/interview/2019/11/07/a-knight-in-shining-armor-swen-vincke-talks-the-long-road-of-larian-studios))
- Consistency was work. Vincke said druids at one point couldn't talk to a cow while they were themselves transformed into a cow, which showed the team that cinematics needed more work ([MMORPG.com](https://www.mmorpg.com/news/larian-studios-swen-vincke-talks-growing-the-studio-to-meet-baldurs-gate-iii-development-and-early-access-2000124771)).
- Combat designer Matt Holland on the environment: "if the level design is altered one way or another, the fight can play out to a very different degree." On creativity: "how much we want to try to reward the player for being creative." ([RPG Site](https://www.rpgsite.net/interview/9494-baldurs-gate-iii-interview-discussing-combat-and-gameplay-with-larian-studios-designer-matt-holland))
- The Nautiloid shows the pattern at small scale ([bg3.wiki](https://bg3.wiki/wiki/Escape_the_Nautiloid)):
  - Shadowheart's pod opens by Arcana, Strength, or a rune, with a companion's retry.
  - A reliquary opens with a key from a corpse or with Sleight of Hand.
  - You can stack chests to delay the cambion reinforcements.

**For Loka (scaled to a quiet, linear prologue):**
- **Two ways through three or four gates.**
  - The Edge past Brennan: talk, or a hidden passage found by search (row 11).
  - The cradle room door: Brennan leads you, or you force or pick it (rows 13/G12).
  - Dov's fruit: take it, or leave it.
  - Each way uses existing verbs. Engine S: barrier, hidden passages, Use X on Y (G4), rope.
  - Writing: 2–4 lines per extra way (the action's narration and its refusal), so about 10–15 lines.
- **Consistency rule for the prologue's verbs.** If "listen" answers in one room, it answers in every room, even if only with a short line. If water can be drawn at the Spring, it can be drawn at every water source. Treat every verb the player has learned this way.
  - Engine S: W7 alternates and description variants, so a room can share a default line.
  - Writing: 1 default line per verb plus specific lines where they matter.
  - The cheap way to keep the rule: a shared default line, overridden per room only where it pays.
- **Check the prologue's map with a "stranded verb" pass.** Any verb taught in one room should be either usable or plainly refused with a reason in every later room. The Book harness already has a stranded-verb check for undrawn verbs. Engine S (inferred: whether it extends to this case is unverified).

### 4. Dialogue checks: a visible d20, and what Larian had to fix

**Evidence**
- Vincke: "Everybody can throw the dice, there's nothing complicated about the dice." He also said that without the dice, "everything that's built around the dice is not going to feel true." ([Game World Observer](https://gameworldobserver.com/2023/09/06/swen-vincke-dnd-interview-badlurs-gate-3-player-empathy))
- Criticism ([Kotaku](https://kotaku.com/baldurs-gate-3-larian-rpg-pc-steam-dice-rolls-d20-1850729004)):
  - Dice in dialogue "dangle interesting possibilities in front of you, then tell you you're not allowed to experience them."
  - Rerolling by reloading "feels fake and crappy".
  - Some players pick blander options to avoid the risk.
- Larian's later changes, per a third-party guide citing Larian posts ([Senseos](https://senseos.gg/guides/baldurs-gate-3/dice-and-ability-checks/), unverified against primary patch notes):
  - eased the harshest dialogue checks (December 2020);
  - weighted against streaks (February 2021);
  - added an option to hide the target number.
- Inspiration lets you reroll a failed check. You earn it by acting in line with your background, it caps at 4, and each point also gives XP ([bg3.wiki](https://bg3.wiki/wiki/Inspiration)). This turns roleplay into a resource that softens bad luck.
- The prologue's checks are mostly easy: DC 10 Investigation, DC 10 Arcana, DC 10 Medicine, DC 7 Arcana and DC 2 Wisdom for the pod. The one hard check is DC 15 Dexterity, to mutilate Us after freeing it, and failing it makes the intellect devourers hostile ([bg3.wiki](https://bg3.wiki/wiki/Escape_the_Nautiloid)).

**Loka already avoids the worst of this.** Loka's dialogue check (row 14) is deterministic, opposed and draws no RNG. A retry passes only once the skill has grown, so reloading changes nothing, and "practice persuades in the end". BG3's patches moved toward the same place: easier, smoother checks with less luck.

**For Loka:**
- **Teach with checks that pass.** The first check of each new kind in the prologue should be one the player almost surely passes, as on the Nautiloid (DCs of 2–10). A hard check comes only after the player has seen the kind succeed.
  - Engine S: set the rating.
  - Writing: none extra.
- **Fail forward with `then_failed`.** In row 14, a failed check applies none of the choice's `steps`. So a failure that leads somewhere must be a `then_failed` dialogue: a different line or small scene, never a closed door. One example is failing to calm Dov, which leads to Kira stepping in. The prior note already covers the principle, so this is only the Loka mechanism.
  - Engine S.
  - Writing: 2–4 lines per checked choice.
- **Name the skill on a checked choice.** Today the Book shows a checked choice like any other (`docs/system/book-ui.md`; row 14 "Book: no new element"). BG3's tag, such as "[Persuasion]", tells the player which skill is in play and makes passing feel earned. A skill tag, without any odds, fits Loka's no-numbers style.
  - Engine M: a GameView field and a Book element, with design approval.
  - Writing: none, since the skill names exist already.
  - This is an owner and designer question, not a default.

### 5. Companions: approval as a way to learn who they are

**Evidence**
- GamesRadar reports a writer saying the reputation system exists because Larian can't let players "break" party members: "We would be working on the game forever" ([GamesRadar](https://www.gamesradar.com/games/baldur-s-gate/baldurs-gate-3-writer-says-the-rpgs-reputation-system-exists-because-larian-cant-just-let-players-break-party-members-we-would-be-working-on-the-game-forever/), headline only). Secondary summaries add that "Lae'zel approves" tells you a little about her. That detail is unverified against the article body.
- Companions change their greetings by approval level ([bg3.wiki Lae'zel/Approval](https://new.bg3.wiki/wiki/Lae%27zel/Approval)). They gain approval only within earshot ([fextralife](https://baldursgate3.wiki.fextralife.com/Companion%20Approval%20Guide)).
- A Larian developer: "The approval thresholds were too low when we shipped." (speaker not confirmed from the article body) Companions such as Gale romanced the player too fast ([TechRadar](https://www.techradar.com/gaming/consoles-pc/baldurs-gate-3-companions-were-so-forward-at-launch-due-to-a-bug-dev-says)).
- Larian wants "more interaction between companions" in its next game, which concedes that BG3's companion-to-companion talk was thin ([GamesRadar](https://www.gamesradar.com/games/rpg/the-thing-i-wanted-more-of-from-baldurs-gate-3-is-also-something-larian-wants-to-improve-on-in-divinity-more-interaction-between-companions/)).
- Camp scenes play on a long rest, in priority order. Some are tied to a campsite. Some expire after a number of rests, and partial rests were added to trigger them ([bg3.wiki Camp Events](https://bg3.wiki/wiki/Camp_Events)). A fan mod had to add a marker for waiting events ([Nexus](https://www.nexusmods.com/baldursgate3/mods/1879)). A forum post says the limit is one narrative event per rest ([Larian forums](https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=944934)), but the wiki says several can play. The sources conflict.
- At the one-year mark, 93% of players chose a custom character over an origin ([GamesRadar](https://www.gamesradar.com/games/rpg/larian-unveils-a-full-year-of-baldurs-gate-3-player-stats-astarion-is-the-favorite-paladin-is-best-class-and-a-surprising-amount-of-you-enjoy-bear-sex-and-tentacles/)).

**For Loka (one companion, Thera; the outline says the leaning is "nothing scored or shown"; companion asides FD10 are retired):**
- **Show Thera's regard; never score it.** Keep a hidden trust pair fact on Thera (row 15). Read it back through a greeting or description variant (W6) and one NPC emote (G9) at two or three moments. This keeps what approval teaches (it reveals her character) without a "Thera approves" popup, which the outline's "nothing is shown" rules out.
  - Engine S.
  - Writing: 2 variants each for 3 moments, so about 6–8 lines.
  - Banter goes through talk or emotes (loka-kgd.193), not retired asides.
- **Rest scenes the player cannot miss.** Tie each rest scene to a story point, not to a location or a count of rests. The S10 Lantern Rest dream and the `rested` reaction trigger already exist. If a scene is due, the next rest plays it. BG3's location-tied, expiring camp events are the warning.
  - Engine S.
  - Writing: the scenes the outline already has (beats 11, 17, 43).
- **Origin characters: skip.** 93% played their own character, and an origin is expensive (inferred). The D11 ancestries already cover the start.

### 6. The narrator: one voice behind your ear

**Evidence**
- Larian first wanted several narrators, a choice of Dungeon Master, and considered Matthew Mercer. Vincke said the idea was dropped because every scene would need editing to mix the DM with the actors, which was too expensive ([TheGamer](https://www.thegamer.com/baldurs-gate-3-devs-wanted-multiple-dungeon-masters-narrators-game-developer-conference-gdc-2024/), [PC Gamer](https://www.pcgamer.com/games/baldurs-gate/larian-originally-wanted-baldurs-gate-3-to-have-multiple-narrators-also-astarion-was-a-tiefling/)).
- Amelia Tyler described the narrator as a character "behind your ear just whispering". The role allowed lighter moments. She recorded for almost four years, in 17 narration styles that depend on player choice ([PCGamesN](https://www.pcgamesn.com/warframe/1999-amelia-tyler-interview-baldurs-gate-3-narrator), [Screen Rant](https://screenrant.com/amelia-tyler-baldurs-gate-3-interview/); figures as reported).
- The narrator is second person and speaks for the player's inner state as well as the scene. She was widely praised and nominated for awards ([Wikipedia accolades](https://en.wikipedia.org/wiki/List_of_accolades_received_by_Baldur%27s_Gate_3)).

**For Loka:** The outline already has a narrator: the Chronicler, in second person, present tense. That is the BG3 choice, and in text it is free. The writer is the narrator.
- **A few dry asides on what the player chose, not only on what the scene is.** Examples are a failed check, a strange action (eating something odd, a long stare), or a death. BG3's narrator earns warmth through these lighter moments.
  - Engine S: the failure line, scripted-action narration, death lines (loka-3w3q).
  - Writing: 8–12 lines across the prologue.
- **Repeat-visit tiers (W7)** keep the voice from repeating itself, with a long first description and a short familiar one.
  - Engine S.
  - Writing: 1 short line per main room, about 18 lines.

### 7. Handcrafted encounters, and the environment as a tool

**Evidence**
- Holland on encounters: "how do we add spice to the encounter that people are going to remember?" Also: "Just because you rolled a 1 doesn't mean the combat's over." (RPG Site, above)
- The prologue's boss fight is not a plain brawl ([bg3.wiki](https://bg3.wiki/wiki/Escape_the_Nautiloid)):
  - A mind flayer fights Zhalk and treats you as a thrall, then turns on you.
  - Two cambions arrive after a few rounds.
  - Stacked chests can block them.
  - Touching the console ends the prologue whatever enemies remain.
  - The cutscenes push you to ignore Zhalk.
  - The goal is escape, not a kill.

**For Loka:** The prologue has one fight, at beat 41 (the wolf-thing at the Hollow). This lesson ranks low, but it is cheap to apply to that one fight.
- **Give the fight a goal other than "kill it"**: protect Thera or the Hollow (Protect objective, row 38), or hold until Brennan arrives as an ally who deals damage (row 6b). The fight ends when the goal is met.
  - Engine S: content on existing rows.
  - Writing: the fight's lines are already on the owner's list, plus about 3–5 goal lines.
- **One environmental option**, such as a fire brand from the hearth or a rope. Engine S (W22 fire, Use X on Y). Writing: 2–3 lines.

### 8. Pacing: the Nautiloid as onboarding, and the acts

**Evidence**
- On the wiki, the prologue is linear: it moves in one direction and you cannot return after the crash. Each room adds one thing ([bg3.wiki](https://bg3.wiki/wiki/Escape_the_Nautiloid)):
  - a pod you escape;
  - an easy Investigation check at a pool that can explode;
  - a moral choice with a payoff later (Us, who can return at the end of Act Two);
  - the first companion (Lae'zel) and a forced small fight against three imps;
  - a second companion who can be saved several ways;
  - an optional locked chest;
  - a set-piece boss with an escape goal;
  - a crash that sets up Act 1, with the goblins' reaction shown in a cutaway.
- The release version slimmed the Early Access prologue: fewer rooms between Lae'zel and Shadowheart, and the whole exterior battle cut. The cut material had mainly made the scene a few minutes longer ([GameRant](https://gamerant.com/baldurs-gate-3-opening-hour-early-access-final-version-comparison-changes-differences/)). The wiki says the Nose of the Nautiloid was cut, likely to shorten the prologue for replays ([bg3.wiki](https://bg3.wiki/wiki/Cut_and_unimplemented_content)).
- Smith: "We knew players couldn't be running around fighting goblins for 100 hours." Also: "it's more this is the complexity of it." (Game Rant, above)
- Larian has not stated what the Nautiloid was designed to do. **This onboarding reading is inferred** from the wiki and the GameRant comparison: the prologue teaches by doing, one system per room, with low stakes, a ticking threat and a strong ending.

**For Loka:** The prologue's structure already matches the Nautiloid's shape: mechanics unlock with the descent, one stair at a time, and the story ends on a landing. Lessons to apply:
- **Part 1 is Loka's Nautiloid.** It needs one new verb per room, an easy first check, one small choice that pays off later, and an ending beat that pulls you on (the First Fruit rite). The outline's first slice already does most of this. The gap is a small early choice whose payoff comes back. Good candidates are whether you pass Dov's best fruit to someone (beat 7) and what you tell Tomas about the trowel (beat 8), each read back in Part 2 with one line.
  - Engine S.
  - Writing: about 2–4 lines.
- **Trim like Larian did.** The release Nautiloid cut rooms whose only job was length. With 48 beats in about 4 hours, look for beats that add no new verb, seed or payoff and fold them in.
  - Engine none.
  - Writing: negative.
  - This is an owner call (inferred lesson).
- **End on the landing as a hook, as BG3's crash opens Act 1.** The outline's beat 48 already does this. Keep the leanings unread here (see §1).

### 9. Exploration that pays in story, not loot

**Evidence**
- Vincke's "0.001%" quote (§1).
- Speak with Animals and Speak with Dead give short authored lines to many creatures and corpses. Some animals get a full talk, others a line or two ([TheGamer](https://www.thegamer.com/baldurs-gate-3-speak-to-animals-guide/), [DualShockers](https://www.dualshockers.com/baldurs-gate-3-animals-you-should-talk/)). Scratch the dog leads to a dead owner and a camp dog. Players reported this as a delight. The claim that it is a cheap delight is inferred.
- Loot clutter drew complaints: "in every room there is like a 100 containers", most of them junk ([Gfinity](https://www.gfinityesports.com/article/why-baldurs-gate-3s-inventory-needs-a-simpler-system), [Dexerto](https://www.dexerto.com/baldurs-gate/baldurs-gate-3-players-have-one-major-complaint-about-items-2369062/)).

**For Loka (no economy in the prologue):**
- **Reward looking with lines and lore, not items.** Use inspectable details, the lore codex and deductions (row 46), and hidden passages (row 11) leading to a small, true fact about the world. Examples: the right-angle Blight line, the trowel's script, Lira's memorial. Each one feeds a later callback.
  - Engine S.
  - Writing: about 1–2 lines per detail. Six to ten details, so about 10–20 lines.
- **Few containers, each with something in it.** This is the opposite of BG3's clutter. Engine none. Writing: none extra.

---

## What not to copy

- **Scale and combinatorial endings.** About 2M words, a spreadsheet of endings, 18 replays to test one quest. These are Larian's own words for a team of hundreds, and Patch 5 still had to add a new epilogue ([TechRadar](https://www.techradar.com/gaming/consoles-pc/baldurs-gate-3-patch-5-adds-a-new-epilogue-with-some-of-the-most-complex-writing-in-the-game-so-far)). For one writer, every choice gets one or two callback lines and the ending varies in short read-back lines. Never multiply choices against each other.
- **"Kill anyone."** It forces n+1 fallbacks everywhere and is the source of the artefact cascade. The prologue's story NPCs should not be combat targets.
- **Visible approval pop-ups.** They conflict with the outline's "nothing scored or shown". Even Larian shipped the thresholds too low. Show regard through lines instead (§5). If the owner wants a visible signal, that is a separate ruling.
- **Random d20 in dialogue.** It invites reloading and blander choices (Kotaku). Loka's deterministic check, which grows with use, is better. Keep it.
- **Camp scenes that depend on location or expire.** Players missed them, and a mod had to add a marker. Tie Loka's rest scenes to story points.
- **Act 3's density.** Critics and players described quest overload ("accruing quests without meaning to") and a final emergency that loses its urgency in an open structure ([Screen Rant](https://screenrant.com/baldurs-gate-3-act-three-good-improvements/)). Larian admitted Act 3 performance was worse than the first two acts and patched it ([GamesRadar](https://www.gamesradar.com/baldurs-gate-3-devs-address-act-3-criticism-including-cut-content-and-performance-and-promise-a-better-ending-for-karlach/)). For the prologue's Part 5: one thread at a time, and no new side quests in the last hour.
- **Information overload.** "We used to joke you basically need a tutorial for every class" ([GamesRadar](https://www.gamesradar.com/larian-knows-baldurs-gate-3s-dandd-combat-is-super-complicated-we-used-to-joke-you-basically-need-a-tutorial-for-every-class/), headline only). The inventory needed too many clicks, and new players found the spell system hidden across several screens (Dexerto and Gfinity, player reports). Loka's mechanics-unlock-with-the-descent plan is the right counter. Do not unlock two systems in one beat.
- **Overscoping and cutting late.** Vincke: "I've notoriously always been bad at judging the length of our games." Larian planned more regions, cut a Moonrise Tower almost twice its final size, and was accused of cutting content in Act 3 ([PC Gamer](https://www.pcgamer.com/games/baldurs-gate/swen-vincke-was-worried-that-the-100-hour-baldurs-gate-3-would-be-too-short-which-is-why-the-team-made-a-ton-of-extra-areas-they-wound-up-cutting-ive-notoriously-always-been-bad-at-judging-the-length-of-our-games/), [GamesRadar](https://gamesradar.com/games/baldur-s-gate/baldurs-gate-3s-iconic-moonrise-towers-was-almost-twice-its-final-size-but-director-swen-vincke-says-the-game-was-getting-too-big-so-we-had-to-cut-that)). For Loka: finish Part 1 end to end before writing Part 2.
- **Romance and origin characters.** The owner has ruled out romance. Origins cost a full second script, and 93% of players skipped them.

## What Larian says it would change

- **Show choices better.** Vincke called how BG3's cinematics showed choices "probably my biggest takeaway" for the next game ([TechRadar](https://www.techradar.com/gaming/baldurs-gate-3-director-says-the-games-cinematics-and-how-choices-were-portrayed-is-one-of-the-biggest-lessons-larian-is-bringing-to-divinity-i-think-that-was-probably-my-biggest-takeaway-from-everything), headline only).
- **More companion-to-companion interaction** (GamesRadar, §5).
- **Higher approval thresholds**, which were too low at launch (TechRadar, §5).
- **Scope:** he misjudged length, cut regions and a second Moonrise, and rescoped Act 2 when it got stuck (PC Gamer and GamesRadar, above). Early Access is the thing he would keep: "I certainly don't regret going with early access again." He also says to organise for iteration ([GamesBeat](https://gamesbeat.com/astarion-the-tiefling-swen-vincke-on-iteration-in-baldurs-gate-3-gdc-2024/)).
- **Act 3 performance and endings:** fixed and added in patches 2 and 5 (GamesRadar, TechRadar, above).
- **For Loka (inferred):** playtest Part 1 with real players before Part 2 is written. That is the solo writer's version of Early Access.

---

## Top 8 for the prologue (ranked)

1. **Seed guarantee (n+1).** Each seed the player carries toward a payoff has a reaction fallback, so the payoff always lands: the trowel, the pressed flower, Dov's fruit. Beat 42's strike on Dov is a dialogue or scripted blow, never a combat Attack, so no story NPC can die.
   - Systems: reaction@1, `item.move`, story points.
   - Engine S. Writing: about 3–5 lines.
2. **Callback lines on 4–6 individual acts (the D9 pattern).** One or two later NPCs each read a committed act back in one line. Examples: Kira on the fruit, Tomas on the trowel, Maren on your dream. No matrix of combinations, and no verdict on the four leanings, which the outline holds for the paid books (a leaning-aware closing line is an owner question).
   - Systems: dialogue `narration_variants`, W6, `fact_compare`.
   - Engine S. Writing: about 8–12 lines.
3. **Part 1 as the Nautiloid.** One new verb per room. The first check of each kind is easy to pass. One small early choice is read back in Part 2. Never two systems unlocked in one beat.
   - Systems: check@1 ratings, row 14, the outline's unlock order.
   - Engine S. Writing: about 2–4 lines.
4. **Fail forward through `then_failed`.** Every checked choice in the prologue opens a different line or small scene on failure, never a dead end. A retry still works through skill growth.
   - Systems: dialogue checks (row 14), branching dialogue.
   - Engine S. Writing: about 2–4 lines per check.
5. **Rest scenes the player cannot miss.** Dreams and night scenes (beats 11, 17, 43) are tied to story points, not to location or rest counts, and the next rest plays any scene that is due.
   - Systems: the `rested` reaction trigger, the S10 Lantern Rest dream.
   - Engine S. Writing: already in the outline.
6. **Thera's regard shown, never scored.** A hidden trust pair fact changes her greeting or description and one emote at two or three moments. No pop-up.
   - Systems: rows 15/G11, W6 variants, G9 emotes.
   - Engine S. Writing: about 6–8 lines.
7. **The Chronicler's asides and repeat-visit tiers.** A few dry second-person lines on failures, odd actions and death, plus a short "familiar" description per main room.
   - Systems: the check failure line, scripted-action narration, death lines, W7.
   - Engine S. Writing: about 8–12 asides and about 18 short room lines.
8. **Two ways through three or four gates, and verbs that work everywhere.** Use talk, search, force or a tool at the Edge, the cradle door and Dov's hut. "Listen" and the other learned verbs answer in every room with a default line.
   - Systems: barrier, hidden passages (row 11), pick and force (rows 13/G12), Use X on Y (G4), W7.
   - Engine S. Writing: about 10–15 lines plus 1 default line per verb.

Close runners-up: Ask about a topic (FD7) for 3–4 topics; exploration details that feed callbacks (row 46); giving the beat-41 fight a protect or hold goal (row 38).

---

## Sources

Developer statements
- PC Gamer via Yahoo, BAFTA panel ("weird Dungeon Masters"; Ding, Smith, Vincke): https://malaysia.news.yahoo.com/larian-gave-baldurs-gate-3-022539159.html (original: https://pcgamer.com/games/rpg/larian-gave-baldurs-gate-3-its-acclaimed-reactivity-by-approaching-it-as-weird-dungeon-masters)
- PC Gamer, n+1 and 24 artefact routes (headline only): https://www.pcgamer.com/games/baldurs-gate/baldurs-gate-3-has-at-least-24-ways-shadowheart-can-hurl-the-main-macguffin-at-you-as-part-of-larians-new-vegas-style-n1-system-for-plot-oblivious-players-it-might-be-even-more
- GameSpot video, "The Box That Broke Baldur's Gate 3" (description only): https://gamespot.com/videos/the-box-that-broke-baldurs-gate-3/2300-6458407/
- Game Rant, Adam Smith interview: https://gamerant.com/baldurs-gate-3-interview/
- Wccftech, Ding on 17,000 endings: https://wccftech.com/baldurs-gate-3-writer-clarifies-17000-endings-claim/
- Shacknews, 17,000 variations: https://www.shacknews.com/article/136296/baldurs-gate-3-ending-17000-variations
- Game World Observer, Vincke on player empathy and dice: https://gameworldobserver.com/2023/09/06/swen-vincke-dnd-interview-badlurs-gate-3-player-empathy
- Game Informer, Vincke on "systemic": https://www.gameinformer.com/interview/2019/11/07/a-knight-in-shining-armor-swen-vincke-talks-the-long-road-of-larian-studios
- RPG Site, Matt Holland on combat: https://www.rpgsite.net/interview/9494-baldurs-gate-iii-interview-discussing-combat-and-gameplay-with-larian-studios-designer-matt-holland
- MMORPG.com, Vincke on scope and the druid-cow problem: https://www.mmorpg.com/news/larian-studios-swen-vincke-talks-growing-the-studio-to-meet-baldurs-gate-iii-development-and-early-access-2000124771
- GamesBeat, Vincke at GDC 2024: https://gamesbeat.com/astarion-the-tiefling-swen-vincke-on-iteration-in-baldurs-gate-3-gdc-2024/
- GDC Vault, "The Secrets of Baldur's Gate 3": https://gdcvault.com/play/1034610/The-Secrets-of-Baldur-s
- TheGamer, multiple narrators dropped (GDC 2024): https://www.thegamer.com/baldurs-gate-3-devs-wanted-multiple-dungeon-masters-narrators-game-developer-conference-gdc-2024/
- PC Gamer, multiple narrators: https://www.pcgamer.com/games/baldurs-gate/larian-originally-wanted-baldurs-gate-3-to-have-multiple-narrators-also-astarion-was-a-tiefling/
- PCGamesN, Amelia Tyler interview: https://www.pcgamesn.com/warframe/1999-amelia-tyler-interview-baldurs-gate-3-narrator
- Screen Rant, Amelia Tyler interview: https://screenrant.com/amelia-tyler-baldurs-gate-3-interview/
- GamesRadar, reputation system "working on the game forever" (headline only): https://www.gamesradar.com/games/baldur-s-gate/baldurs-gate-3-writer-says-the-rpgs-reputation-system-exists-because-larian-cant-just-let-players-break-party-members-we-would-be-working-on-the-game-forever/
- GamesRadar, more companion interaction in Divinity: https://www.gamesradar.com/games/rpg/the-thing-i-wanted-more-of-from-baldurs-gate-3-is-also-something-larian-wants-to-improve-on-in-divinity-more-interaction-between-companions/
- TechRadar, approval thresholds too low: https://www.techradar.com/gaming/consoles-pc/baldurs-gate-3-companions-were-so-forward-at-launch-due-to-a-bug-dev-says
- TechRadar, cinematics and choices as the biggest takeaway (headline only): https://www.techradar.com/gaming/baldurs-gate-3-director-says-the-games-cinematics-and-how-choices-were-portrayed-is-one-of-the-biggest-lessons-larian-is-bringing-to-divinity-i-think-that-was-probably-my-biggest-takeaway-from-everything
- TechRadar, Patch 5 epilogue: https://www.techradar.com/gaming/consoles-pc/baldurs-gate-3-patch-5-adds-a-new-epilogue-with-some-of-the-most-complex-writing-in-the-game-so-far
- PC Gamer, Vincke "bad at judging the length": https://www.pcgamer.com/games/baldurs-gate/swen-vincke-was-worried-that-the-100-hour-baldurs-gate-3-would-be-too-short-which-is-why-the-team-made-a-ton-of-extra-areas-they-wound-up-cutting-ive-notoriously-always-been-bad-at-judging-the-length-of-our-games/
- GamesRadar, Moonrise Towers cut: https://gamesradar.com/games/baldur-s-gate/baldurs-gate-3s-iconic-moonrise-towers-was-almost-twice-its-final-size-but-director-swen-vincke-says-the-game-was-getting-too-big-so-we-had-to-cut-that
- GamesRadar, Larian on Act 3 performance and cut content: https://www.gamesradar.com/baldurs-gate-3-devs-address-act-3-criticism-including-cut-content-and-performance-and-promise-a-better-ending-for-karlach/
- GamesRadar, "a tutorial for every class" (headline only): https://www.gamesradar.com/larian-knows-baldurs-gate-3s-dandd-combat-is-super-complicated-we-used-to-joke-you-basically-need-a-tutorial-for-every-class/

Player data
- PC Gamer, 34.9% attacked the Grove: https://www.pcgamer.com/i-cant-believe-35-of-baldurs-gate-3-players-already-took-the-evil-route/
- GamesRadar, one-year stats (93% custom characters): https://www.gamesradar.com/games/rpg/larian-unveils-a-full-year-of-baldurs-gate-3-player-stats-astarion-is-the-favorite-paladin-is-best-class-and-a-surprising-amount-of-you-enjoy-bear-sex-and-tentacles/
- MMORPG.com, one-year stats: https://www.mmorpg.com/news/almost-2-million-baldurs-gate-3-players-were-turned-into-cheese-and-other-stats-as-larian-celebrates-the-rpgs-one-year-anniversary-2000132437
- TheGamer, Early Access telemetry and plot changes: https://www.thegamer.com/baldurs-gate-3-launch-changes/
- OpenCritic, Early Access stats: https://opencritic.com/news/1841/larian-studios-shares-fun-stats-from-baldurs-gate-3-early-access

Game facts (wikis, guides)
- bg3.wiki, Escape the Nautiloid: https://bg3.wiki/wiki/Escape_the_Nautiloid
- bg3.wiki, Mysterious Artefact: https://bg3.wiki/wiki/Mysterious_Artefact
- bg3.wiki, Inspiration: https://bg3.wiki/wiki/Inspiration
- bg3.wiki, Camp Events: https://bg3.wiki/wiki/Camp_Events
- bg3.wiki, Cut and unimplemented content: https://bg3.wiki/wiki/Cut_and_unimplemented_content
- bg3.wiki, Lae'zel approval: https://new.bg3.wiki/wiki/Lae%27zel/Approval
- Fextralife, approval guide: https://baldursgate3.wiki.fextralife.com/Companion%20Approval%20Guide
- GameRant, Early Access vs release opening: https://gamerant.com/baldurs-gate-3-opening-hour-early-access-final-version-comparison-changes-differences/
- Senseos, dice and Larian tuning (third party): https://senseos.gg/guides/baldurs-gate-3/dice-and-ability-checks/
- TheGamer, speak with animals: https://www.thegamer.com/baldurs-gate-3-speak-to-animals-guide/
- DualShockers, animals to talk to: https://www.dualshockers.com/baldurs-gate-3-animals-you-should-talk/
- Larian forums, one camp event per rest (contradicted by the wiki): https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=944934
- Nexus, Camp Event Notifications mod: https://www.nexusmods.com/baldursgate3/mods/1879

Criticism and reviews
- Kotaku, dice in dialogue: https://kotaku.com/baldurs-gate-3-larian-rpg-pc-steam-dice-rolls-d20-1850729004
- Screen Rant, Act 3 pacing: https://screenrant.com/baldurs-gate-3-act-three-good-improvements/
- Gfinity, inventory clutter: https://www.gfinityesports.com/article/why-baldurs-gate-3s-inventory-needs-a-simpler-system
- Dexerto, item complaints: https://www.dexerto.com/baldurs-gate/baldurs-gate-3-players-have-one-major-complaint-about-items-2369062/
- OpenCritic reviews (PC Gamer 97, IGN 10, Eurogamer 4/5): https://opencritic.com/game/9136/baldurs-gate-3/reviews
- Wikipedia, accolades: https://en.wikipedia.org/wiki/List_of_accolades_received_by_Baldur%27s_Gate_3

Loka context read (not edited): docs/system/mechanics.md (rows 14, 15/G11, 46, FD5, FD7, W6, W7, D9, S10, reaction@1, escort@1; FD10 and FD3 retired), docs/system/book-ui.md, docs/worldbuilding/notes/prologue-outline-2026-10-30.md, docs/HANDOFF.md, docs/rnd/*.
