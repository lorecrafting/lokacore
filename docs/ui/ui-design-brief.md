# LOKA UI DESIGN BRIEF

> Complete Reference for UI Design LLM

---

## EXECUTIVE SUMMARY

**Loka** is a web-based text MUD (Multi-User Dungeon) / RPG with a **"Living Ebook"** design aesthetic. The goal is to make players feel like they're reading an interactive novel that responds to their presence—not navigating a traditional game UI.

**Platforms:** Phoenix LiveView (web) + React Native (mobile)
**Connection:** Unified WebSocket channel for both platforms
**Setting:** Buddhist monastery in the Himalayas with spiritual/philosophical themes

---

## PART 1: DESIGN PHILOSOPHY & VISUAL LANGUAGE

### Core Principle: "Living Ebook"

The interface is **literary, not technical**. Players should feel immersed in a story, not operating software.

**Key Visual Principles:**

| Principle | Implementation |
|-----------|----------------|
| Prose over chrome | Minimize UI widgets; narrative IS the interface |
| Grayscale restraint | Black, white, gray only; color reserved for essential meaning |
| Serif typography | Crimson Text primary, Georgia/Times fallbacks |
| Underlines for interaction | Interactive elements are underlined text, NOT buttons |
| Touch-first | All interactions are click/tap-based; keyboard optional |
| Generous whitespace | Pages "breathe" like a physical book |

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--ebook-bg` | `#FAFAFA` | Page background (off-white, aged paper) |
| `--ebook-text` | `#222222` | Primary text (near-black) |
| `--ebook-text-muted` | `#999999` | Secondary text, labels, hints |
| `--ebook-text-faint` | `#CCCCCC` | Disabled states |
| `--ebook-border` | `#E5E5E5` | Subtle dividers when needed |

**Note:** NO bright colors. No blue links. No green success. No red errors. Everything grayscale.

### Typography Standards

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Page title | 1.75rem | 700 | Centered, chapter-heading style |
| Body prose | 1.125rem | 400 | Line-height 1.7, optimal reading |
| Menu items | 1rem | 400 | Single actions per line |
| Labels | 1rem | 400 | Muted color |
| Small text | 0.875rem | 400 | Hints, timestamps, metadata |

**Max content width:** 42rem (optimal reading measure)

### Spacing

| Context | Value |
|---------|-------|
| Page padding | 1.5rem |
| Between sections | 1.5rem–2rem |
| Between paragraphs | 1rem |
| Between menu items | 0.5rem |

**Transitions:** All 150ms ease for subtle, book-like feel

---

## PART 2: INTERACTIVE ELEMENTS

### Links (Primary Interaction Pattern)

ALL interactive elements appear as **underlined text** woven into prose.

```css
.ebook-link {
  color: #222222;
  text-decoration: underline;
  cursor: pointer;
}

.ebook-link:hover {
  color: #000000;
  transition: color 150ms ease;
}
```

**Critical rules:**
- Links are part of narrative flow, not separate UI
- NEVER use colored links
- NEVER use buttons for in-game actions
- ALL clickable elements MUST have underlines

### Menus

When presenting choices, use simple text lists:

```
Inspect
Talk
Trade
Attack
Leave
```

**Rules:**
- No bullets, numbers, or icons
- Each item is tappable/clickable underlined text
- "Leave" or "Back" always available to return
- Centered or left-aligned depending on context

---

## PART 3: SCREEN LAYOUTS

### Room View (Primary Game Screen)

```
┌─────────────────────────────────────┐
│                                     │
│          [Room Title]               │  ← Bold, centered
│                                     │
│   [Room description as flowing      │  ← Prose style, no indent
│    prose that paints the scene.     │
│    A monk stands by the altar.      │  ← Entities woven in as
│    A wooden chest sits nearby.]     │     underlined names
│                                     │
│   [Event stream]                    │  ← Recent happenings
│   - You arrived from the south.     │
│   - The monk nods in greeting.      │
│                                     │
├─────────────────────────────────────┤
│   [N]  [Say: _________ ] [Send]     │  ← Bottom bar (fixed)
│ [W] [E]                             │  ← Navigation compass
│   [S]                               │
└─────────────────────────────────────┘
```

**Room Description Rules:**
- First-person perspective ("You see...")
- Present tense
- Entities (NPCs, items, players) are underlined names within prose
- Never list entities separately—weave them into description

