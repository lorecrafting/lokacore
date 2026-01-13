# CLAUDE.md - Loka Development Guide

## Project Overview

**Loka** is an Elixir MUD engine framework for building text-based RPGs. Built with Elixir's OTP concurrency, fault tolerance, and real-time LiveView.

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Elixir/Phoenix | 1.19.4 / 1.8.3 |
| Runtime | Erlang/OTP | 28.3 |
| Real-time | Phoenix LiveView | 1.1.19 |
| Database | SQLite (via Ecto) | ecto_sqlite3 |
| Auth | phx.gen.auth + Guardian JWT | 2.4.0 |
| Scripting | Elixir (sandboxed) | Native |
| Deployment | Fly.io | ~$5/month |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT - priv/world/prototypes/ (YAML)               │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK - lib/loka/framework/ (27 subsystems)       │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE - lib/loka/engine/                             │
├─────────────────────────────────────────────────────────────┤
│ SESSION LAYER - lib/loka/session/                          │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM - Phoenix 1.8, LiveView, Ecto + SQLite            │
└─────────────────────────────────────────────────────────────┘
```

### Core Patterns

- **Entity-Component-Behavior**: Composition over inheritance
- **Prototype System**: YAML templates with inheritance
- **TypedObject**: Unified foundation for all game content
- **GenServer per Entity**: Supervised processes with auto-save
- **Event Bus**: Phoenix.PubSub for entity communication
- **Hooks**: 22 lifecycle event types for extensibility
- **Locks**: String-based access control

### TypedObject System

TypedObject provides a unified foundation for all game content. Content modules wrap TypedObject with domain-specific APIs:

| Module | Type | Purpose |
|--------|------|---------|
| `Content.Quest` | `:quest` | Quest definitions with objectives |
| `Content.Dialogue` | `:dialogue` | NPC dialogue trees |
| `Content.Script` | `:script` | Elixir scripts for NPCs |
| `Content.Zone` | `:zone` | Zone definitions with resets |

**Resolution Order**: Content modules → Legacy loaders (YAML/DB)

```elixir
# Content modules provide domain-specific accessors
Content.Quest.get("intro_welcome")        # {:ok, %TypedObject{type: :quest}}
Content.Dialogue.for_entity("elder_npc")  # [%TypedObject{type: :dialogue}]
Content.Script.get("guard_on_look")       # {:ok, %TypedObject{type: :script}}
```

**YAML Loading**: TypedObject.Loader loads from multiple directories:
- `priv/world/prototypes/` - Entity prototypes
- `priv/world/quests/` - Quest definitions
- `priv/world/zones/` - Zone definitions
- `priv/world/dialogues/` - Dialogue trees
- `priv/world/scripts/` - Elixir scripts

## Project Structure

```
lokacore/
├── server/
│   ├── lib/loka/
│   │   ├── engine/           # Core: entities, registry, spawner, TypedObject
│   │   ├── content/          # Content modules (Quest, Dialogue, Script, Zone)
│   │   ├── framework/        # 27 game subsystems
│   │   ├── timers/           # Persistent timers (crafting, offline progression)
│   │   └── session/          # Client messaging layer
│   ├── lib/loka_web/live/
│   │   ├── game_live.ex      # Game client
│   │   └── admin_live/       # Admin dashboard
│   └── priv/world/           # YAML game content
│       ├── prototypes/       # Entity prototypes
│       ├── quests/           # Quest definitions
│       ├── zones/            # Zone definitions
│       └── scripts/          # Elixir scripts
├── docs/                     # Architecture documentation
└── CLAUDE.md
```

## Quick Commands

```bash
# Development
cd server
mix deps.get && mix ecto.setup    # Setup
mix phx.server                     # Start at localhost:4000
mix test                           # Run tests

# Validation
mix loka.test                     # All tests (unit + content + balance)
mix loka.test.validate            # Validate prototypes, quests, dialogues

