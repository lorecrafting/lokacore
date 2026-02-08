# Loka Engine Architecture

This documentation covers the core engine architecture for Loka - an Elixir MUD framework leveraging Elixir/OTP strengths.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT                                                │
│   priv/world/prototypes/ (YAML files)                       │
│   Rooms, NPCs, Items, Exits - defined without code          │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK (lib/loka/framework/)                       │
│   Combat, Quests, Inventory, Progression, Dialogue          │
│   Player state, Room loading for UI                         │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE (lib/loka/engine/)                             │
│   Entities, EntityServer, Registry, Supervisor              │
│   Prototypes, Spawner, WorldLoader                          │
│   Events, Commands, Behaviors, Hooks, Locks, Scripting      │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM                                                    │
│   Phoenix 1.8, LiveView, Ecto + SQLite                      │
└─────────────────────────────────────────────────────────────┘
```

## Documentation Index

### Visual Diagrams
- [Architecture Diagrams](./diagrams.md) - Mermaid diagrams for all key concepts

### Core Engine Topics
- [Entity System](./entity-system.md) - Entity-Component-Behavior model
- [Entity Lifecycle](./entity-lifecycle.md) - Registry, Server, Supervisor pattern
- [Prototypes](./prototypes.md) - YAML-based content templates
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle events & access control
- [Persistence](./persistence.md) - Database design with EAV pattern
- [Events](./events.md) - Event bus and PubSub patterns
- [Scripting](./elixir-scripts-design.md) - Elixir sandbox integration
- [Commands](./commands.md) - Command pipeline architecture
- [World Management](./world-management.md) - Coordinates, auto-layout, import/export
- [Testing Framework](./testing.md) - Bots, balance analysis, content validation

### Framework Subsystems
- [Framework Overview](../framework/README.md) - All 31 game subsystems reference

### Web & API
- [REST API Reference](../api/README.md) - JWT authentication, health endpoints
- [Admin Dashboard](../admin/dashboard.md) - Admin interface guide
- [UI Style Guide](../ui/living-ebook-style-guide.md) - Living Ebook aesthetic

### Other Resources
- [Full Specification](../../Loka_Engine_Architecture.md) - Complete 200KB specification

## Key Design Decisions

1. **Entity-Component-Behavior**: Composition over inheritance, maps naturally to Elixir's functional paradigm
2. **Prototype System**: YAML templates with inheritance for game content without code changes
3. **Lazy Entity Loading**: Processes only created when accessed, auto-stop after idle
4. **GenServer per Entity**: Active entities (rooms, NPCs) are supervised processes with auto-save
5. **Event Bus**: Phoenix.PubSub for entity communication
6. **Hooks & Locks**: Lifecycle hooks and string-based access control
7. **Command Pipeline**: Parse → Validate → Execute → Emit Events
8. **Elixir Scripting**: Sandboxed Elixir for game creators to customize NPCs/quests
9. **Web-First**: LiveView for all clients, no App Store dependencies

## Process Supervision Tree

```
                       Loka.Application
                              │
      ┌─────────────┬─────────┼─────────┬─────────────┐
      │             │         │         │             │
   Hooks   TypedObject.Loader  │   EntityRegistry   Combat.RespawnManager
                              │
                    ┌─────────┴─────────┐
                    │                   │
             LayoutManager       EntitySupervisor
                                        │
                              ┌─────────┼─────────┐
                              │         │         │
                        EntityServer EntityServer EntityServer
                         (room:1)     (npc:5)    (item:12)
```

- **Hooks**: Registers lifecycle callbacks
- **TypedObject.Loader**: Loads YAML content into ETS
- **LayoutManager**: Auto-maintains room coordinates based on exits
- **EntitySupervisor**: DynamicSupervisor for EntityServer processes
- **EntityRegistry**: Process lookup + room-based broadcasting
- **EntityServer**: GenServer for individual active entities