### Entity Context Panel

When player clicks an entity name, view transforms:

```
┌─────────────────────────────────────┐
│                                     │
│     [Room Title - MUTED GRAY]       │  ← Shows context shifted
│                                     │
│   [Elder Monk]                      │  ← Entity name, bold
│                                     │
│   An elderly monk with kind eyes    │  ← Entity description
│   and weathered hands. He wears     │
│   simple robes and prayer beads.    │
│                                     │
│   Inspect                           │  ← Context-sensitive
│   Talk                              │     action menu
│   Trade                             │
│   Leave                             │  ← Always available
│                                     │
└─────────────────────────────────────┘
```

### Combat Overlay

```
┌─────────────────────────────────────┐
│                                     │
│        COMBAT                       │
│                                     │
│   Enemy: Angry Spirit               │
│   Health: ████████░░ (80%)          │  ← Or descriptive text
│                                     │
│   [Combat Log]                      │
│   - You strike the spirit!          │
│   - The spirit retaliates!          │
│   - You take 12 damage.             │
│                                     │
│   Attack                            │
│   Defend                            │
│   Use: Meditation                   │
│   Flee                              │
│                                     │
└─────────────────────────────────────┘
```

**Combat is auto-resolving** (not turn-based input). Player sees results scroll in log.

### Dialogue Overlay

```
┌─────────────────────────────────────┐
│                                     │
│        [NPC Name - Muted]           │
│                                     │
│   "Greetings, traveler. The         │  ← NPC speech in quotes
│    mountain path is treacherous     │
│    this time of year."              │
│                                     │
│   "Tell me about the monastery"     │  ← Player choices
│   "I seek the hermit"               │     as underlined text
│   "Farewell"                        │
│                                     │
└─────────────────────────────────────┘
```

### Inventory Modal

```
┌──────────────────────────────────┐
│         Inventory                │
│                                  │
│  Equipment:                      │
│  Weapon: Iron Sword              │
│  Armor: Monk's Robe              │
│                                  │
│  Carried:                        │
│  - Health Potion (×3)            │
│  - Meditation Journal            │
│  - Candle                        │
│                                  │
│  [Selected: Health Potion]       │
│  Use                             │
│  Drop                            │
│                                  │
│  Close                           │
└──────────────────────────────────┘
```

### Shop Interface

```
┌──────────────────────────────────┐
│    Butcher Sonam's Wares         │
│                                  │
│  For Sale:                       │
│  - Dried Yak Meat: 15 gold       │
│  - Health Salve: 30 gold         │
│                                  │
│  Your gold: 127                  │
│                                  │
│  Buy                             │
│  Sell                            │
│  Close                           │
└──────────────────────────────────┘
```

### Quest Journal

```
┌──────────────────────────────────┐
│      Active Quests               │
│                                  │
│  "A Stranger Arrives"            │
│  ○ Speak with Novice Pema  ✓     │
│  ○ Find the temple               │
│                                  │
│  "The Hermit's Wisdom"           │
│  ○ Locate the hermit's cave      │
│  ○ Listen to the teaching        │
│  ○ Return to the monastery       │
│                                  │
│  Close                           │
└──────────────────────────────────┘
```

### Death Screen (Bardo)

When player dies, a contemplative "Bardo" (death realm) screen appears:

```
┌──────────────────────────────────┐
│                                  │
│       You Have Fallen            │
│                                  │
│   The world fades. You drift     │
│   in the space between lives.    │
│                                  │
│   A koan echoes in the void:     │
│   "What was your face before     │
│    your parents were born?"      │
│                                  │
│   [When ready...]                │
│   Reincarnate                    │
│                                  │
└──────────────────────────────────┘
```

**Tone:** Contemplative, philosophical—not punishing.

### Auth Pages (Login/Register)

```
┌──────────────────────────────────┐
│                                  │
│                                  │
│       Enter the World            │
│                                  │
│  Your email address              │
│  ________________________        │
│                                  │
│  Send magic link                 │
│                                  │
│                                  │
│  New to this realm?              │
│  Create an account               │
│                                  │
│                                  │
└──────────────────────────────────┘
```

**Rules:**
- Minimal fields
- Labels above inputs in muted color
- Inputs have bottom border only (no box)
- Submit actions are underlined text
- Literary language ("Enter the World", not "Login")