# Deployment
fly deploy
```

## Routes

| Path | Description | Auth |
|------|-------------|------|
| `/` | Landing page | No |
| `/play` | Game client | Yes |
| `/admin` | Admin dashboard | Admin |

## Key Design Decisions

1. **Web-First**: LiveView for all clients - no App Store fees
2. **SQLite**: Simpler, cheaper, sufficient for single-server MVP
3. **No Redis**: ETS handles caching until multi-server needed
4. **Elixir Scripting**: Sandboxed Elixir for game customization (replaces Lua)

## Scripts vs Framework Code (Decision Guide)

**Core principle:** Scripts customize game content. Framework code adds capabilities.

```
┌─────────────────────────────────────────────────────────────┐
│ DECISION TREE: Where does this change belong?               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "I need to make [X] happen in the game"                    │
│                                                             │
│  Q1: Does the scripting API already support this?           │
│      YES → Write a script (priv/world/scripts/ or DB)       │
│      NO  → Q2                                               │
│                                                             │
│  Q2: Is this game-specific content or a reusable system?    │
│      CONTENT → Add new script API function, then script     │
│      SYSTEM  → Framework code (lib/loka/framework/)         │
│                                                             │
│  Q3: Does this change HOW scripts work (not WHAT they do)?  │
│      YES → Engine code (lib/loka/engine/script/)            │
│      NO  → Framework code                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Use Scripts When...

Scripts live in `priv/world/scripts/`, `builder_scripts` YAML field, or `scripts` DB table.

| Scenario | Example | Why Script? |
|----------|---------|-------------|
| NPC personality/reactions | Guard attacks thieves, Elder speaks cryptically | Behavior customization |
| Room environmental effects | Cave echoes speech, temple heals on enter | Location-specific logic |
| Quest triggers/callbacks | Spawn boss when player enters, reward on completion | Quest-specific events |
| Custom dialogue responses | NPC reacts to player's inventory or flags | Dynamic conversation |
| Timed events for content | NPC patrols, weather changes | Content-driven scheduling |

**Script examples:**
```elixir
# priv/world/scripts/guard_on_steal.exs
if has_flag?("caught_stealing") do
  say("Stop right there, thief!")
  start_combat(player.id)
else
  say("Move along, citizen.")
end
```

### Use Framework Code When...

Framework code lives in `lib/loka/framework/`.

| Scenario | Example | Why Framework? |
|----------|---------|----------------|
| New objective type | "escort NPC" objectives for quests | New capability for ALL quests |
| New combat mechanic | Flanking bonus, combo system | System-wide combat change |
| New script API function | `teleport_player()`, `create_instance()` | Enable new script capabilities |
| Bug fixes | Quest not tracking kills correctly | Fix existing system |
| Performance | Optimize pathfinding, cache lookups | System-level improvement |
| New game system | Guilds, auction house, crafting | Major feature addition |

**Framework examples:**
```elixir
# lib/loka/framework/scripting/bindings/movement.ex
# Adding new API function for scripts to use
def teleport_player(context, room_key) do
  # Implementation that scripts can call
end
```

### Use Engine Code When...

Engine code lives in `lib/loka/engine/`. **Rarely needed.**

| Scenario | Example | Why Engine? |
|----------|---------|-------------|
| Sandbox security | Block new dangerous module | Script isolation |
| Entity fundamentals | Change how entities spawn/save | Core infrastructure |
| Script execution | Change how scripts are parsed/run | Execution model |

### Red Flags: Wrong Layer Detected

🚩 **You're modifying framework code but...**
- The change is specific to ONE NPC/room/quest → Should be a script
- You're hardcoding a character name or location → Should be YAML/script
- Another game using Loka wouldn't want this behavior → Should be a script

🚩 **You're writing a script but...**
- You need to `import` or `require` modules → Needs framework API addition
- The sandbox blocks what you need → Needs framework API addition
- Multiple scripts would duplicate this logic → Needs framework abstraction

🚩 **You're modifying engine code but...**
- It's about game logic (combat, quests) → Should be framework
- It's about specific content → Should be script/YAML

