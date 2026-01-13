# Loka World Platform: Design Once, Deploy Anywhere

> **Status**: Future Initiative (tabled)
> **Tracking**: lokacore-u581
> **Last Updated**: 2024-12-31

## Vision

Create a **World Designer** tool where you design game worlds once, then deploy them as:
- **Single-player mobile apps** (iOS/Android, App Store)
- **MUD zones** (multiplayer, part of Loka server)

```
┌─────────────────────────────────────────┐
│         WORLD DESIGNER                   │
│   (Dedicated tool for world creation)    │
└─────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Universal Content  │
         │   Format (YAML)     │
         └─────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ Single-Player │       │  MUD Zone     │
│ Mobile App    │       │ (Multiplayer) │
└───────────────┘       └───────────────┘
```

---

## Key Decisions

### World Designer
- **Separate dedicated tool** (not enhanced admin dashboard)
- React web app for cross-platform access
- Visual room editor, NPC/dialogue tree builder, quest editor
- Export to YAML format

### Single-Player Runtime
- **React Native** with TypeScript
- Interpreter approach (one runtime, different content bundles)
- Port core systems: Combat, Quest, Dialogue, Inventory
- Preserve "Living Ebook" aesthetic

### Auto-Adaptation (MP → SP)

When exporting to single-player, the system automatically adapts:

| Multiplayer Feature | Single-Player Adaptation |
|---------------------|--------------------------|
| Other players | Removed (solo experience) |
| Chat/say commands | Journal entries / internal monologue |
| Party mechanics | Companion NPCs (optional) |
| PvP combat | Removed |
| Shared economy | Personal economy |
| Real-time events | Turn-based or scripted |
| Room broadcasts | Ambient narration |

---

## Architecture

### Why React Native

| Factor | Decision |
|--------|----------|
| Text-heavy UI | React Native's native Text components handle well |
| Team skills | JS/TS familiar from LiveView hooks |
| Existing code | `_shelved/mobile/` has React Native/Expo to revive |
| Hot reload | Metro bundler enables rapid content iteration |
| Store approval | Standard native app, no WebView concerns |

### Mobile Runtime Stack

```
┌─────────────────────────────────────────┐
│ Mobile UI (React Native)                │
│   RoomScreen, CombatScreen, Dialogue... │
├─────────────────────────────────────────┤
│ State Management (Zustand)              │
│   player, quests, combat, dialogue      │
├─────────────────────────────────────────┤
│ Game Systems (TypeScript)               │
│   CombatSystem, QuestSystem, Dialogue.. │
├─────────────────────────────────────────┤
│ Content Manager                         │
│   Loads JSON bundle, provides getRoom() │
├─────────────────────────────────────────┤
│ Persistence (AsyncStorage)              │
│   Save/load player progress             │
└─────────────────────────────────────────┘
```

### Export Bundle Format

```
loka-game-bundle/
├── manifest.json           # Game metadata, starting room
├── content/
│   ├── rooms.json         # All room definitions
│   ├── npcs.json          # NPCs + dialogue trees
│   ├── items.json         # Item definitions
│   └── quests.json        # Quest definitions
└── config/
    ├── game.json          # Settings, defaults
    └── balance.json       # Combat formulas, XP curves
```

### World Designer Features

```
┌─────────────────────────────────────────────────────────────┐
│  WORLD DESIGNER                                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Room Editor │  NPC Editor  │ Quest Editor │ Item Editor    │
│  - Visual    │  - Dialogue  │  - Objectives│ - Stats        │
│    map       │    tree      │  - Rewards   │ - Effects      │
│  - Exits     │  - Shop      │  - Chains    │ - Equipment    │
│  - Spawns    │  - Combat    │  - Journal   │               │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  World Graph View (spatial layout of all rooms)             │
├─────────────────────────────────────────────────────────────┤
│  Preview Mode (test walk-through without full server)       │
├─────────────────────────────────────────────────────────────┤
│  Export: [Single-Player App] [MUD Zone] [Raw YAML]          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
World Designer (React)
       │
       ▼ (saves)
   YAML Files (priv/world/prototypes/)
       │
       ├──────────────────────┐
       ▼                      ▼
mix loka.export_mobile    mix phx.server
       │                      │
       ▼                      ▼
  JSON Bundle            Loka MUD Server
       │                      │
       ▼                      ▼
React Native App         Multiplayer Game
(Single-Player)          (MUD Zone)
```