---

## PART 4: PLAYER CHARACTER DATA

### Stats to Display

**Base Attributes:**
- `str` (Strength) — Physical power
- `dex` (Dexterity) — Precision, dodge
- `sta` (Stamina) — Endurance, health
- `mnd` (Mind) — Spiritual power

**Progression:**
- Level (1-50)
- XP / XP to next level
- Skill points (unspent)

**Resources:**
- Health (current/max)
- Mana (current/max)
- Movement/Vitality (current/max)

**Special:**
- Karma (-100 to +100) — Moral balance
- Gold — Currency

**Social:**
- Mood (happy, contemplative, anxious, etc.)
- Pose (custom text: "sitting by the fire")

### Equipment Slots

- Weapon
- Armor/Body
- Accessories (ring, amulet)

---

## PART 5: ENTITY TYPES

### NPCs

NPCs appear as underlined names in room descriptions. Can have:
- Dialogue trees (branching conversations)
- Combat stats (some are hostile)
- Shop inventories (merchants)
- Ambient messages (periodic flavor text)
- Companion capability (follow/assist player)

**Example NPCs in game:**
- Novice Pema — Young monk, first quest giver
- Elder Monk — Wisdom figure
- Butcher Sonam — Village merchant
- Lama Tenzin — Meditation master
- Wandering Musician — Bard character

### Items

**Types:**
- Equipment (weapons, armor)
- Consumables (potions, food)
- Quest items (cannot be dropped)
- Readable (books, journals)
- Containers (chests, bags)

**Properties to display:**
- Name
- Description
- Weight
- Value (for trading)
- Effects (for consumables)

### Rooms

Each room has:
- Title
- Description (prose)
- Exits (north, south, east, west, up, down)
- Entities present (NPCs, items, players)
- Ambient messages (time-of-day flavor)

---

## PART 6: GAME SYSTEMS

### Combat System

- Player clicks "Attack" on hostile NPC
- Combat auto-resolves (not turn-based input)
- Combat log shows damage dealt/received
- Actions: Attack, Defend, Use Ability, Flee
- Ends: Victory (XP/gold/loot), Defeat (death), Fled

### Quest System

- Quests given through NPC dialogue
- Objective types: talk, kill, collect, visit, craft
- Progress tracked in journal
- Rewards: XP, gold, items

### Dialogue System

- Branching conversation trees
- Choices appear as underlined text
- Conditional nodes (different dialogue based on quest progress)
- Actions triggered: accept quest, give item, set flags

### Skill System

- Skills learned from trainers
- Cost skill points to level
- Used for: crafting, gathering, perception checks

### Social Features

- **Say:** Speak to room (everyone present)
- **Shout:** Speak to adjacent rooms
- **Yell:** Speak to wider area
- **Emotes:** /wave, /bow, /meditate, etc.
- **Mood/Pose:** Shown when others view you

### Time/Weather

- Day/night cycle: Dawn, Day, Dusk, Night
- Ambient messages change by time
- Weather affects gameplay

---

## PART 7: MOBILE CONSIDERATIONS

### Differences from Web

- **Touch-optimized:** Larger tap targets (44px minimum)
- **Portrait primary:** Layouts stack vertically
- **Simplified compass:** Smaller, thumb-reachable
- **Modal overlays:** Dialogues/shops as full-screen modals
- **Keyboard handling:** Virtual keyboard doesn't obscure input

### Mobile Navigation

Bottom bar contains:
1. Compass (8-way directional)
2. Chat input (collapsible)
3. Menu access (inventory, quests, settings)

---

## PART 8: ACCESSIBILITY REQUIREMENTS

**Target:** WCAG 2.1 Level AA

**Current Implementation:**
- High contrast (black on cream): ✓
- No reliance on color alone: ✓
- Focus visible on all elements: ✓
- Screen reader partial support: ✓

**Required:**
- All interactive elements keyboard accessible
- Logical focus order
- ARIA labels on compass, menus, logs
- Combat log as `aria-live="assertive"`
- Skip link to main content

**Planned:**
- Font size settings
- Motion reduction option
- Adjustable combat pace

---

## PART 9: WRITING STYLE GUIDE

### Tone

