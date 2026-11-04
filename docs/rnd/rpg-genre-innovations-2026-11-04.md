# RPG innovations that made games more immersive, and what Loka can take (2026-11-04)

R&D note. Read-only research; nothing in the repo was changed.

## Scope and method

- Covers RPG innovations in storytelling, character, mechanics, simulation, companions, interface and pacing.
- Skips Baldur's Gate 3, which another agent covers.
- Skips ground the earlier notes already cover in depth. Those are listed at the end of this section as one-line cross-references.
- Each entry gives the innovation and the evidence that it worked. "For Loka" then maps it to a named Loka system from `docs/system/mechanics.md` or `docs/MECHANICS-TOOLBOX.md`, or says "new".
- Each entry is rated on four fields:
  - **Engine:** S means content or a setting, M means one mechanic slice, L means a new subsystem or a save or contract change.
  - **Writing:** the owner's writing load, from none to high.
  - **Prologue:** whether it fits the free 3 to 5 hour prologue (yes, later or no).
- **Inference** marks a claim with no primary source, and any judgment of mine.
- Many entries cost S. That is because Loka's engine already holds the mechanic, and the gap is content. Mapping each innovation to a built system is the main finding of this note.
- Owner rules this note respects:
  - The owner writes every player-facing word, so this note contains no sample lines. It describes patterns only.
  - The storylet deck (toolbox row FD3) was built, then retired by the owner on 2026-10-23 (Beads `loka-x6t.125`). It was projected but never drawn in the Book. An opportunity is now an action on a person or fixture page. Nothing here proposes bringing the deck back.

Already covered elsewhere, cross-referenced only:

- Use-based skills and their exploits: `koster-design-lessons-2026-10-15.md` and `elder-scrolls-morrowind-skills-2026-10-23.md`.
- Disco Elysium internal voices: `rpg-and-mud-design-breakthroughs-2026-11-03.md`, built as FD2 passive skill voices.
- Souls and Elden Ring item lore, environmental fragments and shortcuts, Ultima IV virtues, Achaea afflictions, OSRS quests, and the Planescape and KOTOR II mentors: the same breakthroughs note.
- Macro-landmarks, breadcrumb hubs and rested XP: `wow-and-classic-forever-design-lessons-2026-11-03.md`.

---

## 1. Storytelling and consequence

### 1.1 Delayed, telegraphed consequences (The Witcher 3, Cyberpunk 2077)

- **What:** CD Projekt RED's quest director Paweł Sasko gave a GDC 2023 talk on quest lessons. It has two linked rules:
  - Delayed and "really delayed" consequences make the biggest impression on players.
  - Consequences must be visible. Investing in a consequence that is not telegraphed well "is mostly not worth it".
- **Other rules from the same talk:**
  - Withhold information so the player wants to learn more.
  - Cut repeated summaries.
  - Let the world carry exposition.
  - Set up stakes before the choice.
- **Why it worked:** a payoff that arrives hours later reads as the world remembering, not as a menu reacting. The cost is the same one fact either way. Delay only adds the gap. (Inference.)
- **For Loka:** the engine has every piece.
  - Record the choice as a W2 entity or pair fact, or with the dialogue `fact.adjust`.
  - Pay it off later with FD1 delayed reactions (`after {real minutes}`, `time_since`), or with a W6 entity variant or a room description variant that reads the fact on a later visit.
  - Telegraph the payoff at choice time through an FD10 aside or an NPC mood (W6), so the player knows the choice was noticed.
- **Engine:** S. **Writing:** low; one setup line and one payoff line per consequence. **Prologue:** yes. Two or three delayed payoffs would carry a 3 to 5 hour arc.

### 1.2 Consequence shown by a return visit after time passes (Pentiment)

- **What:** Pentiment is split into three acts set years apart. Josh Sawyer said he wanted players to see "how the consequences play out over generations".
  - Reviewers describe the village after a time skip as substantially different, both from the player's acts and from time passing.
  - The narrative designer, Zoe Franznick, places the most visible consequences in the third act.
