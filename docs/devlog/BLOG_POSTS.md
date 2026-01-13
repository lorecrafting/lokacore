# Loka Development Blog Posts

Ready-to-use blog content for itch.io, Ko-fi, Twitter threads, etc.

---

## Post 1: The Beginning (Dec 16-17)

### Title: "Day 1: Building a MUD Engine in Elixir"

**Short (Twitter):**
Started building Loka today - a text-based RPG engine in Elixir. Spent the first day fighting Docker configs and deployment... then made a big decision: web-first instead of mobile. No App Store gatekeeping. LiveView for everything. Let's go.

**Long (itch.io/Ko-fi):**
Day 1 of building Loka, my Elixir MUD engine.

I wanted to build a mobile text RPG, but after a day of fighting React Native builds and App Store configs, I made a decision that would shape the whole project: **web-first**.

No app stores. No 30% cuts. No waiting for review. Just a URL.

Phoenix LiveView gives me real-time updates with WebSockets, beautiful server-rendered HTML, and deployment that "just works."

The tech stack:
- Elixir/Phoenix (concurrent, fault-tolerant)
- LiveView (real-time web UI)
- SQLite (simple, cheap)
- Fly.io (~$5/month hosting)

Sometimes the best technical decision is the one that removes obstacles.

---

## Post 2: Buddhist Theme & First Content (Dec 23)

### Title: "Creating 'The Jeweled Path' - A Buddhist-Themed Text RPG"

**Short (Twitter):**
Added the first real content to Loka: "The Jeweled Path" - a Buddhist monastery setting. 26 interconnected rooms. NPCs with dialogue trees. Intro cutscene. It's starting to feel like an actual game.

**Long (itch.io/Ko-fi):**
The engine was working. Time to make it a game.

I chose a Buddhist monastery theme - peaceful, contemplative, with rich philosophical content. The demo is called "The Jeweled Path."

What I built this week:
- 26 handcrafted rooms (temple grounds, meditation halls, gardens)
- NPCs with branching dialogue (Abbot Jampa, Teacher Lobsang, the Tea Vendor)
- An intro cutscene that sets the mood
- Weather system (morning mist, afternoon sun)
- Ambient sounds ("temple bells chime in the distance...")

The writing is the hardest part. Every room description needs to paint a picture in 2-3 sentences. Every NPC needs personality in just a few lines of dialogue.

Text games live and die by their prose.

---

## Post 3: The Security Wake-Up Call (Dec 24)

### Title: "Christmas Eve Security Audit (Fixing My Mistakes)"

**Short (Twitter):**
Ran a security audit on Loka. Found multiple vulnerabilities. Christmas Eve was spent fixing JWT tokens, rate limiting, and input validation. Boring but necessary. Ship secure or don't ship.

**Long (itch.io/Ko-fi):**
Christmas Eve. Time for a security audit.

What I found was... humbling:
- JWT tokens with no expiration
- Missing rate limiting
- Unsanitized inputs
- Sensitive data in logs

I spent the day fixing everything:
- Added token refresh endpoints
- Implemented request rate limiting
- Sanitized all user inputs
- Scrubbed logs of sensitive data

Also added:
- Health check endpoints
- Post-deploy smoke tests
- Security scanning in CI

The unsexy work matters. Nobody notices good security until it's missing.

---

## Post 4: The Quest System (Dec 25-26)

### Title: "Building a Quest System from Scratch"

**Short (Twitter):**
Built an entire quest system in 2 days. Objectives (talk, collect, kill, go_to). Quest chains. Timed objectives. Lua scripting for custom logic. Template system for reusable quests. It's... a lot of code.

**Long (itch.io/Ko-fi):**
Quest systems are deceptively complex.

What seems simple ("collect 5 herbs") requires:
- Tracking objective progress
- Checking completion conditions
- Granting rewards
- Updating the journal
- Handling edge cases (what if they drop the herbs?)

Here's what I built:

**Objective Types:**
- `talk` - Speak to an NPC about a topic
- `collect` - Gather items
- `kill` - Defeat enemies
- `go_to` - Visit a location

**Advanced Features:**
- Quest chains (complete A to unlock B)
- Timed objectives (collect herbs in 5 minutes)
- Template inheritance (base quest → specific instances)
- Lua scripting for custom logic
- Dynamic journal entries

The template system is my favorite part. Define a "fetch quest" template once, then create variations:

```yaml
template: fetch_quest
variables:
  npc: tea_vendor
  item: wild_ginger
  count: 3
```

Less copy-paste. Fewer bugs. Faster content creation.

---

## Post 5: The Great Rename (Dec 27)

### Title: "From ExMUD to Loka"