### The Litmus Test

> **"Would a builder creating a different game want to customize this?"**
>
> - YES → It should be scriptable (either already is, or add API)
> - NO → It's a system/engine concern

**Examples applying the test:**

| Request | Litmus Test | Verdict |
|---------|-------------|---------|
| "Make the blacksmith insult players" | Other games have different blacksmiths | **Script** |
| "Add poison damage over time" | All games might want DoT mechanics | **Framework** (new combat system) |
| "Temple room heals players on entry" | Other temples might not heal | **Script** |
| "Add HP regeneration system" | All games might want regen | **Framework** (new system) |
| "Fix quest completion not saving" | Bug affects all games | **Framework** (bug fix) |

### Workflow: Adding New Script Capability

When a script needs something the API doesn't support:

1. **Don't** hack around it in the script
2. **Don't** modify framework to hardcode the behavior
3. **Do** add a new API function to `lib/loka/framework/scripting/bindings/`
4. **Then** use that function in your script

```
Need: Script should be able to teleport players
Wrong: Hardcode teleport logic in framework for specific quest
Right: 1. Add teleport_player() to bindings/movement.ex
       2. Script calls teleport_player("destination_room")
```

## Scripting System Development

Scripts allow builders to customize game content without code access.

### Layer Boundaries

| Task | Layer | Directory |
|------|-------|-----------|
| Sandbox security | Engine | `lib/loka/engine/script/` |
| API bindings | Framework | `lib/loka/framework/scripting/bindings/` |
| Script content | Builder | `priv/world/`, `scripts` table |
| Admin UI | Web | `lib/loka_web/live/admin_live/scripts_tab.ex` |

### Where to Modify

- **Adding new API function**: `lib/loka/framework/scripting/bindings/*.ex`
- **Security/sandbox changes**: `lib/loka/engine/script/sandbox.ex`, `validator.ex`
- **Hook integration**: `lib/loka/framework/scripting/hook_integration.ex`
- **Script content**: Database `scripts` table or YAML `builder_scripts` field

### Script API Categories

```elixir
# Context (read-only)
entity.*, player.*, context.*, room()

# Queries
quest_active?(), has_item?(), get_stat(), entities_in_room()

# Actions (queued)
say(), message(), set_flag(), give_item(), spawn_npc()

# World manipulation
set_room_attr(), lock_exit(), damage(), start_combat()

# Scheduling
after(seconds, script_key), recurring(interval, script_key)
```

See `docs/architecture/elixir-scripts-design.md` for full API reference.

## World Builder Architecture

The World Builder UI follows a layered architecture to avoid code duplication:

### Layer 1: Content Modules (Reusable)
Domain-specific APIs used by BOTH game code AND World Builder UI:
- `Content.Quest` - Quest definitions with objectives
- `Content.Dialogue` - NPC dialogue trees
- `Content.Script` - Elixir scripts for NPCs
- `Content.Zone` - Zone definitions with resets

**When to use:** For any entity type that game code needs to access.

### Layer 2: EntityManager (Generic UI)
Unified CRUD for World Builder UI (`lib/loka/world_builder/entity_manager.ex`):
- Generic entity creation/update/delete
- UI enrichment (TypedObject → frontend maps)
- Listing and searching entities by subtype

**When to use:** For simple entity CRUD in World Builder (NPCs, Items, etc.)

### Layer 3: Specialized Managers (When Needed)
Only create when entity has unique UI requirements:
- `RoomManager` - Exit management, coordinate handling
- `TemplateManager` - Template save/load/instantiate
- `BatchOperations` - Cross-cutting batch operations

**When to use:** Only when EntityManager is insufficient.

### Guidelines

**DO:**
- Use `Content.*` modules for game-wide entity types
- Use `EntityManager` for simple World Builder CRUD
- Create specialized managers only for complex UI needs

**DON'T:**
- Create `NPCManager`, `ItemManager`, etc. (use EntityManager instead)
- Duplicate CRUD logic across multiple managers
- Put UI-specific code in Content modules

