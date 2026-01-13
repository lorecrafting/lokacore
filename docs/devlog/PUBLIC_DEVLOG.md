# Loka Public Development Log

*A narrative journey through 27 days of building a text-based RPG engine*

---

# Week 1: The Pivot

## Day 1-2: "What Have I Gotten Myself Into?"

It started with a simple idea: build a text-based RPG for mobile.

I spent the first day wrestling with React Native, EAS builds, and App Store configurations. By hour 6, I had more YAML files than actual game code. The deployment kept failing. The builds were slow. The App Store wanted a privacy policy for my game that didn't exist yet.

Then I asked myself a dangerous question: *Why am I doing this?*

The App Store takes 30% of revenue. Reviews take a week. One rejected build and I'm starting over. And for what? A web browser can do everything I need.

**The pivot happened at 11pm.** I deleted the mobile folder and typed `mix phx.new`.

Phoenix LiveView gives me real-time updates. WebSockets. Server-rendered HTML. No app stores. No gatekeepers. Just a URL.

By midnight, I had a working deployment on Fly.io. Cost: $5/month.

Sometimes the best code is the code you don't write.

---

## Day 3-5: Building the Bones

With the platform decision made, I could focus on what matters: the engine.

A MUD (Multi-User Dungeon) engine needs a few core things:
- **Entities** - Things that exist in the world (players, NPCs, items)
- **Rooms** - Spaces where entities live
- **Commands** - How players interact with the world
- **Events** - How the world reacts

I chose an Entity-Component-Behavior architecture. Instead of inheritance (`Player extends Character extends Entity`), I use composition. A player is an entity with a `position` component, an `inventory` component, and a `player_input` behavior.

It sounds abstract, but it means I can mix and match features without inheritance nightmares. Want an NPC that can hold items? Give it an `inventory` component. Want a door that can be talked to? Give it a `dialogue` component.

By day 5, I had rooms, movement, and basic commands working.

The engine was a skeleton. Time to give it flesh.

---

# Week 2: The World Takes Shape

## Day 6-8: "The Jeweled Path"

Every game needs a setting. I chose a Buddhist monastery.

Why Buddhist? A few reasons:
1. Rich philosophical content (quests with meaning, not just fetch-10-bear-asses)
2. Peaceful aesthetic (a break from grimdark)
3. Interesting setting (temples, gardens, meditation halls)
4. Personal interest (I find the philosophy fascinating)

I called it "The Jeweled Path" - a reference to the Buddhist concept of the Noble Eightfold Path.

**The world came together piece by piece:**

- The Temple Courtyard (starting area)
- The Main Hall (where Abbot Jampa holds court)
- The Meditation Garden (peaceful, with a koi pond)
- The Library (ancient texts, a scholarly NPC)
- The Kitchen (the tea vendor, my favorite character)
- 21 more rooms...

Each room needed:
- A short description (one line)
- A long description (2-3 sentences of prose)
- Exits to other rooms
- Items and NPCs

**The hardest part was the writing.**

Room descriptions need to paint a picture in 50 words or less. Too short and it's boring. Too long and players skim. Every word has to earn its place.

```
The meditation garden unfolds before you, a carefully raked sea of
white gravel surrounding islands of moss-covered stone. Cherry trees
frame the space, their branches bare in winter's grip. A wooden
bench faces a small koi pond where golden shapes drift lazily.
```

26 rooms. 10+ NPCs. One intro cutscene. By day 8, the demo world existed.

---

## Day 9: The Christmas Eve Security Audit

December 24th. I should have been wrapping presents.

Instead, I ran a security audit. What I found wasn't pretty:

- JWT tokens that never expired (login once, access forever)
- No rate limiting (spam the API all day)
- User input going straight to the database (SQL injection waiting to happen)
- Passwords in logs (seriously, past-me?)

**Christmas Eve was spent fixing everything.**

Security is the work nobody sees. Nobody notices good security until it's missing. Nobody thanks you for preventing the breach that never happened.

But every vulnerability is a ticking time bomb. Ship secure or don't ship.

By midnight, the codebase was clean. Rate limiting. Token rotation. Input sanitization. Log scrubbing.

