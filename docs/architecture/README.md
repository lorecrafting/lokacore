# ExMUD Engine Architecture

This documentation covers the core engine architecture for ExMUD - an Elixir MUD framework similar to Evennia but leveraging Elixir/OTP strengths.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT                                                │
│   priv/world/prototypes/ (YAML files)                       │
│   Rooms, NPCs, Items, Exits - defined without code          │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK (lib/exmud/framework/)                       │
│   Combat, Quests, Inventory, Progression, Dialogue          │
│   Player state, Room loading for UI                         │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE (lib/exmud/engine/)                             │
│   Entities, EntityServer, Registry, Supervisor              │
│   Prototypes, Spawner, WorldLoader                          │
│   Events, Commands, Behaviors, Hooks, Locks, Scripting      │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM                                                    │
│   Phoenix 1.8, LiveView, Ecto + SQLite                      │
└─────────────────────────────────────────────────────────────┘
```

## Key Differentiators from Evennia

| Aspect | Evennia (Python/Django) | ExMUD (Elixir/Phoenix) |
|--------|------------------------|------------------------|
| Concurrency Model | Twisted async, cooperative | OTP actors, true preemptive |
| Real-time Delivery | Websockets (bolt-on) | LiveView (native, diff-based) |
| State Management | Django ORM + in-memory | GenServers + ETS + Ecto |
| Fault Tolerance | Application-level | Supervision trees (OTP) |
| Hot Code Reloading | Limited | Native BEAM capability |
| Database | PostgreSQL required | SQLite (simple) or PostgreSQL |

## Documentation Index

### Core Engine Topics
- [Entity System](./entity-system.md) - Entity-Component-Behavior model
- [Entity Lifecycle](./entity-lifecycle.md) - Registry, Server, Supervisor pattern
- [Prototypes](./prototypes.md) - YAML-based content templates
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle events & access control
- [Persistence](./persistence.md) - Evennia-style database design
- [Events](./events.md) - Event bus and PubSub patterns
- [Scripting](./scripting.md) - Lua sandbox integration
- [Commands](./commands.md) - Command pipeline architecture

### Other Resources
- [Admin Dashboard](../admin/dashboard.md) - Admin interface guide
- [UI Style Guide](../ui/living-ebook-style-guide.md) - Living Ebook aesthetic
- [Full Specification](../../ExMUD_Engine_Architecture.md) - Complete 200KB specification

## Key Design Decisions

1. **Entity-Component-Behavior**: Composition over inheritance, maps naturally to Elixir's functional paradigm
2. **Prototype System**: YAML templates with inheritance for game content without code changes
3. **Lazy Entity Loading**: Processes only created when accessed, auto-stop after idle
4. **GenServer per Entity**: Active entities (rooms, NPCs) are supervised processes with auto-save
5. **Event Bus**: Phoenix.PubSub for entity communication
6. **Hooks & Locks**: Evennia-inspired lifecycle hooks and string-based access control
7. **Command Pipeline**: Parse → Validate → Execute → Emit Events
8. **Lua Scripting**: Safe sandbox for game creators to customize NPCs/quests
9. **Web-First**: LiveView for all clients, no App Store dependencies

## Process Supervision Tree

```
                       Exmud.Application
                              │
      ┌─────────────┬─────────┼─────────┬─────────────┐
      │             │         │         │             │
   Hooks     PrototypeLoader  │   EntityRegistry   Combat.Spawner
                              │
                       EntitySupervisor
                              │
                    ┌─────────┼─────────┐
                    │         │         │
              EntityServer EntityServer EntityServer
               (room:1)     (npc:5)    (item:12)
```

- **Hooks**: Registers lifecycle callbacks
- **PrototypeLoader**: Loads YAML prototypes into ETS
- **EntitySupervisor**: DynamicSupervisor for EntityServer processes
- **EntityRegistry**: Process lookup + room-based broadcasting
- **EntityServer**: GenServer for individual active entities