- **Literary:** Write like a novel, not a manual
- **Second person:** "You see...", "You hear..."
- **Present tense:** Immediate, immersive
- **Evocative:** Paint pictures with words

### Examples

| Bad (Technical) | Good (Literary) |
|-----------------|-----------------|
| Login | Enter the World |
| NPC: Druid Level 5 | A druid in dark green robes stands at the altar |
| Sign up | New to this realm? Create an account |
| HP: 100/100 | You feel healthy and strong |
| Error: Invalid input | Something seems amiss |

### Room Description Pattern

```
[Setting description in 1-2 sentences.]
[Environmental detail or atmosphere.]
[Entities woven into prose as underlined names.]
```

Example:
> The monastery courtyard is quiet in the morning light. Prayer flags flutter in the mountain breeze. **Novice Pema** sweeps near the main gate, while a **wooden chest** sits beside the well.

---

## PART 10: GAME CONTENT/SETTING

### Theme

Buddhist-inspired mountain monastery setting. Spiritual, contemplative, philosophical. Not dark fantasy or grimdark.

### Main Story (Monastery Arc)

- 20-40 hour story
- Progressive acts with named characters
- Antagonists: "Three Poisons" (Buddhist concept)
  - Raga (attachment)
  - Dvesha (aversion)
  - Moha (delusion)

### Environments

- Monastery grounds (temple, courtyards, halls)
- Mountain village (market, cemetery, farms)
- Sacred locations (caves, peaks)
- Nature areas (forest, paths, streams)

### Sample NPCs

| Name | Role | Notes |
|------|------|-------|
| Novice Pema | Quest giver | Young monk, potential companion |
| Lama Tenzin | Mentor | Meditation master |
| Abbot Jampa | Authority | Monastery leader |
| Butcher Sonam | Merchant | Village shop |
| Wandering Musician | Storyteller | Bard character |

---

## PART 11: COMPONENT REFERENCE

### CSS Class Naming

```css
/* Layout */
.ebook-page { }
.ebook-title { }
.ebook-title--muted { }
.ebook-prose { }

/* Interactive */
.ebook-link { }
.ebook-menu { }
.ebook-menu-item { }

/* Forms */
.ebook-input { }
.ebook-label { }
.ebook-submit { }

/* Game Elements */
.ebook-compass { }
.ebook-events { }
.ebook-event { }
.ebook-combat-log { }
.ebook-bottombar { }

/* Modals */
.ebook-modal { }
.ebook-modal-content { }
```

### State Modifiers

- `--muted` — Gray text (context shifted)
- `--disabled` — Faint text, no interaction
- `--active` — Currently selected
- `--highlighted` — Draw attention

---

## PART 12: INTERACTION FLOWS

### Click Entity → Action

1. Player sees "Elder Monk" underlined in room description
2. Player taps/clicks "Elder Monk"
3. Context panel appears with entity description
4. Action menu shows: Inspect, Talk, Trade, Leave
5. Player taps "Talk"
6. Dialogue overlay appears
7. Player makes choices
8. "Leave" returns to room view

### Navigate Room

1. Player taps [N] on compass
2. Room description updates
3. New entities appear as underlined names
4. Event stream shows "You arrived from the south"

### Combat Flow

1. Player taps hostile entity
2. Player taps "Attack"
3. Combat overlay appears
4. Log auto-updates with results
5. Combat ends → rewards shown → return to room

### Death → Reincarnation

1. Player health reaches 0
2. Bardo screen appears
3. Philosophical messages display
4. "Reincarnate" becomes available
5. Player respawns at monastery

---

## SUMMARY: KEY DESIGN PRINCIPLES

1. **Text is the interface** — Everything is prose, not widgets
2. **Underlines are buttons** — All interactive elements underlined
3. **Grayscale only** — No color except for critical meaning
4. **Serif typography** — Literary, book-like feel
5. **Whitespace generously** — Pages breathe like books
6. **Literary language** — "Enter the World" not "Login"
7. **Mobile-first touch** — Large tap targets, no keyboard required
8. **Accessible by default** — High contrast, screen reader support

---

## Related Documents

- [Living Ebook Style Guide](./living-ebook-style-guide.md) — Detailed CSS/styling reference
- [Accessibility](./accessibility.md) — WCAG compliance details
- [Game Client Reference](../reference/game-client.md) — Technical implementation