Merry Christmas to me.

---

## Day 10-11: The Quest System

"Go talk to the Abbot."

Simple, right? Player walks to the Main Hall, clicks on the Abbot, quest complete.

Except: How does the game know they talked to the Abbot? How does it know they talked about the right topic? What if they leave mid-conversation? What if they do the quest out of order?

**Quest systems are iceberg problems.** The visible part (a journal entry) is tiny. The underwater part (tracking, validation, edge cases) is massive.

Here's what I built:

**Objective Types:**
- `talk` - Speak to an NPC about a specific topic
- `collect` - Gather N items of type X
- `kill` - Defeat N enemies of type Y
- `go_to` - Visit a specific room

**Quest Chains:**
- Complete Quest A to unlock Quest B
- Branching paths based on choices
- Prerequisite checking

**Timed Objectives:**
- "Collect 5 herbs in 10 minutes"
- Real-time countdown
- Failure states

**The Lua scripting hook:**
```lua
function on_quest_complete(player, quest)
  if quest.id == "intro_meditation" then
    player:give_item("meditation_beads")
    player:say("The beads feel warm in your hands.")
  end
end
```

Two days of work. Hundreds of lines of code. And from the player's perspective? A little checkbox in a journal.

That's game development.

---

# Week 3: Growing Pains

## Day 12-14: The Great Rename

The project was called "ExMUD" - a placeholder name meaning "Elixir MUD."

It was terrible. No soul. No identity. You can't put "ExMUD" on a landing page and expect anyone to care.

I spent an embarrassing amount of time on name generators, Sanskrit dictionaries, and fantasy name websites. Then I found it:

**Loka** - Sanskrit for "world" or "realm."

In Buddhist cosmology, there are different lokas - realms of existence. The human realm, the animal realm, the hungry ghost realm. It fit the theme. It sounded good. It was short enough to type.

The rename touched 50+ files. Config, documentation, deployment, database names. Worth it.

A good name is the first impression. Make it count.

---

## Day 15-17: Content Validation Hell

Here's a fun bug: an NPC references a dialogue that doesn't exist.

The player clicks "Talk to Elder," the game looks for `elder_dialogue`, finds nothing, and crashes. Or worse, fails silently. The player just stares at a frozen screen.

**Content validation became my obsession.**

I built validators for everything:
- Does every room exit point to a real room?
- Does every NPC have valid dialogue?
- Does every quest reference real items?
- Are dialogue trees complete (no dead ends)?
- Do quest chains form valid graphs (no circular dependencies)?

The validators run in CI. Every commit gets checked. If someone creates an NPC that references a non-existent dialogue, the build fails.

**Content bugs are the worst bugs.** They're silent. They hide. They only appear when a player does the exact thing you didn't test. Automated validation catches them before players do.

---

## Day 18-20: Mobile Returns (Smarter This Time)

Remember day 1? The mobile pivot? I'm back, but with a different approach.

The first mobile attempt was native-first. Build for iOS/Android, submit to app stores, wait for approval.

The new approach: **web-wrapped mobile.**

The game is still web-first. The "mobile app" is just a thin Expo wrapper that connects to the same WebSocket as the web client. Same backend, same features, different form factor.

Benefits:
- No App Store review (distribute via web or TestFlight)
- Instant updates (change the server, everyone gets it)
- One codebase (the web version IS the mobile version)
- Guest authentication (play without signing up)

By day 20, the mobile client had full feature parity with web. Combat, dialogue, quests, everything.

Sometimes the best way forward is sideways.

---

# Week 4: The Architecture Rewrite

## Day 21: The Day of 45 Commits

The codebase had a problem: `GameLive` was doing too much.

`GameLive` was a Phoenix LiveView that handled the web UI. But it also handled game logic - movement, combat, dialogue, inventory. When I added the mobile client, I needed that logic... but not the LiveView part.

**Solution: Extract all game logic into transport-agnostic modules.**

I called them "Actions":
- `Game.Actions.Movement`
- `Game.Actions.Combat`
- `Game.Actions.Dialogue`
- `Game.Actions.Economy`
- (10 more...)