- **Why it worked:** one return to a familiar place shows every change at once. Each change is a cheap variant of a room the player already knows. (Inference.)
- **For Loka:** stage one deliberate return to the Village after the expedition (the Deep Fen, or C6's Night in the Marsh). Room `description_variant@1` entries and W6 NPC variants read the facts the player set. The away recap (W27) and Chronicle (FD6) already frame time away.
- **Engine:** S. **Writing:** medium; one variant per changed room or NPC. **Prologue:** yes, as the closing beat.

### 1.3 Choices carried into the next chapter (Mass Effect save import)

- **What:** BioWare tracked about 700 player decisions from Mass Effect 1 into Mass Effect 2. Over 1,000 variables carried into Mass Effect 3.
- **Limits it hit:**
  - A save where Shepard died could not carry forward.
  - A critic, Shamus Young, argued that players with no save got the least interesting default.
- **Why it worked:** the player's own history became the premise of the sequel. Fans still name the import as a series signature. (Inference.)
- **For Loka:** maps to toolbox row 48, chapter carry-over (48a export, 48b import, 48c ports). It has no section in `mechanics.md`, so it is not built.
  - The cheap part to do now is to tag the few prologue facts that should carry forward, while authoring them.
  - Give the import a deliberate default, or a short "what happened" choice for players with no save.
- **Engine:** L (save and contract work). **Writing:** none now. **Prologue:** later. The tagging habit can start now.

### 1.4 Story that advances on death (Hades)

- **What:** In Hades, every death returns the player to a hub. The cast there has new things to say, so failure moves the story forward.
  - Greg Kasavin said the game "can technically be played forever", so players must not quickly reach the point where characters repeat themselves.
  - Hades 1 has over 22,000 lines of dialogue. The GDC 2021 talk by Kasavin and Darren Korb covers the pipeline.
- **Gating:** an interview says the player can talk to a character only once per return visit.
- **How lines are chosen:** the exact priority logic is not public in the sources found. The belief that lines carry trigger conditions and fall back to a filler pool comes from an unverified fan post. (Inference.)
- **For Loka:** maps to death@1. The body returns to `world.death.shrine`.
  - Pattern: the shrine keeper's dialogue@1 options are gated on a death-count fact. An option is shown once, then closed with a fact that resets when the player leaves the room.
  - Open question: whether a reaction can count the player's own deaths. `entity_died` filters by `victim_definition`, and a player body has none. The standing section also says the player's body is never a reaction subject.
  - A named-NPC `fact.adjust`, such as the keeper's fact, sidesteps the subject rule. A filter for a player victim may still be missing. (Inference; verify.)
- **Engine:** S if a player-victim filter exists, else M. **Writing:** medium; three to five death-gated lines. **Prologue:** yes. Death is common in Diku combat, and a single acknowledgement softens its penalty.

### 1.5 Quests found in the world, not given (Discworld MUD)

- **What:** A Game Studies paper compares Discworld MUD with WoW. In Discworld, quests are hidden in the environment and often use syntax unique to each quest. WoW quests are a temporary task on the way to maximum level.
- **Why it worked:** finding the quest is part of the reward, and the world reads as dense. The paper's own warning is that it is opaque without help.
- **For Loka:** there is no typed syntax on the phone. The equivalent is a scripted_action@1 on an inspectable detail or a fixture page, gated by a policy, with W23 stage hints as a safety net.
- **Engine:** S. **Writing:** medium. **Prologue:** yes, as one or two hidden side threads, not the main line.

### 1.6 Every problem has more than one solution (Deus Ex and immersive sims)

- **What:** Warren Spector set "commandments" for Deus Ex: "problems, not puzzles", "no forced failure", "players do; NPCs watch", and areas with several ways in and out.
  - They were published in Game Developer magazine in 1999 and discussed in his 2000 postmortem.
  - Spector traces the idea to an Ultima VI playtest, where a player used a pet mouse to reach controls the team had not anticipated.
- **Why it worked:** the player's choice of method becomes their character. A bypass does not need new story, only a second verb.
- **For Loka:** give every prologue blocker at least two routes from systems already built:
  - pick or force a barrier (rows 13 and G12);
  - use X on Y by property tag (G4);
  - sneak and hide (16);
  - a dialogue skill check (14);
  - a hidden passage (11);
  - rope and climb (30).
  - "Players do; NPCs watch" maps to the FD5 witness ledger. The world reacts to what was seen, not to a cutscene.
- **Engine:** S. **Writing:** low; each extra route is one action label and one or two result lines. **Prologue:** yes.

---

## 2. Character development

### 2.1 Origin tags that unlock lines (Divinity: Original Sin 2)

- **What:** Larian replaced the opposing traits of the first game, such as Bold versus Cautious, with tags: race, gender, background and origin. Each tag unlocks NPC reactions and extra dialogue options.
  - Swen Vincke described them as invisible tags assigned at character creation.
  - A Larian scripter asked that origin moments never interact with each other again, which shows the combinatorial cost.
- **Why it worked:** one boolean adds a branch wherever the writer chooses. Nothing else needs to account for it.
- **For Loka:** maps to the D11 ancestry choice. `AncestrySpec.faction` sets one player-scoped fact when the choice is made, and `fact_compare` already reads it.
  - Each of the four ancestries can therefore gate dialogue options, W6 variants and FD10 asides with no engine work.
  - More than one tag per ancestry, or tags gained in play, means widening that field to a list (M).
  - Keep tags independent of each other, per the Larian warning.
- **Engine:** S for one tag per ancestry. **Writing:** low; about one gated line per key NPC. **Prologue:** yes.

### 2.2 Origin stories as the opening act (Dragon Age: Origins)

- **What:** Dragon Age: Origins had six playable origins. They were the first two hours of play.
  - Dan Tudge said the choices made in them "change the lens on the way you perceive the world" and how the world sees the player.
  - Two origins were cut for time.
- **Why it worked:** the player arrives at the shared story already invested in a personal history.
- **For Loka:** maps to D11 ancestries and scene@1. A full origin act per ancestry is four times the opening. Too costly for one writer.
  - The cheap form is one origin-specific scene or room line per ancestry in the first ten minutes, then the tag lines from 2.1.
- **Engine:** S. **Writing:** high for full origins; low for the cheap form. **Prologue:** the cheap form yes; full origins no.

### 2.3 Backgrounds that cost something (Arcanum, Fallout traits)

- **What:** Arcanum's backgrounds extended Fallout's traits. Each pairs a bonus with a penalty; for example, a knife thrower gains throwing skill but loses perception.
  - Tim Cain's stated goal was that everything on the character screen should have consequences.
  - Some backgrounds were cut for being worthless or overpowered.
  - Both of those points come from an unverified fan summary of Cain's videos (turbo-wiki), not from Cain directly.
- **Why it worked:** a flaw makes the character specific, and pairing a flaw with a bonus is simpler to balance than point-buy.
- **For Loka:** D11's `modifier` has a minimum of 1, so a penalty needs a schema and contract change (M).
  - Alternative without the change: a W8 permanent status applied at birth, with a 2c negative modifier. This needs the choice to apply a status (also M).
- **Engine:** M. **Writing:** low. **Prologue:** later.

### 2.4 Low stats change what the character can say (Fallout 1 and 2)

- **What:** Fallout gave a character with very low intelligence a separate set of grunting dialogue.
  - Cain took the idea from a tabletop game, where he told a low-INT player to speak in one-syllable words. This origin story comes from the same unverified fan summary; GamesRadar confirms his low-INT playthrough.
  - He later contrasted Fallout's "dumb dialogue really cut things off" with The Outer Worlds' gentler, naive version.
  - The exact INT threshold is disputed between sources. (Inference.)
- **Why it worked:** a stat becomes a voice, not only a number. It is also the most remembered replay in the series.
- **For Loka:** maps to `stat_compare` (attribute@1) as the policy on a dialogue@1 branch. It already reads the selected character's value.
  - Use it on two or three key NPCs, in the naive form rather than one that cuts content.
- **Engine:** S. **Writing:** medium; it doubles the lines on the NPCs that use it. **Prologue:** yes, light.

### 2.5 Characters marked by their history (Wildermyth)

- **What:** Wildermyth mixes handcrafted campaign beats with procedural events. Characters change permanently, gaining scars, transformations, relationships and titles.
  - Nate Austin described the game as alternating handcrafted and procedural layers.
  - His GDC 2022 talk was on getting players emotionally invested in procedural characters.
- **Why it worked:** a visible mark ties a character to a remembered event, so the player builds the arc in their own head. (Inference.)
- **For Loka:** the chain already exists:
  - a W8 permanent status, such as a scar from a C3 hound bite;
  - a W6 name or description variant that reads it;
  - an FD9 earned title from a codex badge;
  - FD10 asides and NPC dialogue gated with `status_active` (SR1).
- **Engine:** S. **Writing:** low; one status label and one or two reactions. **Prologue:** yes.

### 2.6 Visible progress clocks and drafted dice (Citizen Sleeper)

- **What:** Gareth Damian Martin took clocks and dice agency from Blades in the Dark.
  - Clocks are segmented circles that fill one step at a time and track reputation or a threat.
  - The player rolls a pool of dice each cycle and chooses where each die goes.
  - Martin called the game an experiment in a "minimum viable" version of the idea.
- **Why it worked:** pressure can be read at a glance, and a die placed by the player feels like a choice, not luck.
- **For Loka:** a clock is a W2 bounded int fact plus a reaction at its maximum. The engine has both.
  - The Book shows no segmented clock today. That UI is new (M, designer).
  - W24 quest deadlines cover the time-pressure half already.
- **Engine:** M (Book UI). **Writing:** low. **Prologue:** later.

---

## 3. Reputation, menace and world response

### 3.1 Fame and infamy on two scales (Fallout: New Vegas)

- **What:** Each New Vegas faction tracks fame and infamy as two separate numbers. Their combination gives the reputation tier, so a mixed reputation is possible.
  - Positive or negative reputation is never removed, only outweighed.
  - Sawyer, in an interview: angering one faction delights another.
  - The mechanics come from fan wikis, and Sawyer's own design reasoning is in a GDC 2012 talk not reviewed here. (Inference.)
- **Why it worked:** "helped them and hurt them" becomes a state of its own, which a single number erases. NPCs can then respond to that ambivalence.
- **For Loka:** maps to standing and disposition (rows 15 and G11). Use two W2 instance facts per faction instead of one.
  - The disposition `hostile` and `friendly` conditions combine them with `all` and `any`, so wary covers the mixed case.
  - No leaf is added.
- **Engine:** S. **Writing:** low; the mixed tier needs one or two lines per faction NPC. **Prologue:** yes; the Village and the Priory are enough.

### 3.2 Menaces: failure that builds into a place (Fallen London)

- **What:** In Fallen London, failing a check raises the menace tied to that stat: Nightmares, Suspicion, Wounds or Scandal.
  - A menace that reaches a threshold sends the character to a side location to work it off. Scandal, for example, leads to exile in the Tomb-Colonies.
  - Players describe letting a menace run high as fun in itself. Sources are fan wikis and press, not Failbetter's own design notes.
- **Why it worked:** failure turns into content, not a dead end. One threshold reaction serves many checks.
- **For Loka:**
  - Build a menace as a W2 bounded instance fact, not a per-player fact. Reactions on `check_failed` and on FD5-witnessed offenses raise it with `fact.adjust`, as the dial puzzle in the sequence-puzzle section already does with an instance fact. This sidesteps the rule that the player's body is never a reaction subject.
  - Arrest and trial (row 35) already relocates the body to `arrest.to` at a hostile disposition. That is the Suspicion case. Jail (row 36) has no section in `mechanics.md`, so it is not built.
  - Wounds is close to death@1 plus W8.
- **Engine:** S. **Writing:** low to medium; one destination scene per menace. **Prologue:** yes, for one menace (Suspicion, through the watch).

### 3.3 Deeds that travel ahead of the player (gossip)

- **What:** in Witcher 3 terms, a consequence the player hears about before they see it is telegraphed (1.1). Loka already has the transport for news.
- **For Loka:**
  - The FD5 witness ledger writes what an NPC saw.
  - W3 rumour by co-presence passes that fact from carrier to listener as schedules (W10) move NPCs, even while the player is away.
  - The listener's dialogue or W6 mood then reads it.
  - The W3 limit stands: the author names each carrier and each listener.
- **Evidence:** this is a composition of 1.1 with Loka's own systems. No game is cited for the exact pattern. (Inference.)
- **Engine:** S. **Writing:** low; one reaction line per listener. **Prologue:** yes.

### 3.4 Recurring named enemies who remember (Shadow of Mordor's Nemesis system)

- **What:** In Shadow of Mordor, orcs who kill or escape the player are promoted, remember the encounter, and come back changed.
  - Michael de Plater cited multiplayer rivalry and pro sports as the inspiration.
  - An early version had more layers and was stripped back as "overcomplicated".
- **Why it worked:** an ordinary enemy becomes a personal story through memory plus a visible mark.
- **For Loka:** without the generated hierarchy:
  - one authored foe that can flee (C4, W21 fear);
  - a W8 scar;
  - a pair fact counting meetings (W2);
  - W15 recognition so its displayed name changes;
  - a W6 mood on its return.
  - Promotion and generation are out of scope.
- **Engine:** S. **Writing:** low to medium. **Prologue:** later; one recurring Fen foe would fit a chapter 2.

### 3.5 NPC schedules that carry story (Ultima VI and VII)

- **What:**
  - Ultima VII NPCs follow daily routines. A schedule file allows up to eight entries per NPC: sleep, eat, work, go home.
  - Ultima IX dropped schedules and was received worse.
  - Ultima Codex essays credit schedules with making towns feel inhabited.
- **For Loka:** built as schedule@1, W10 conditional schedules and W26 NPCs using doors.
  - The new angle is to use a schedule as a clue. Where an NPC is at an hour tells the player something, and a W10 conditional branch moves them when a story fact changes.
- **Engine:** S. **Writing:** none to low. **Prologue:** yes, already in use.

---

## 4. World simulation and emergent story

### 4.1 History told as biased accounts (Caves of Qud)

- **What:** Grinblat and Bucklew's 2017 paper, "Subverting Historical Cause & Effect", generates mythic biographies of past rulers.
  - The paper contrasts this with Dwarf Fortress's deep simulation.
  - Summaries say the history is presented as accounts, such as word of mouth and ancient texts, which allows bias and conflicting versions.
- **Why it worked:** the player meets history as testimony to weigh, not as fact. That is cheaper and more interesting than simulating it.
- **For Loka:** procedural text conflicts with the owner-writes-everything rule, so do not generate. Keep the presentation idea:
  - two or three readable@1 texts or NPC tellings of one event that disagree;
  - each grants a topic (topic@1);
  - a row 46 deduction reconciles them.
- **Engine:** S. **Writing:** medium. **Prologue:** yes, for one Priory event.

### 4.2 Legends as a readable chronicle (Dwarf Fortress)

- **What:** Dwarf Fortress's Legends mode lets players read the histories of the world. Tarn Adams says a whole class of players reads it without playing the main modes.
  - His essay names description, mechanics and player agency as the three sources of emergent narrative.
- **For Loka:** the Chronicle (FD6) already projects the player's own receipts by day. Making it read as a story depends on the narration lines the owner already writes. No new work.
- **Engine:** none. **Writing:** none. **Prologue:** yes, built.

### 4.3 Generated quests (Skyrim's Radiant Story): a caution

- **What:** Radiant Story fills quest slots (place, actor, item) at run time from a story manager.
  - The results are mostly simple fetch and kill tasks.
  - Lead designer Bruce Nesmith said it was "really easy going too far", and that a generated main story would play horribly.
- **For Loka:** do not adopt for the prologue. Hand-placed repeatable work, such as Homestead jobs and timed job claims (20b), covers "always something to do" without generic text.
- **Engine:** -. **Writing:** -. **Prologue:** no.

### 4.4 The ordinary person in a harsh world (Kenshi)

- **What:** Chris Hunt dislikes the chosen-one trope. In Kenshi the player starts no stronger than anyone else.
  - He says a writer's job is to torment the protagonist, and that too many games let the player succeed.
  - He built most of it alone over about 12 years.
- **For Loka:** this is a stance, not a system. Diku combat, Deep Fen exposure (W25) and the death penalty (row 47) already make the world indifferent. The prologue can keep the player small.
- **Engine:** none. **Writing:** none. **Prologue:** yes, as tone.

### 4.5 Permadeath as immersion (Armageddon MUD): a caution

- **What:** Armageddon had no resurrections, apart from staff errors, and enforced staying in character. Its own pages say permadeath "intensifies this immersion".
  - Its karma gate was staff-judged and disputed by players.
- **For Loka:** no. death@1 is a same-body return by design. Keep death's weight through the row 47 penalty and 1.4's acknowledgement.
- **Engine:** -. **Writing:** -. **Prologue:** no.

---

## 5. Knowledge, exploration and freedom

### 5.1 Knowledge is the only key (Outer Wilds)

- **What:** Outer Wilds has no upgrades. Progress is limited only by what the player knows.
  - The ship log maps what the player has learned and what is left to explore.
  - Kelsey Beachum's writing talk: players don't always get the knowledge they look for, but it always steers them somewhere useful.
- **Why it worked:** the reward is the player's own understanding, which no stat can grant.
- **For Loka:** maps to row 46, the lore codex and deduction. The Journal lists known topics and offers a deduction when two topics are known. FD7 lets the player ask NPCs about a topic.
  - The new step is to gate a barrier or a scripted action on a topic fact rather than on an item.
  - Check toolbox trap 8 first. It bars standing tiers as gates; topics may be treated differently. (Inference; verify with PM.)
- **Engine:** S. **Writing:** low to medium. **Prologue:** yes, for one knowledge-gated place.

### 5.2 Text as the cheapest scene (Roadwarden)

- **What:** Roadwarden is a mostly solo-built, illustrated text RPG made in Ren'Py.
  - Aureus, its developer, says narration lets one writer handle scenes that would otherwise need "another 10 to 40 employees", and that the format avoids grind.
  - Dialogue changes with the character's "health, emotions, and personal goals", and the game runs across "the slow slide into autumn".
  - Aureus also says a bigger game is beyond one person.
- **Why it worked:** a single writer controls scope, and the text carries what art would cost.
- **For Loka:** this is the closest analog to Loka.
  - Health and emotion map to description variants and W6 moods reading `resource_compare` or `status_active`.
  - The seasonal slide is derived sky (31, W5).
  - The scope warning supports a short prologue.
- **Engine:** S. **Writing:** medium. **Prologue:** yes.

### 5.3 Short chunks and tested text (inkle: 80 Days, Heaven's Vault)

- **What:**
  - Jon Ingold's GDC 2015 talk covered usable lengths of text, choice design and pacing across three inkle games.
  - In Heaven's Vault, inkle built automated testing into the writing workflow.
  - ink, inkle's writer-first scripting language, keeps text and logic together.
- **For Loka:** keep room text short enough for one phone screen. Test each new gated line with a sampler, as the toolbox slices already do (`cartridges/*_sampler`).
- **Engine:** none. **Writing:** none; it lowers load. **Prologue:** yes.

### 5.4 Fewer words (Sunless Sea, Sunless Skies)

- **What:** Reviewers felt Sunless Sea's roguelike repetition sapped its stories. Chris Gardiner said the main lesson from Sunless Skies was to write fewer words.
  - Alexis Kennedy's postmortem (Gamasutra) also covers the design cuts of about 30 percent made before the Kickstarter.
- **For Loka:** for the prologue, cut text that repeats after a death or a revisit. W7 visit tiers already shorten a room's text on later visits.
- **Engine:** none. **Writing:** lowers it. **Prologue:** yes.

---

## 6. Companions and interface

### 6.1 Loyalty that decides who survives (Mass Effect 2)

- **What:** In Mass Effect 2, each squad member has a personal loyalty mission. In the final mission, a disloyal or poorly placed member can die a permanent, story-based death.
  - Casey Hudson said this is "part of what makes the final mission dangerous in a more profound way".
  - He said investing time in the crew raises the chances of success.
  - He said the team grew to ten members partly because keeping everyone alive was hard.
  - A dead member does not appear in Mass Effect 3.
  - A GamesBeat critic argued the danger was overhyped, since most players kept most of the squad alive.
- **Why it worked:** time spent on a companion is paid back in a high-stakes moment. The player feels the companion's survival as their own doing. (Inference.)
- **For Loka:**
  - Built: hireling wages and loyalty (22b), the G8 group, escort@1 and FD10 asides that read facts on room entry.
  - Pattern: one companion with a loyalty pair fact (W2). A personal errand raises it. A later danger beat, such as a protect objective (row 38) or a C4 flight, reads the fact to decide whether the companion holds or breaks.
  - Asides: one for each place that matters and each fact that matters, never repeated.
- **Engine:** S to M, depending on whether 22b loyalty can gate a combat or flight outcome. (Inference; verify.) **Writing:** medium. **Prologue:** later. A prologue companion with asides alone is S and low.

### 6.2 A whole clan that hears the world differently (Vampire: The Masquerade, Bloodlines)

- **What:** Bloodlines' Malkavian clan has its own dialogue throughout. Brian Mitsoda wrote most of it, from an idea by Chad Moore.
- **For Loka:** no. It is a second script for one ancestry. The affordable form already exists: Hill-folk dark sight changes what that player perceives, not what they say.
- **Engine:** -. **Writing:** high. **Prologue:** no.

### 6.3 The world shown through senses and time

- **What:** sound, light and time of day are standard immersion tools. No single primary source was reviewed. (Inference.)
- **For Loka:** built:
  - G6 sense cues;
  - FD8 ambient lines by sky and hour;
  - derived sky and season (31);
  - B4 light and darkness;
  - W25 exposure.
  - The Book is itself diegetic: a journal the character keeps.
  - New and optional: phone haptics on a hit or a death, as a Book designer decision.
- **Engine:** S to M. **Writing:** low. **Prologue:** yes for the text; haptics later.

---

## 7. Pacing

Pacing techniques from the entries above, gathered in one place. Each maps to a system Loka has built.

- **Short, personal opening.** Dragon Age: Origins spent its first two hours on the origin (2.2). For a 3 to 5 hour prologue, one origin-flavoured scene in the first ten minutes is the proportional form.
- **Withhold, then pay off.** Sasko: withhold information so the player wants it (1.1). Unofficial summaries of the same talk add "play, show, then tell", in that order. (Unverified.)
- **Ration a character's talk.** Hades allows one conversation per return visit (1.4). In Loka: gate each option on a fact that resets when the player leaves the room.
- **Shrink what repeats.** Sunless Sea's repetition sapped its stories (5.4). In Loka: W7 visit tiers shorten text on revisits, and death-loop text should not repeat.
- **Fit the text to the screen.** inkle treats usable text length as a design limit (5.3). One phone screen per room page.
- **End on a return.** Pentiment saves the visible consequences for its last act (1.2). End the prologue with a revisit to the Village.

---

## 8. Techniques that multiply a solo writer's words

Storylets and quality-based narrative (QBN) work as an **authoring discipline on systems Loka already has**. They do not need a deck. The FD3 deck was retired, and opportunities are actions on person and fixture pages.

1. **Storylets as cards on pages.**
   - Emily Short defines a storylet as content plus prerequisites plus effects. She calls them "simple, atomic, robust, and recombinable", and says they can be prototyped on index cards.
   - In Loka the prerequisite is a policy, the content is a dialogue@1 option or a scripted_action@1 on a page, and the effect is `fact.assign` or `fact.adjust`.
   - Each one is independent, so adding one never breaks another.
   - Short's warning is that a story which branches and never recombines loses the benefit. Keep facts few and shared.
2. **Qualities, not branches.**
   - Failbetter's QBN moves numbers on a scale instead of choosing a branch, so a relationship builds from many small choices.
   - Short notes that QBN handles gathering information in any order without the duplicate content that naive branching needs.
   - In Loka: W2 bounded facts, standing (15) and pair trust. One bounded fact can gate many lines, and the same line can serve players who arrive by different routes.
   - Pillars of Eternity is the counter-example: a developer said in a Deadfire interview that the first game packed in content but did not respond enough to the player's choices. Few facts and many gated lines beat a lot of content that ignores the player.
   - Failbetter has since dropped the QBN name. A secondary source says Kennedy proposed "resource narrative". (Unverified.)
3. **Salience: the most specific line wins.**
   - Short coined "salience-based narrative": pick from a pool the piece that best fits the current state.
   - Loka already works this way. Description variants, W6 moods and name variants show "the first whose `when` holds", with a mandatory base text.
   - Ordering variants from most to least specific means each new line covers one more case and never breaks the base. A writer can add depth one line at a time.
4. **Menace and progress qualities.**
   - Short lists a progress stat and a menace stat as the tools that rebuild classic structures out of storylets.
   - In Loka: a W24 deadline or a quest stage as progress, and a bounded fact plus a threshold reaction as menace (3.2). Failure then lands somewhere the owner has already written.
5. **Tags.**
   - One tag gates many optional lines (DOS2, 2.1). In Loka, the D11 `faction` fact and G1 property tags.
   - Keep tags orthogonal: never write a line that needs two origin tags (Larian's lesson).
6. **Systemic text.**
   - Let the engine assemble what it can from authored fragments, so the owner writes words once:
     - name words group "two cowering goblins";
     - moods change a name;
     - W7 alternates vary repeated lines by hash;
     - narration visit tiers shorten text on revisits;
     - sense cues and ambient lines combine sky and hour.
   - Each fragment is written once and reused across states.
7. **Consequence as a variant of a known place.**
   - A changed room (1.2) or a changed NPC mood costs one variant. A new quest costs pages. Spend words where the player has already been.

---

## 9. Top 12 by value per cost

Owner writing load is weighted at least as heavily as engine cost.

| # | Innovation (source) | Loka system | Engine | Writing | Prologue |
|---|---|---|---|---|---|
| 1 | Delayed, telegraphed consequences (Witcher 3) | W2 fact + FD1 delayed reaction + W6/FD10 telegraph | S | low | yes |
| 2 | Two or more routes past every blocker (Deus Ex) | rows 13, G12, G4, 16, 14, 11, 30 | S | low | yes |
| 3 | Fame and infamy as two facts (New Vegas) | standing 15 + disposition G11 | S | low | yes |
| 4 | Origin tag gating a few lines (DOS2) | D11 `AncestrySpec.faction` + `fact_compare` | S | low | yes |
| 5 | Menace with a threshold destination (Fallen London) | W2 bounded instance fact + `check_failed`/FD5 reactions + arrest 35 | S | low-med | yes |
| 6 | Deeds travel ahead of the player (gossip) | FD5 witness → W3 rumour → W6 mood | S | low | yes |
| 7 | Marks of history: scar, mood, title (Wildermyth) | W8 + W6 + FD9 + SR1 asides | S | low | yes |
| 8 | Salience-ordered variants as the storylet habit (Emily Short) | description variants, W6, W7 | S | low (multiplies) | yes |
| 9 | Knowledge as the key (Outer Wilds) | row 46 codex/deduction + FD7 + topic-gated action | S | low-med | yes |
| 10 | Return visit shows consequences (Pentiment) | room and NPC variants + W27/FD6 | S | med | yes |
| 11 | Death advances the shrine keeper's dialogue (Hades) | death@1 + death-count fact + once-per-visit gate | S-M | med | yes |
| 12 | Naive low-stat dialogue (Fallout) | `stat_compare` on dialogue@1 | S | med | yes |

Next tier, all later: chapter carry-over (row 48, L); penalty backgrounds (Arcanum, M); segmented clocks (Citizen Sleeper, M); a recurring remembered foe (Nemesis-lite, S).

Rejected for the prologue: generated quests (Radiant Story), permadeath (Armageddon), full origin acts (Dragon Age: Origins) and a per-ancestry second script (Bloodlines).

---

## Sources

Primary or near-primary (developer talks, postmortems, interviews, papers):

- Sasko, GDC 2023, quest design lessons (write-up): https://www.gamedeveloper.com/marketing/10-key-takeaways-from-the-quest-design-of-cyberpunk-2077-and-the-witcher-3 ; Vault: https://gdcvault.com/play/1028897/10-Key-Quest-Design-Lessons
- Emily Short, "Storylets: You Want Them": https://emshort.blog/2019/11/29/storylets-you-want-them/
- Emily Short, "Beyond Branching: Quality-Based, Salience-Based, and Waypoint Narrative Structures": https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/
- Kennedy, GDC talk transcript on choice and consequence: https://benbridle.com/choice-complicity-consequence.html ; Vault: https://gdcvault.com/play/1023346/Choice-Consequence-and
- Failbetter QBN interview: https://indieorama.com/failbetter-games-interview-alexis-kennedy-hanna-flynn
- Haywire on QBN qualities: https://haywiremag.com/features/devils-and-dirigibles/
- Sunless Sea postmortem (Kennedy): https://www.gamedeveloper.com/audio/postmortem-failbetter-games-i-sunless-sea-i-
- Gardiner on writing fewer words (Sunless Skies): https://www.pcgamer.com/failbetters-next-games-are-likely-to-play-very-differently-from-sunless-sea-and-sunless-skies/
- Spector, Deus Ex postmortem (2000): https://www.gamedeveloper.com/view/feature/131523/postmortem_ion_storms_deus_ex.php ; GDC 2017 classic postmortem: https://gdcvault.com/play/1024338/Classic-Game-Postmortem-Deus-Ex ; principles summary: https://en.wikipedia.org/wiki/Development_of_Deus_Ex
- Spector on Ultima VI improvisation: https://ultimacodex.com/2017/03/how-ultima-6-taught-warren-spector-that-improvised-gameplay-was-magical/
- Ultima VII schedules: https://wiki.ultimacodex.com/wiki/Ultima_VII_internal_formats_%E2%80%93_SCHEDULE.DAT ; https://ultimacodex.com/2015/06/what-ultima-vi-can-teach-you-about-npcs/ ; https://lycaeum.ultimacodex.com/npc-schedules/
- Kasavin and Korb, GDC 2021, "Breathing Life into Greek Myth: The Dialogue of Hades": https://gdcvault.com/play/1026975/Breathing-Life-into-Greek-Myth ; Kasavin interviews: https://www.screenhub.com.au/?p=1429512 ; https://geekdad.com/2019/10/narrative-and-early-access-supergiants-greg-kasavin-discusses-hades-development/
- Pentiment, Sawyer interviews: https://www.thegamer.com/interview-obsidian-josh-sawyer-pentiment/ ; https://gamebanshee.com/xrykp ; Franznick: https://www.superjumpmagazine.com/crafting-pentiments-medieval-narrative/
- Mass Effect save import: https://kotaku.com/mass-effect-2-carried-over-700-plot-hooks-from-origin-5492759 ; https://www.gameinformer.com/b/news/archive/2009/12/27/bioware-breaks-down-mass-effect-2-save-import.aspx ; https://gamebanshee.com/kw8f6 ; Hudson on ME2 saves: https://www.gematsu.com/2010/02/bioware-mass-effect-2-saves-might-not-work-in-mass-effect-3
- Dragon Age: Origins origins: https://gamebanshee.com/interviews/28249-dragon-age-origins-interview/all-pages.html ; https://www.thegamer.com/dragon-age-origins-cut-origin-stories-human-commoner-barbarian/
- DOS2 tags and origins: https://rpgcodex.net/article.php?id=10297 ; https://pcgamer.com/the-making-of-divinity-original-sin-2 ; https://gamedeveloper.com/design/-we-had-to-scramble-devs-reflect-on-the-making-of-i-divinity-original-sin-2-i-
- Arcanum backgrounds (preview): https://www.gamespot.com/articles/arcanum-updated-preview/1100-2659710/
- Fallout low-INT, Cain: https://www.gamesradar.com/platforms/pc-gaming/fallout-creator-tim-cain-reveals-two-playthroughs-key-to-the-rpgs-history-his-low-int-hero-named-potato-and-a-mass-murderer-who-made-them-check-the-entire-game-again ; https://gameworldobserver.com/2022/11/18/tim-cain-fallout-inverview-reactivity-rpg-system-professional-limits
- New Vegas reputation, Sawyer: https://gamebanshee.com/kwwc8 ; mechanics (fan wiki): https://fallout-archive.fandom.com/wiki/Fallout:_New_Vegas_reputations
- Wildermyth, GDC 2022 (Austin): https://gdcvault.com/play/1027614/Independent-Games-Summit-Session-Getting ; https://gamemakersnotebook.libsyn.com/balancing-procedural-and-intimate-storytelling-in-wildermyth
- Citizen Sleeper, Martin: https://rascal.news/flatmates-in-space-gareth-damian-martin-talks-genre-and-citizen-sleepers-tabletop-destiny ; https://www.gamedeveloper.com/business/how-citizen-sleeper-was-inspired-by-tabletop-rpgs-and-gig-work
- Shadow of Mordor Nemesis, de Plater: https://www.pcgamer.com/shadow-of-mordors-nemesis-system-inspired-by-multiplayer-sports ; https://www.gameinformer.com/b/news/archive/2015/01/20/shadow-of-mordor-s-nemesis-system-was-once-a-bit-more-complicated.aspx ; https://gamesbeat.com/shadow-of-mordors-nemesis-system-draws-from-burnout-football-and-an-architecture-book/
- Caves of Qud, Grinblat and Bucklew (2017): https://pcgworkshop.com/archive/grinblat2017subverting.pdf ; GDC 2018: https://gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves
- Dwarf Fortress, Adams: https://wileywiggins.com//documents/dorf/Adams%20-%20Characterization%20and%20Emergent%20Narrative%20in%20Dwarf%20F.pdf ; https://gamasutra.com/design/q-a-dissecting-the-development-of-i-dwarf-fortress-i-with-creator-tarn-adams
- Skyrim Radiant Story, Nesmith: https://gamesbeat.com/bethesdas-nesmith-reflects-on-the-difficult-birth-of-skyrims-radiant-story-system/ ; https://skyrimck.uesp.net/wiki/Radiant_Story
- Kenshi, Hunt: https://www.pcgamer.com/games/survival-crafting/too-many-games-let-their-players-succeed-says-developer-of-notoriously-tough-survival-rpg-kenshi-and-thats-mind-numbingly-boring-to-me ; https://www.siliconera.com/kenshis-eight-year-development-journey-from-one-man-rpg-to-a-teams-success/
- Armageddon MUD: https://armageddon.org/intro/roleplaying/intro_to_rpi ; https://en.wikipedia.org/wiki/Armageddon_(MUD)
- Discworld MUD vs WoW quests (Karlsen, Game Studies 2008): https://gamestudies.org/0801/articles/karlsen
- Outer Wilds, GDC 2020 and 2021: https://www.gdconf.com/news/attend-gdc-and-learn-how-outer-wilds-nailed-curiosity-driven-game-design ; https://www.gamedeveloper.com/design/live-die-repeat-how-i-outer-wilds-i-piques-curiosity-in-an-ambivalent-solar-system
- Roadwarden, Aureus: https://www.avclub.com/roadwarden-developer-interview ; https://www.techradar.com/features/how-roadwarden-converted-tabletop-ideas-into-a-game-of-choice
- inkle, Ingold GDC 2015: https://gdcvault.com/play/1021775/Adventures-in-Text-Innovating-in ; 80 Days postmortem: https://gdcvault.com/play/1021665/80-DAYS-Post-mortem-Letting ; ink talk: https://gdcvault.com/play/1023221/Ink-The-Narrative-Scripting-Language
- Bloodlines Malkavian dialogue, Mitsoda: https://gaming-ga.blogspot.com/2010/08/brian-mitsoda-talks-vampire-bloodlines.html ; https://rpgcodex.net/article.php?id=11155

- Mass Effect 2 loyalty and the final mission, Hudson: https://www.straight.com/node/30651 ; https://gizmodo.com/5452168/alien-love-scenes-strange-allies-and-blade-runner-in-mass-effect-2 ; https://www.destructoid.com/?p=72605 ; critique: https://gamesbeat.com/mass-effect-2s-suicide-mission-is-a-little-premature/ ; summary: https://en.wikipedia.org/wiki/Suicide_Mission_(Mass_Effect_2)
- Pillars of Eternity reactivity (Deadfire interview): https://www.gamebanshee.com/k949x

Secondary sources, used only where the text flags them:

- Fallen London menaces: https://en.wikipedia.org/wiki/Fallen_London ; https://fallenlondon.wiki/wiki/Forum:Menaces
- Cain on Arcanum backgrounds and on the tabletop origin of low-INT dialogue (unverified fan summaries of his videos): https://turbo-wiki.pages.dev/tim-cain/arcanum/arcanum-backgrounds ; https://turbo-wiki.pages.dev/tim-cain/narrative-design/the-origin-of-dumb-dialog

Not relied on (unverified fan or aggregator pages that searches returned): saschb2b.github.io, shapes.inc, gamegeeker, and the cavac and IPFS mirrors.

Loka sources read:

- `docs/system/mechanics.md`: D11, standing and disposition, W3, row 46, W27, FD6, death@1, FD3 retirement at line 3395, FD1, FD5, FD7, FD10, W15/FD9.
- `docs/MECHANICS-TOOLBOX.md`: the ranked table.
- `protocol/cartridge.schema.json`: `AncestrySpec`, with `modifier` minimum 1 and the single `faction` fact.
- `docs/rnd/`: headings of the prior notes.
