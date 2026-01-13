# Open Product Questions

This document captures the fundamental product direction questions we're still working through. These aren't technical decisions—they're questions about what Loka *is* and who it's for.

---

## The Big Question: How Do Worlds Relate to Each Other?

Loka can generate complete game worlds from story synopses in about two minutes. That's working. But here's what we haven't decided:

**When a player logs in, what do they see? And when they want to experience someone else's world, how do they get there?**

There are three distinct visions for this. Each implies a different product, different audience, and different business model.

---

## Option A: One Giant Connected World

Think of this like a shared continent where every creator builds their own region.

### What players experience

You create a character and enter *the* world—singular. There's no menu, no lobby, no loading screen between areas. You start in some central hub (maybe a crossroads, a port city, a dimensional nexus) and you can literally walk to any creator's content.

Want to visit the Monastery of Eternal Light? Head north through the bamboo forest. Want to check out someone's vampire castle? Take the eastern road past the graveyard. It's all one continuous space.

```
You stand at the Crossroads of Many Paths.

Stone markers point in every direction. To the north, a winding
trail disappears into misty bamboo groves. To the east, the road
grows darker, passing through gnarled trees toward distant spires.
A merchant has set up a small stall nearby.

Other travelers rest here: @adventurer42, @nightwalker, @questseeker

> go north

You follow the northern path. The bamboo grows thicker around you,
and you begin to hear distant temple bells...

[You are now entering "Monastery of Eternal Light" by @creator1]
```

### What this enables

- **Emergent gameplay**: A player could start a quest in one creator's zone, find a clue that leads to another creator's zone, and complete it in a third. Worlds can reference each other.
- **Persistent community**: There's one world, one economy, one social fabric. Players form guilds, build reputations, become known figures.
- **True exploration**: You don't pick content from a menu. You discover it by walking around. That mysterious cave you found? Someone built that.

### What this makes hard

- **Coordination**: What happens when two creators both want to build a forest? Who decides where things connect? How do you handle conflicting lore?
- **Quality control**: One bad actor can ruin the experience for everyone. A creator who builds an area full of exploits or offensive content affects the whole world.
- **Scale**: This is technically the hardest option. One world means one shared state.

---

## Option B: A Lobby That's Also a World

Think of this like a library where the building itself is interesting.

### What players experience

You log in to a shared social space—but it's not a menu. It's a place. Maybe it's a grand library with cozy reading nooks. Maybe it's a tavern where travelers share stories. Maybe it's a port where ships come and go.

This lobby is itself a small MUD with things to do: chat with other players, play minigames, visit shops, check leaderboards. But when you want to enter someone's story world, you step through a portal (or open a book, or board a ship) and you're transported to that isolated instance.

```
You are in the Grand Hall of Stories.

Enormous bookshelves line the walls, reaching up into shadows.
Each tome glows faintly, humming with the world contained within.
Comfortable armchairs are scattered about, some occupied by
readers comparing notes.

A librarian sits at the central desk. Several patrons browse nearby.

Glowing tomes you notice:
  "Monastery of Eternal Light" - 12 adventurers inside
  "The Vampire's Court" - 3 adventurers inside
  "Secrets of the Sunken City" - NEW

> open monastery tome

The book falls open. Words swim before your eyes, then solidify
into reality around you...

[Loading "Monastery of Eternal Light"...]

You find yourself in a peaceful courtyard. Cherry blossoms drift
on a gentle breeze.
```

### What this enables

- **Social hub + isolated content**: Players have a persistent place to hang out and find each other, but creators have complete control over their worlds.
- **Clean separation**: If one creator's world has bugs or problems, it doesn't affect anyone else. You can take a world offline without breaking the universe.
- **Flexible progression**: Maybe your lobby character is persistent, but world characters are separate. Or maybe some items carry over. You can design different rules.

### What this makes hard

- **Lobby design is critical**: If the lobby feels like a loading screen, players will resent it. It needs to be genuinely fun to spend time in.
- **Two experiences to maintain**: You're building both a lobby world AND supporting creator worlds. That's two products.
- **Less discovery**: You're still essentially picking from a list, just a more immersive list.

---

## Option C: A Storefront for Interactive Stories

Think of this like the Kindle store, but for playable stories.

### What players experience

You open Loka and see a clean interface. Featured stories. Categories. Search. Reviews and ratings. Your "currently reading" shelf. It looks more like an app store or ebook platform than a game.