**Short (Twitter):**
Renamed the project from "ExMUD" to "Loka." Sanskrit for "world" or "realm." Better branding. Better identity. Sometimes naming things is the hardest part of programming.

**Long (itch.io/Ko-fi):**
The project needed a real name.

"ExMUD" was a placeholder - "Elixir MUD." Accurate but boring. No soul.

I chose "Loka" - Sanskrit for "world" or "realm." In Buddhist cosmology, there are different lokas (realms of existence). It fits the Buddhist theme and sounds good.

The rename involved:
- 50+ file changes
- Config updates
- Documentation rewrites
- Fly.io app rename

Worth it. A good name matters.

---

## Post 6: Mobile Returns (Jan 3-4)

### Title: "Adding Mobile Support (Without the App Store)"

**Short (Twitter):**
Added mobile support to Loka via Expo. Same WebSocket connection as web. No App Store. Guest auth with device ID. Feature parity with the web client. Web-first doesn't mean web-only.

**Long (itch.io/Ko-fi):**
Remember when I pivoted away from mobile? I'm back, but smarter.

The original mobile approach: native React Native app, App Store submission, 30% revenue cut, week-long review cycles.

The new approach: Expo web view connecting to the same WebSocket as the browser client.

Benefits:
- Same codebase for web and mobile
- No App Store (distribute via web or TestFlight)
- Instant updates (no review process)
- Guest authentication (play without signing up)

The mobile client now has full feature parity:
- All game actions
- Dialogue UI
- Combat
- Inventory management
- Social features

Web-first doesn't mean web-only. It means web-primary.

---

## Post 7: The GameChannel Migration (Jan 4)

### Title: "Rewriting the Architecture (45 Commits in One Day)"

**Short (Twitter):**
Rewrote the game's core architecture today. Migrated from LiveView to Phoenix Channels. 45 commits. Now the same backend serves web AND mobile with identical code. Pain today, gain forever.

**Long (itch.io/Ko-fi):**
Sometimes you need to burn it down and rebuild.

The problem: GameLive (LiveView) was tightly coupled to web rendering. The mobile client needed the same game logic but couldn't use LiveView.

The solution: Extract all game logic into transport-agnostic "Actions" modules. GameChannel calls Actions. LiveView calls Actions. Mobile WebSocket calls Actions.

What I built:
- `Game.Actions.Movement` - Room navigation
- `Game.Actions.Combat` - Battle system
- `Game.Actions.Dialogue` - NPC conversations
- `Game.Actions.Economy` - Buying/selling
- `Game.Actions.Quest` - Quest interactions
- And 10 more...

The migration took 45 commits in one day. The old GameLive.ex? Deleted entirely.

Now the architecture is clean:
```
Mobile App → WebSocket → GameChannel → Actions → Game State
Web Client → LiveView → (deprecated) → Actions → Game State
```

Painful but necessary. The codebase is now properly layered.

---

## Post 8: World Builder (Jan 8)

### Title: "Building an AI-Powered World Builder"

**Short (Twitter):**
Built a World Builder tool for Loka. Visual room editor. NPC/item creation. Quest designer. And... Claude AI integration for generating content. The future of game dev tools is AI-assisted.

**Long (itch.io/Ko-fi):**
Content is the bottleneck.

I can build engine features all day, but without content - rooms, NPCs, quests, items - there's no game. So I built tools to make content creation faster.

**The World Builder includes:**

*Visual Map Editor*
- Drag rooms around
- Draw connections between rooms
- See the whole world at once

*Entity Editors*
- Create NPCs with dialogue trees
- Design items with stats
- Build quests with objectives

*Template System*
- Save room/NPC/item templates
- Instantiate variations quickly
- Batch operations for repetitive tasks

*AI Integration*
- Claude API for content generation
- "Generate a mysterious forest zone"
- Iterative refinement
- Validation before saving

The AI doesn't replace designers - it accelerates them. Describe what you want, get a draft, refine it.

50+ commits in one day. Worth it.

---

## Post 9: Testing with Bots (Jan 5-8)

### Title: "Teaching Bots to Play My Game"

**Short (Twitter):**
Built a bot that plays Loka automatically. Navigates rooms. Talks to NPCs. Completes quests. Finds bugs humans miss. If a bot can beat your game, players probably can too.

**Long (itch.io/Ko-fi):**
Manual testing doesn't scale.

I built ChannelBot - an automated player that connects via WebSocket and plays the game like a real user.

What it does:
- Navigates the world (pathfinding)
- Interacts with NPCs (dialogue trees)
- Completes quests (objective tracking)
- Reports what went wrong

What it found:
- Dialogue nodes with broken links
- Quests that couldn't be completed
- Room exits that led nowhere
- NPC references that didn't exist

