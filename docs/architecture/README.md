# Loka Engine Architecture (V2)

This documentation covers the V2 engine architecture for Loka - an Elixir MUD framework leveraging Elixir/OTP strengths.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT (priv/world/)                                  │
│   prototypes/ - Entity templates (rooms, NPCs, items)       │
│   quests/, dialogues/, scripts/, zones/ - Game content      │
│   All YAML files seeded into SQLite on boot                 │
├─────────────────────────────────────────────────────────────┤
│ CONTENT API (lib/loka/content/)                            │
│   Quest, Dialogue, Script, Zone modules (12 total)          │
│   Type-safe domain APIs over entity queries                 │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK (lib/loka/framework/)                       │
│   Combat, Inventory, Quest, Skills, StateMachine (~52 mods) │
│   Quest/dialogue/combat all use shared StateMachine engine  │
├─────────────────────────────────────────────────────────────┤
│ COMPONENTS & BEHAVIORS (lib/loka/)                         │
│   components/ - 24 accessor modules for entity.components   │
│   behaviors/ - 11 EntityBehavior modules (on_tick/event)    │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE (lib/loka/engine/)                             │
│   Entities, EntityServer, EntitySeeder, Spawner (24 modules)│
│   StateMachine, Events, Hooks, Scripting                    │
│   SQLite is single source of truth (no ETS dual-store)      │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM                                                    │
│   Phoenix 1.8, LiveView, Ecto + SQLite                      │
└─────────────────────────────────────────────────────────────┘
```

## Documentation Index

### V2 Core Concepts
- [Unified Entity System (V2)](./unified-object-system-v2.md) - Single DB truth, everything is an entity
- [Entity System](./entity-system.md) - Entity-Component-Behavior model
- [Entity Lifecycle](./entity-lifecycle.md) - EntityServer, Supervisor, auto-save pattern
- [Scripting](./elixir-scripts-design.md) - Elixir sandbox integration with traits
- [StateMachine Engine](./state-machine.md) - Shared state engine for quests, combat, dialogue
- [Events](./events.md) - Event bus and PubSub patterns (22 event types)
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle events & access control

### Visual Diagrams
- [Architecture Diagrams](./diagrams.md) - Mermaid diagrams for all key concepts

### Content & Data
- [Prototypes](./prototypes.md) - YAML-based entity templates (now seeded to SQLite)
- [Entity Seeding](./entity-seeding.md) - Boot-time YAML→DB pipeline via EntitySeeder
- [Persistence](./persistence.md) - SQLite schema with components JSON field
- [World Management](./world-management.md) - Coordinates, auto-layout, import/export
- [Testing Framework](./testing.md) - Bots, balance analysis, content validation

### Framework Subsystems
- [Framework Overview](../framework/README.md) - All framework subsystems reference (~52 modules across 14 directories)

### Web & API
- [REST API Reference](../api/README.md) - JWT authentication, health endpoints
- [Admin Dashboard](../admin/dashboard.md) - Admin interface guide
- [Terminal Builder](./terminal-builder.md) - AI-powered MUD terminal for content creation
- [Channel API](../api/channel-contract.md) - Phoenix Channels event contract
- [UI Style Guide](../ui/living-ebook-style-guide.md) - Living Ebook aesthetic

### Legacy Resources
- [Full Specification](../../Loka_Engine_Architecture.md) - V1 specification (partially outdated)

## Key Design Decisions (V2)

1. **Everything is an Entity**: Rooms, NPCs, items, quests, skills, dialogues, zones - unified system
2. **Single DB Truth**: SQLite is the source of truth. No ETS dual-store sync issues.
3. **Components as JSON**: All game data lives in `entity.components` map (JSON column)
4. **Traits (formerly Behaviors)**: `entity.traits` - list of behavior modules or script maps
5. **Entity Seeding**: YAML prototypes seeded into DB on boot via EntitySeeder
6. **GenServer per Entity**: Active entities are supervised processes with 60s dirty-check auto-save
7. **StateMachine Engine**: Shared state machine for quests, combat, dialogue, crafting, NPC AI
8. **Content API Layer**: Domain modules (Content.Quest, etc.) provide type-safe APIs over entity queries
9. **Component Accessors**: 24 modules in lib/loka/components/ for safe component access
10. **Event Bus**: Phoenix.PubSub for entity communication (location:{id}, entity:{id} topics)
11. **Hooks System**: 22 lifecycle event types for extensibility
12. **Elixir Scripting**: Sandboxed Elixir with 40+ bindings for game creators
13. **Death as Ghost State**: UO-style ghost system, no separate Bardo realm
14. **React Native Client**: Expo-based mobile client (iOS/Android) connecting via Phoenix Channels

## Process Supervision Tree (V2)

```
                       Loka.Application (~50 supervised children)
                              │
      ┌─────────────┬─────────┼─────────┬─────────────┬─────────────┐
      │             │         │         │             │             │
   Hooks    EntitySeeder (boot)  │   EntityRegistry   Cooldowns   DayNightCycle
                              │
                       EntitySupervisor
                              │
                    ┌─────────┼─────────┬─────────────┐
                    │         │         │             │
              EntityServer EntityServer EntityServer  ...
               (room:1)     (npc:5)    (quest:intro)
                    │
              ┌─────┴─────┐
         Combatant    Traits (on_tick/on_event)
         StateMachine