The web client calls Actions. The mobile client calls Actions. Any future client calls Actions. The game logic doesn't care where the request came from.

**45 commits in one day.** I started at 8am and finished at 11pm. The old `GameLive` file? Deleted. The codebase was 40% smaller and 100% more maintainable.

It was painful. It was necessary. I don't regret it.

---

## Day 22-23: The AI Integration

Content creation is slow.

Writing room descriptions. Designing NPCs. Crafting quest dialogue. Each piece takes time, and there's never enough content.

So I built a World Builder with Claude integration.

**How it works:**

1. Designer describes what they want: "A mysterious forest with ancient trees and hidden paths"
2. Claude generates a draft (5-10 rooms with descriptions, exits, atmosphere)
3. Designer reviews and refines
4. Validator checks for errors
5. Content saves to the world

**The AI doesn't replace designers.** It gives them a starting point. A first draft is easier to edit than a blank page.

The Claude API handles the generation. The validator catches errors. The human makes the final call.

AI-assisted, human-approved. That's the workflow.

---

## Day 24: Teaching Bots to Play

Manual testing doesn't scale.

I can playtest the intro quest 10 times. I can't playtest it 1000 times. I can't playtest it at 3am when I'm asleep.

**Enter ChannelBot.**

ChannelBot is an automated player. It connects to the server via WebSocket (just like a real player), and it plays the game:

- Navigates rooms (pathfinding)
- Talks to NPCs (dialogue tree traversal)
- Completes quests (objective tracking)
- Reports failures (with full context)

What has it found?
- Dialogue nodes with missing options
- Quest chains that couldn't complete
- Room exits pointing to nothing
- NPC references that didn't exist

**The bot runs in CI.** Every push, the bot plays through the tutorial. If it can't complete, the build fails.

Human creativity designs the content. Bot testing ensures it works.

---

# Day 25: Reflection

25 days. 528 commits. One playable demo.

**What I built:**
- A MUD engine in Elixir
- A Buddhist monastery demo world
- A quest system with branching dialogues
- Combat, crafting, economy systems
- An AI-powered World Builder
- Bot testing infrastructure

**What I learned:**

1. **Web-first removes obstacles.** No app stores. No gatekeepers. Just URLs.

2. **Security is never optional.** Audit early, audit often. The breach you prevent is invisible.

3. **Good prose matters.** In text games, words are graphics. Every sentence has to earn its place.

4. **AI tools are multipliers.** They don't replace human creativity. They give it a head start.

5. **Automated testing finds bugs humans miss.** Bots are tireless. Bots don't get bored. Bots catch the 3am edge case.

6. **Painful refactors are worth it.** The day of 45 commits hurt. The clean architecture was worth it.

7. **Ship something.** A playable demo beats a perfect plan every time.

---

# Week 5: Making It Feel Real

## Day 26-27: The Sound of Silence (Fixed)

Text games are silent by default. That's a problem.

When you walk into a temple, you should hear bells. When it rains, you should hear raindrops. When you're in a cave, the acoustics should feel different.

**The Sound Environment System:**

I built a system that maps room contexts to ambient audio. The meditation hall gets soft chanting. The market gets crowd noise. The mountain peak gets wind.

But here's the thing about audio in games: it's not just about playing sounds. It's about *when to stop*.

The kitchen shouldn't still sound like a kitchen when you walk into the garden. The transition matters. Fade out the cooking sounds. Fade in the birdsong. Make it seamless.

**The Bigger Picture: Immersion Layers**

Sound is just one layer. I also added:

- **Weather effects** - Rain patters on temple roofs differently than on stone paths
- **Time-of-day lighting** - Dawn, midday, dusk, night
- **Seasonal changes** - The garden looks different in winter
- **Ambient messages** - "A distant bell chimes..." delivered at just the right moment

Text games can't show you a sunset. But they can make you feel like you're watching one.

---

## The Testing Problem (Continued)

Remember ChannelBot, the automated player? It got smarter.

**New capabilities:**

- Runs on every PR via GitHub Actions
- Validates all dialogue trees for completeness
- Tests quest chains end-to-end
- Catches content bugs before they ship

The bot found 3 broken quest chains this week that I would have missed. That's the value of automation: it finds the bugs you didn't know to look for.