The bot runs in CI. Every push gets tested. If the bot can't complete the tutorial, the build fails.

Automated testing catches bugs at 3am so I don't have to.

---

## Post 10: 25 Days of Development (Summary)

### Title: "25 Days Building Loka: What I Learned"

**Short (Twitter):**
25 days. 528 commits. One MUD engine. Here's what I learned building Loka:

1. Web-first removes obstacles
2. Security is never optional
3. Good prose matters more than features
4. AI tools are multipliers, not replacements
5. Automated testing finds bugs you won't

**Long (itch.io/Ko-fi):**
25 days ago, I started building Loka. Here's the journey:

**Week 1: Foundation**
- Pivoted from mobile to web-first
- Set up Elixir/Phoenix/LiveView
- Deployed to Fly.io

**Week 2: Content**
- Built "The Jeweled Path" demo world
- 26 rooms, 10+ NPCs, intro cutscene
- Quest system with Lua scripting

**Week 3: Polish**
- Security audit and fixes
- Renamed project to "Loka"
- Added comprehensive testing

**Week 4: Scale**
- Mobile support via Expo
- GameChannel architecture rewrite
- AI-powered World Builder

**What I learned:**

1. **Web-first removes obstacles** - No app stores, no gatekeepers, just URLs
2. **Security is never optional** - Audit early, audit often
3. **Good prose matters** - Text games live and die by writing quality
4. **AI tools are multipliers** - They don't replace designers, they accelerate them
5. **Automated testing finds bugs** - Bots catch issues humans miss

Next up: More content, more features, and hopefully... players.

---

## Twitter Thread Template

For announcement threads:

```
🧵 Building a text-based RPG engine in Elixir. Here's what I learned in 25 days:

1/ Day 1: Pivoted from mobile to web-first. No App Store fees. No review delays. Just a URL.

2/ Day 8: Built "The Jeweled Path" - a Buddhist monastery with 26 rooms and NPCs with branching dialogue.

3/ Day 10: Security audit found multiple vulnerabilities. Christmas Eve was spent fixing JWT tokens and rate limiting.

4/ Day 12: Quest system complete. Talk/collect/kill/go_to objectives. Quest chains. Timed objectives. Lua scripting.

5/ Day 20: Rewrote the architecture in 45 commits. Migrated from LiveView to Channels for mobile support.

6/ Day 24: Built a World Builder with AI integration. Claude generates content drafts for human refinement.

7/ 528 commits later: The engine works. The demo is playable. Now comes the hard part - making it fun.

Follow along for more updates. Link in bio.
```

---

## Ko-fi/Patreon Milestone Template

```
🎮 DEVELOPMENT UPDATE 🎮

Loka just hit a major milestone!

✅ 528 commits
✅ 25 days of development
✅ Playable demo
✅ AI-powered World Builder

What's Loka? A text-based RPG engine built in Elixir. Think classic MUDs meets modern web tech.

Current features:
• Real-time multiplayer
• Quest system with branching dialogues
• Combat with abilities
• Crafting and economy
• Buddhist monastery demo world

Coming soon:
• More content
• Player housing
• Guild system
• Public alpha

Your support makes this possible. Every coffee keeps the code flowing. ☕

[Support on Ko-fi]
```

---

## itch.io Devlog Template

```
# Devlog #1: From Zero to Playable in 25 Days

Hey everyone!

Just hit a major milestone with Loka - the engine is working and there's a playable demo!

## What is Loka?

A text-based RPG engine built in Elixir. The goal: make it easy to create immersive text adventures with modern features like real-time multiplayer, branching dialogues, and AI-assisted content creation.

## What's in the demo?

"The Jeweled Path" - A Buddhist monastery setting with:
- 26 interconnected rooms
- 10+ NPCs with dialogue trees
- Intro quest line
- Weather and ambient messages
- Combat system

## Tech stuff (for the nerds)

- Elixir/Phoenix for the backend
- LiveView for web, Expo for mobile
- SQLite database
- Claude AI for content generation
- Bot testing in CI

## What's next?

- More content (more zones, more quests)
- Player-created content tools
- Public alpha release

Follow for updates. Thanks for reading!

- Ray
```

---

## Post 11: Immersion Systems (Jan 10-11)

### Title: "Making Text Games Feel Real"

**Short (Twitter):**
Text games are silent by default. Fixed that. Built a sound environment system that maps rooms to ambient audio. Temple bells, market crowds, mountain wind. Added weather, time-of-day, ambient messages. You can't show a sunset in text, but you can make someone feel like they're watching one.

**Long (itch.io/Ko-fi):**
Text games have a problem: they're silent.