**Example:**
```elixir
# ✅ Correct: Use EntityManager for simple entities
EntityManager.create_entity(:npc, %{name: "Guard", level: 5})
EntityManager.create_entity(:item, %{name: "Sword", item_type: "weapon"})

# ✅ Correct: Use specialized manager for complex needs
RoomManager.create_room(%{key: "tavern", x: 5, y: 10})
RoomManager.add_exit("tavern", "north", "street")

# ❌ Wrong: Don't create redundant managers
NPCManager.create_npc(...)  # Use EntityManager instead!
```

## Development Guidelines

- Entities are data structs, behaviors implement callbacks
- PubSub topics: `room:{id}`, `player:{id}`, `entity:{id}`
- Commands return `{:ok, [Event.t()]}` - never mutate directly
- Auto-save dirty entities every 60s via EntityServer
- LiveViews in `lib/loka_web/live/`, JS hooks in `assets/js/app.js`
- **Timers**: Use `Loka.Timers` for persistent timers (crafting, offline progression). Timers survive restarts and continue while players are offline.

## Post-Implementation Verification

After completing tasks, run:
1. `mix test` - ensure nothing broke
2. `mix loka.test.validate` - check content integrity
3. Check common bugs: pattern matching on `{:ok, value}`, nil guards

## Testing Strategy

### Backend E2E Testing (ChannelBot)

For storyline and integration tests, use **ChannelBot** (95% production parity):

```bash
# Run storyline test (ChannelBot - tests real GameChannel code)
mix test test/integration/storyline_channel_test.exs

# Legacy mix task (deprecated - uses old 40% parity bot)
mix loka.test.storyline monastery_arc --run
```

**ChannelBot** tests the actual production code path:
- GameChannel → Actions → Game Logic
- Serialization (what clients receive)
- WebSocket event delivery
- See `test/integration/storyline_channel_test.exs` for examples

**Legacy Bot** (deprecated - use for load testing only):
- `lib/loka/testing/bot/bot.ex` - 40% production parity
- Bypasses channel layer
- In-memory state
- Use for 100+ bot load tests only

### Mobile E2E Testing (Future)

For React Native UI testing, we'll use **Detox or Maestro**:
- Tests full stack: UI → WebSocket → Server → UI
- Complementary to ChannelBot (tests different layer)
- Slower but catches UI/UX bugs
- Planned for separate implementation

## Beads (Issue Tracking)

```bash
bd ready              # Find available work
bd show <id>          # Review issue
bd update <id> --status=in_progress
bd close <id>         # Mark complete
bd sync               # Push to git
```

**Good bead**: Specific file path, line numbers, validation command
**Bad bead**: "Fix dialogue issue" (too vague)

## Documentation Organization

Docs are organized by **traditional MUD roles** (see `docs/README.md` for full structure):

| Role | Directory | Content |
|------|-----------|---------|
| **Builder** | `docs/builder-reference/` | YAML specs (quests, dialogues, entities) |
| **Developer** | `docs/architecture/`, `docs/framework/` | Elixir code, system design |
| **Admin** | `docs/admin/`, `docs/operations/` | Dashboard, live ops, security |

Work is often **cross-cutting** - use docs from any tier as needed.

### Quick Reference

| Topic | Location |
|-------|----------|
| **Quest/Dialogue/Entity YAML** | `docs/builder-reference/` |
| **Architecture Deep-Dive** | `docs/architecture/` |
| **Scripting API** | `docs/architecture/elixir-scripts-design.md` |
| **Game Client** | `docs/reference/game-client.md` |
| **Channel API** | `docs/api/channel-contract.md` |
| **Live Operations** | `docs/operations/live-operations-guide.md` |
| **Audit Commands** | `.claude/commands/` (run `/audit-*`) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register (3/hour) |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/auth/me` | Current player |

Access tokens: 1hr TTL. Refresh tokens: 7 days TTL.

## Environment Variables

```bash
# Production (Fly.io)
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
```
