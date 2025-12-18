# ExMUD Engine Architecture

This documentation covers the core engine architecture for ExMUD - an Elixir MUD framework similar to Evennia but leveraging Elixir/OTP strengths.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│ GAME CONTENT (Worlds, NPCs, Quests)     │
├─────────────────────────────────────────┤
│ GAME FRAMEWORK (Combat, Skills, etc.)   │
├─────────────────────────────────────────┤
│ ENGINE CORE (Entities, Commands, Events)│
├─────────────────────────────────────────┤
│ PLATFORM (Phoenix, LiveView, Ecto)      │
└─────────────────────────────────────────┘
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
- [Persistence](./persistence.md) - Evennia-style database design
- [Events](./events.md) - Event bus and PubSub patterns
- [Scripting](./scripting.md) - Lua sandbox integration
- [Commands](./commands.md) - Command pipeline architecture

### Other Resources
- [Admin Dashboard](../admin/dashboard.md) - Admin interface guide
- [Full Specification](../../ExMUD_Engine_Architecture.md) - Complete 200KB specification

## Key Design Decisions

1. **Entity-Component-Behavior**: Composition over inheritance, maps naturally to Elixir's functional paradigm
2. **GenServer per Entity**: Active entities (rooms, NPCs) are supervised processes with auto-save
3. **Event Bus**: Phoenix.PubSub for entity communication
4. **Command Pipeline**: Parse → Validate → Execute → Emit Events
5. **Lua Scripting**: Safe sandbox for game creators to customize NPCs/quests
6. **Web-First**: LiveView for all clients, no App Store dependencies

## Process Supervision Tree

```
                       ExMUD.Application
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
ExMUD.Platform          ExMUD.Engine            ExMUD.Game
      │                       │                       │
┌─────┴─────┐         ┌───────┴───────┐              │
│           │         │               │              │
Phoenix    PubSub   EntitySup      WorldSup       SessionMgr
Endpoint              │               │              │
               ┌──────┴──────┐   ┌────┴────┐    ┌────┴────┐
               │             │   │         │    │         │
          EntityReg     EntityPool  TickSup  WorldReg  Sessions
```