You tap on a story that looks interesting, read the description, maybe see some reviews, and hit "Start." Now you're in that world. When you're done (or want a break), you exit back to the storefront.

```
┌─────────────────────────────────────────────────────────────┐
│  LOKA                                            [Profile]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Continue Your Story                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Monastery of Eternal Light          Chapter 3 of 8  │   │
│  │ Last played 2 hours ago                    [Resume] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Featured This Week                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 🏰           │  │ 🌲           │  │ 🚀           │      │
│  │ Vampire's    │  │ The Last     │  │ Station      │      │
│  │ Court        │  │ Ranger       │  │ Omega        │      │
│  │ ★★★★☆ (234) │  │ ★★★★★ (89)  │  │ ★★★★☆ (156) │      │
│  │ Gothic       │  │ Fantasy      │  │ Sci-Fi       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Browse: [All] [Fantasy] [Horror] [Sci-Fi] [Mystery]       │
└─────────────────────────────────────────────────────────────┘
```

### What this enables

- **Familiar pattern**: Everyone understands app stores and ebook platforms. No learning curve for navigation.
- **Discovery and curation**: Ratings, reviews, featured content, categories, recommendations. All the tools that help people find good content.
- **Natural monetization**: This is literally how digital content stores work. Free stories, paid stories, subscriptions—all make sense here.
- **Mobile-first**: This UI works great on phones. The other options are harder to navigate on small screens.

### What this makes hard

- **No persistent world**: There's no "hanging out in Loka." You're browsing a store, not inhabiting a space.
- **No community space**: Where do players meet each other? In-world only? External Discord?
- **Consumption, not habitation**: This frames the experience as "reading" stories rather than "living" in a world. That's a different emotional relationship.

---

## The Deeper Questions

Choosing between these options forces us to answer some underlying questions:

### Who is Loka for?

| Audience | They want... | Best fit |
|----------|--------------|----------|
| Traditional MUD players | Persistent world, social community, emergent gameplay | Option A or B |
| Interactive fiction readers | Good stories, easy navigation, clear endings | Option C |
| Content creators | Tools to build worlds, audience to play them | Any, but A gives most creative freedom |
| Social gamers | A place to hang out with friends | Option A or B |
| Mobile-first players | Quick sessions, easy navigation | Option C |

### What's the core promise?

- **"A living world to explore"** → Option A
- **"Stories to play, and a place to find them"** → Option B
- **"Interactive stories, beautifully presented"** → Option C

### How do creators get rewarded?

- **Option A**: Harder. Who "owns" what in a shared world? How do you attribute value?
- **Option B**: Clearer. Each world is a discrete unit. Playtime, tips, access fees all make sense.
- **Option C**: Clearest. It's literally a content store. Premium stories, subscriptions, etc.

### What's the minimum viable version?

- **Option C** is technically simplest. Isolated instances, no shared state, familiar UI patterns.
- **Option B** adds a shared social layer, which is medium complexity.
- **Option A** requires solving hard coordination and consistency problems.

---

## Current State of Thinking

*Updated: 2026-01-02*

The codebase currently points in different directions:

- The **"Living Ebook" UI aesthetic** (serif fonts, literary feel, book-like presentation) suggests we're leaning toward Option C—interactive stories, not a virtual world.

- The **MUD engine architecture** (rooms, exits, NPCs, combat) suggests Options A or B—a world you inhabit, not a story you read.

- The **Content Builder pipeline** (generating complete story worlds from synopses) works with any option—it produces self-contained worlds that could be connected, lobbied, or storefronted.

### Possible Path Forward

One approach: **Start with C, evolve toward B.**

1. **MVP as Option C**: Clean storefront, isolated story worlds. Ship something.
2. **Add social features**: Comments, reviews, player profiles, friend lists—outside the worlds.
3. **Build a lobby**: Once there's community, give them a place to hang out. The lobby becomes a feature, not the product.
4. **Maybe someday A**: If creators demand interconnection and we've solved the hard problems, enable optional world linking.

This is just one path. We haven't committed to it.

---

## What We Need to Decide

Before we can move forward with confidence, we need answers to:

1. **Who is our primary user?** (Creator? Player? Both equally?)
2. **What emotion are we selling?** (Escape into stories? Belonging to a world? Pride in creation?)
3. **What's the business model?** (Subscription? Per-story purchase? Free + tips? Ads?)
4. **What's the MVP scope?** (How small can we ship and still learn?)

These questions aren't about code. They're about what Loka *is*.