When you walk into a temple in a graphical game, you hear bells. In a text game? Nothing. That creates a disconnect.

This week I built a Sound Environment System for Loka. Rooms now have ambient audio based on context:
- The meditation hall gets soft chanting
- The market gets crowd noise
- The mountain peak gets wind

But audio isn't just about playing sounds—it's about *transitions*. When you leave the kitchen for the garden, the cooking sounds should fade out as birdsong fades in.

I also added other immersion layers:
- Weather effects (rain sounds different on temple roofs vs stone paths)
- Time-of-day lighting (dawn, midday, dusk, night)
- Seasonal changes (the garden looks different in winter)
- Ambient messages ("A distant bell chimes...")

Text games can't show you a sunset. But they can make you feel like you're watching one.

---

## Post 12: Automated Testing Wins (Jan 10-11)

### Title: "The Bot That Found 3 Bugs"

**Short (Twitter):**
ChannelBot got smarter this week. Now runs on every PR via GitHub Actions. Validates dialogue trees. Tests quest chains. Found 3 broken quests I would have missed. Automation finds the bugs you didn't know to look for.

**Long (itch.io/Ko-fi):**
Remember ChannelBot, the automated player I built to test Loka?

It got smarter this week:
- Runs on every PR via GitHub Actions
- Validates all dialogue trees for completeness
- Tests quest chains end-to-end
- Catches content bugs before they ship

The results? It found 3 broken quest chains that I would have missed in manual testing.

One quest had a dialogue node that referenced a non-existent option. Another had a circular dependency that made completion impossible. The third had a typo in an NPC reference.

None of these would have crashed the game. They would have just... failed silently. The player would click something, nothing would happen, and they'd assume the game was broken.

That's the value of automated testing: it finds the bugs you didn't know to look for.

---

## READY TO POST: Consolidated Week 5 Update

### itch.io Devlog #2

```markdown
# Devlog #2: Making It Feel Real

Hey everyone! Week 5 update for Loka.

## The Big Theme: Immersion

Text games are silent by default. This week I fixed that.

### Sound Environment System
- Rooms now have ambient audio (temple bells, market crowds, wind)
- Smooth transitions between areas
- Context-aware sound selection

### Other Immersion Layers
- Weather effects
- Time-of-day lighting
- Seasonal changes
- Ambient messages

You can't show a sunset in text. But you can make someone *feel* like they're watching one.

## Testing Gets Serious

ChannelBot (my automated player) now runs on every PR:
- Validates all dialogue trees
- Tests quest chains end-to-end
- Found 3 bugs this week that would have shipped otherwise

## New Content

- 4 victory cutscenes for endgame
- 2 new NPCs (Cook Tenzin, Mountain Guide)
- 2 new side quests
- Rare herbs scattered across mountains
- 30+ rooms refined with ambient details

## What's Next

More content. More polish. Getting closer to a public alpha.

Follow for updates!

- Ray
```

### Twitter Thread (5 tweets)

```
🧵 Week 5 of building Loka, my text-based RPG engine. Theme: immersion.

1/ Text games are silent. Fixed that. Built a Sound Environment System—rooms now have ambient audio. Temple bells. Market crowds. Mountain wind. The transitions are seamless.

2/ But sound is just one layer. Also added: weather effects, time-of-day lighting, seasonal changes, ambient messages. Text games can't show sunsets, but they can make you feel like you're watching one.

3/ Testing update: ChannelBot (my automated player) runs on every PR now via GitHub Actions. It found 3 broken quest chains this week that I would have missed.

4/ New content: 4 victory cutscenes, 2 new NPCs (Cook Tenzin, Mountain Guide), 2 side quests, rare herbs, 30+ room refinements.

5/ The monastery feels more alive now. More layered. More like a place you'd want to explore. Getting closer to public alpha.

Follow for updates. Link in bio.
```

### Ko-fi Milestone Update

```
🎮 WEEK 5 UPDATE 🎮

Loka is getting immersive.

This week:
✅ Sound Environment System (ambient audio for rooms)
✅ Weather, lighting, seasonal effects
✅ Automated testing on every PR
✅ 4 new victory cutscenes
✅ 2 new NPCs + 2 new side quests
✅ 30+ room refinements

The monastery feels alive now. Text games can't show graphics, but they can make you *feel* the world.

Total progress:
📊 27 development days
📊 528+ commits
📊 Playable demo with full quest line

Getting closer to public alpha every week.

Your support makes this possible. ☕

[Support on Ko-fi]
```

---

*Use these templates and adapt them to your voice. The detailed log in DEVELOPMENT_LOG.md has all the specifics if you need to expand on anything.*