---

## New Content

The world is growing:

- **4 victory cutscenes** for the endgame (attachment, aversion, ignorance, liberation)
- **2 new NPCs** (Cook Tenzin, Mountain Guide)
- **2 new side quests** (alchemist lesson, cook's apprentice)
- **Rare herbs** scattered across mountain areas
- **30+ room refinements** with ambient details

The monastery feels more alive now. More layered. More like a place you'd want to explore.

---

# What's Next?

The engine works. The demo is playable. The hard part is just beginning.

**Coming soon:**
- More content (new zones, new quests, new NPCs)
- Player housing
- Guild system
- Public alpha

**How to follow along:**
- [itch.io devlog]
- [Twitter @handle]
- [Ko-fi for supporters]

Thanks for reading. See you in Loka.

---

*— Ray, January 2026*

---

# Quick Reference: Social Media Versions

## Twitter Thread (10 tweets)

```
🧵 I built a text-based RPG engine in 25 days. Here's the story:

1/ Day 1: Tried mobile. App Store wanted a privacy policy. Builds failed. Reviews take a week. I deleted everything and built for web instead. Best decision I made.

2/ Day 8: Created "The Jeweled Path" - a Buddhist monastery with 26 rooms. The hardest part? Writing. Room descriptions need to paint a picture in 50 words.

3/ Day 9: Christmas Eve security audit. Found JWT tokens that never expired. Passwords in logs. Spent the holiday fixing vulnerabilities nobody will ever thank me for.

4/ Day 11: Built a quest system. "Talk to the NPC" sounds simple until you handle: dialogue tracking, topic matching, mid-conversation exits, out-of-order completion...

5/ Day 12: Renamed the project from "ExMUD" (boring) to "Loka" (Sanskrit for world). 50+ files changed. A good name is worth the refactor.

6/ Day 20: Mobile is back, but smarter. Same WebSocket as web. No App Store. Full feature parity in 2 days.

7/ Day 21: The 45-commit day. Rewrote the entire architecture to be transport-agnostic. Painful but necessary.

8/ Day 23: Added Claude AI to the World Builder. Designers describe zones, AI generates drafts, humans refine. First drafts are easier than blank pages.

9/ Day 24: Built a bot that plays the game automatically. It found 12 bugs in the first run. Now it tests every commit.

10/ Day 25: 528 commits. One playable demo. The engine works. The hard part - making it fun - is just beginning.

Follow for updates. Loka is coming.
```

## Ko-fi Update

```
🎮 25 DAYS OF LOKA 🎮

The engine is done. The demo is playable.

25 days ago, I started building Loka - a text-based RPG engine. Here's where we are:

✅ 528 commits
✅ Playable Buddhist monastery demo
✅ Quest system with branching dialogue
✅ Combat, crafting, economy
✅ AI-powered World Builder
✅ Automated bot testing

What's next:
→ More content (new zones, quests, NPCs)
→ Player housing
→ Guild system
→ Public alpha

Your support keeps the lights on and the coffee flowing. Every supporter gets early access when the alpha launches.

Thanks for believing in weird text game projects.

☕ [Support on Ko-fi]
```

## itch.io Devlog

```
# Devlog #1: 25 Days to Playable

Hey everyone! First devlog for Loka.

## The Pitch
Loka is a text-based RPG engine built in Elixir. Think classic MUDs meets modern web tech. Real-time multiplayer, branching dialogues, AI-assisted content creation.

## The Demo
"The Jeweled Path" - a Buddhist monastery:
- 26 interconnected rooms
- 10+ NPCs with dialogue trees
- Intro quest line
- Weather and ambient messages

## The Tech (for nerds)
- Elixir/Phoenix backend
- LiveView for web, Expo for mobile
- Claude AI for content generation
- Automated bot testing

## Lessons Learned
1. Web-first beats app stores
2. Security audits suck but matter
3. In text games, writing IS graphics
4. AI tools are multipliers, not replacements
5. Bots find bugs humans miss

## What's Next
More content. More systems. Public alpha.

Follow for updates!

- Ray
```

---

*Copy, adapt, and post. Make it your own.*