---

## Implementation Phases

### Phase 0: Universal Content Format
**Goal:** Ensure YAML format supports both SP and MP deployment

1. Audit existing prototypes for MP-specific assumptions
2. Add metadata fields: `sp_adaptation`, `mp_only`, `sp_only`
3. Document the universal content schema
4. Update validators for multi-target compatibility

### Phase 1: Single-Player Runtime (MVP)
**Goal:** Prove content can run as standalone app

1. Create `mix loka.export_mobile` task
2. Initialize React Native project
3. Port core systems: Room navigation, Combat, Dialogue, Quest
4. Basic "Living Ebook" UI
5. Test with existing monastery content

**Deliverable:** Monastery playable as single-player app

### Phase 2: World Designer (Core)
**Goal:** Visual tool for creating worlds

1. React web app with room editor
2. Visual map canvas (drag rooms, connect exits)
3. NPC editor with dialogue tree builder
4. Quest editor with objective flow
5. Export to YAML format

### Phase 3: World Designer (Advanced)
**Goal:** Full-featured authoring

1. Item/ability editors
2. Shop configuration
3. Combat balancing tools
4. Preview/test mode (walk through without server)
5. Import existing YAML worlds

### Phase 4: MUD Zone Import
**Goal:** Load designer worlds into Loka multiplayer

1. Zone packaging format (world as installable unit)
2. Zone loader for Loka server
3. Multi-zone support (multiple worlds on one server)
4. Zone isolation (separate economies, progression)

### Phase 5: Polish & Release
**Goal:** Production-ready platform

1. App Store submission workflow
2. World Designer cloud hosting
3. Template worlds (starter kits)
4. Documentation for world creators

---

## Key Files to Create

### Elixir (Export)

| File | Purpose |
|------|---------|
| `lib/mix/tasks/loka.export_mobile.ex` | Mix task for export |
| `lib/loka/engine/mobile_exporter.ex` | JSON serialization logic |

### React Native (Runtime)

| File | Purpose |
|------|---------|
| `mobile/src/systems/combat.ts` | Combat logic (port) |
| `mobile/src/systems/quest.ts` | Quest logic (port) |
| `mobile/src/systems/dialogue.ts` | Dialogue logic (port) |
| `mobile/src/systems/inventory.ts` | Inventory logic (port) |
| `mobile/src/content/ContentManager.ts` | Load JSON bundles |
| `mobile/src/store/gameStore.ts` | Zustand state |
| `mobile/src/screens/RoomScreen.tsx` | Room UI |
| `mobile/src/screens/CombatScreen.tsx` | Combat UI |
| `mobile/src/screens/DialogueScreen.tsx` | Dialogue UI |
| `mobile/src/theme/index.ts` | Living Ebook styling |

### Elixir Files to Port

| Elixir Source | TypeScript Target |
|---------------|-------------------|
| `lib/loka/framework/combat/combat.ex` | `mobile/src/systems/combat.ts` |
| `lib/loka/framework/quest/progress.ex` | `mobile/src/systems/quest.ts` |
| `lib/loka/framework/dialogue/dialogue.ex` | `mobile/src/systems/dialogue.ts` |
| `lib/loka/framework/inventory/inventory.ex` | `mobile/src/systems/inventory.ts` |

---

## What's Omitted (Single-Player)

- Multiplayer (Session, PubSub, real-time)
- EntityServer GenServers → plain objects
- Lua scripting (defer to later phase)
- Admin dashboard, PvP, chat, parties

---

## Open Questions

- **Lua scripts**: Defer entirely, or transpile to JS for SP runtime?
- **Difficulty scaling**: Add SP difficulty slider since no MP balance?
- **World sharing**: Allow creators to share/sell worlds?
- **AI assistance**: Integrate Claude for world generation from prompts?