```

Key processes:

- **Hooks**: Registers lifecycle callbacks (22 event types)
- **EntitySeeder**: Boot-time YAML→DB seeding (replaces TypedObject.Loader in V2)
- **EntitySupervisor**: DynamicSupervisor for EntityServer processes
- **EntityRegistry**: Process lookup + PubSub broadcasting
- **EntityServer**: GenServer for individual active entities (60s dirty-check auto-save)
- **Cooldowns**: ETS-backed cooldown tracking with auto-sweep
- **DayNightCycle**: System entity managing world time progression

Note: TypedObject still exists for legacy compatibility but EntitySeeder + Entities is the V2 pattern.

## Codebase Metrics (V2)

| Category | Count | Location |
|----------|-------|----------|
| **Engine Core** | 24 modules | lib/loka/engine/ |
| **Components** | 24 modules | lib/loka/components/ |
| **Behaviors** | 11 modules | lib/loka/behaviors/ |
| **Content API** | 12 modules | lib/loka/content/ |
| **Framework** | 52 modules | lib/loka/framework/ |
| **Game Actions** | 11 modules | lib/loka/game/ |
| **Session Layer** | 3 modules | lib/loka/session/ |
| **Timers** | 2 modules | lib/loka/timers/ |
| **Channels** | 2 modules | lib/loka_web/channels/ |
| **Total Elixir** | ~141 modules | |
| **YAML Content** | ~286 files | priv/world/ |
| **Tests** | ~146 files | test/ |
| **Test Count** | ~2,319 tests | |
| **Test Suite Time** | ~33s | (down from 109s) |
| **Supervision Tree** | ~50 children | application.ex |

## V2 Migration Status

### Completed

- Single DB truth - SQLite is authoritative
- Everything is an entity (rooms, NPCs, items, quests, skills, etc.)
- Components as JSON in entity.components
- Behaviors → Traits rename (entity.traits field)
- EntitySeeder for boot-time YAML→DB seeding
- StateMachine engine for quests, combat, dialogue
- Death system (ghost state, no Bardo realm)
- Component accessor modules (24 total)
- Behavior modules (11 total)
- Content API modules (12 total)
- Script trait dispatcher for on_tick/on_event

### In Progress

- GameState deprecation (migrating to player entity components)
- Full ETS TypedObject removal (kept for legacy compatibility)
- Dual-store sync issues in room management

### Design Docs

- [Unified Entity System V2](./unified-object-system-v2.md) - Primary V2 design doc
