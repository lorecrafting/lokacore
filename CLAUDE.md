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
| Mobile Client | React Native / Expo | 54 |
| **Book Client** | **Rust / Bevy** | **0.15** |
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

TypedObject provides a unified foundation for all game content. **Content modules** wrap TypedObject with domain-specific APIs:

| Module | Type | Purpose |
|--------|------|---------|
| `Content.Quest` | `:quest` | Quest definitions with objectives |
| `Content.Dialogue` | `:dialogue` | NPC dialogue trees |
| `Content.Script` | `:script` | Elixir scripts for NPCs |
| `Content.Zone` | `:zone` | Zone definitions with resets |

**What are Content modules?** Domain-specific wrappers around `TypedObject.Loader` that provide type-safe, convenient APIs for accessing game content. Think of them as specialized query interfaces.

**Resolution Order**: Content modules → TypedObject.Loader → YAML files

```elixir
# ✅ PREFER: Content modules (type-safe, convenient)
{:ok, quest} = Content.Quest.get("intro_welcome")
objectives = Content.Quest.objectives(quest)          # Domain helper
giver_key = Content.Quest.giver_key(quest)           # Type-safe accessor

# ❌ DON'T: Direct TypedObject.Loader (verbose, error-prone)
{:ok, obj} = TypedObject.Loader.get("intro_welcome")
objectives = get_in(obj.data, ["objectives"]) || []  # Manual data access
```

**When to use Content modules:**
- Game logic needs quest/dialogue/script data
- You want type safety and helper functions
- You need validation (e.g., `Content.Quest.validate/1`)

**When to use TypedObject.Loader directly:**
- Generic operations across all types
- Custom content types not in Content modules
- Low-level YAML loading/caching

**YAML Loading**: TypedObject.Loader loads from multiple directories:
- `priv/world/prototypes/` - Entity prototypes
- `priv/world/quests/` - Quest definitions
- `priv/world/zones/` - Zone definitions
- `priv/world/dialogues/` - Dialogue trees
- `priv/world/scripts/` - Elixir scripts

**Example:**
```elixir
# Framework code accessing quest data
defmodule Loka.Framework.Quest do
  alias Loka.Content.Quest

  def start_quest(player, quest_key) do
    # Use Content.Quest for type-safe access
    with {:ok, quest} <- Quest.get(quest_key),
         :ok <- Quest.validate(quest),
         true <- can_accept?(player, quest) do
      objectives = Quest.objectives(quest)
      rewards = Quest.rewards(quest)
      # ...
    end
  end

  defp can_accept?(player, quest) do
    # Content module provides helpers
    Quest.prerequisites(quest)
    |> Enum.all?(&quest_complete?(player, &1))
  end
end
```

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
├── book-client/              # Rust/Bevy 3D book renderer (NEW)
│   ├── src/
│   │   ├── book/            # Page mesh, curl animation
│   │   ├── text/            # cosmic-text integration
│   │   ├── effects/         # Shader effects (fire, ice, etc.)
│   │   └── input/           # Touch/tap detection
│   └── shaders/             # WGSL shader files
└── CLAUDE.md
```

## Rust/Bevy Book Client Development

The `book-client/` folder contains a Rust-based 3D renderer for immersive visual moments - cinematic quest intros, combat effects, and the magical book interface. This complements React Native, which handles social/chat features.

**Architecture**: See `docs/architecture/client-architecture.md` for the full hybrid React Native + Bevy strategy.

**Key principle**: Use Bevy for "wow moments" (dragon fly-bys, screen shake, spell effects), React Native for daily interactions (chat, inventory lists, settings). Both connect to the same Phoenix Channel backend.

This section covers Bevy-specific development, which is fundamentally different from web/Elixir development.

### Key Differences from Web Development

| Aspect | Web/Elixir | Rust/Bevy Game Engine |
|--------|------------|----------------------|
| Feedback loop | Hot reload (~100ms) | Compile + run (~5-30s) |
| Testing | Mostly automated | Visual verification + unit tests |
| Debugging | Print/logger | Logger + visual inspection |
| State | Server manages | Client local (synced from server) |
| Performance | "Good enough" | 60fps critical, measure everything |

### Rust/Bevy Development Workflow

```bash
# Terminal 1: Run the visual test app (primary feedback)
cd book-client
cargo run --bin test-app
# Watch the window! This IS your feedback loop

# Terminal 2: Auto-rebuild on changes (optional)
cargo watch -x "build --lib"

# Run unit tests (non-visual logic)
cargo test

# Check for issues without running
cargo clippy
cargo fmt --check
```

### The Visual Verification Loop

Unlike web dev where you can inspect DOM/state, game engine verification is VISUAL:

1. **Change code** → Save
2. **cargo run** → Watch the window
3. **Ask yourself:**
   - Does the page render?
   - Does the curl look smooth?
   - Is text readable?
   - Any flickering/artifacts?
4. **Check console** → Errors, FPS, debug logs
5. **Repeat**

### When to Write Tests vs Visual Check

| Scenario | Approach |
|----------|----------|
| Math functions (curl calculation) | **Unit test** |
| Mesh generation (vertex count) | **Unit test** |
| "Does it look right?" | **Visual verification** |
| Shader effects | **Visual verification** |
| Performance (60fps) | **Profiler + visual** |
| Input handling | **Manual testing** |

### Test App Controls

```
ESC       - Quit
SPACE     - Toggle auto curl animation
UP/DOWN   - Manual curl adjustment
R         - Reset to flat
```

### Common Bevy Patterns

```rust
// Components are data, attached to entities
#[derive(Component)]
struct Page { index: u32 }

// Resources are global singletons
#[derive(Resource)]
struct PageCurlState { curl_amount: f32 }

// Systems are functions that run every frame
fn update_curl(
    time: Res<Time>,                           // Access resources
    mut query: Query<&mut Transform, With<Page>> // Query entities
) {
    for mut transform in query.iter_mut() {
        // Modify components
    }
}

// Plugins group related functionality
impl Plugin for BookPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, setup)
           .add_systems(Update, (system_a, system_b));
    }
}
```

### Common Bevy Pitfalls

**UV Coordinate Y-Axis Mismatch**: Bevy's UV space has Y=0 at bottom-left (matches DirectX/Vulkan/Metal), but pixel/screen space has Y=0 at top. When converting pixel coordinates to UV for hit testing or UI bounds, flip the Y axis: `uv_y = 1.0 - (pixel_y / height)`. See the `bevy-0-15-coordinate-state-patterns` skill for details.

**State Machine Reset**: Custom animation state machines must explicitly reset phase enums in reset functions, even if the animation system already transitioned to `Idle`. Race conditions between systems can leave stale state that blocks new transitions. Always include `self.phase = Phase::Idle` in reset methods.

### Performance Debugging

```rust
// Add to your app for FPS display
.add_plugins(FrameTimeDiagnosticsPlugin)

// Time operations
let start = std::time::Instant::now();
// ... operation ...
debug!("Operation took: {:?}", start.elapsed());

// Profile with Instruments (macOS)
// Product > Profile > Time Profiler in Xcode
```

### Proposal & Plan Documents

- `docs/proposals/rust-book-client.md` - Full feasibility study
- `docs/proposals/rust-book-client-mvp-plan.md` - Implementation plan

## Quick Commands

```bash
# Elixir/Phoenix Development
cd server
mix deps.get && mix ecto.setup    # Setup
mix phx.server                     # Start Phoenix at localhost:4000

# Rust/Bevy Book Client Development
cd book-client
cargo build                        # Compile (first time: 5-10 min)
cargo run --bin test-app          # Run visual test app
cargo test                        # Run unit tests
cargo watch -x "run --bin test-app"  # Auto-restart on changes
mix loka.dev                       # Start Phoenix + mobile Expo (with debug logs)
mix loka.dev --server              # Phoenix only (with mobile debug log streaming)
mix test                           # Run tests

# Validation
mix loka.test                     # All tests (unit + content + balance)
mix loka.test --quick             # Skip slow balance simulations
mix loka.test.validate            # Validate prototypes, quests, dialogues
mix loka.test.storyline --list    # List available storylines
mix loka.test.storyline <id>      # Validate storyline structure (legacy)

# Recommended: ChannelBot storyline test (95% production parity)
mix test test/integration/storyline_channel_test.exs

# Content Scaffolding
mix loka.new quest <name>         # Generate quest YAML scaffold
mix loka.new npc <name>           # Generate NPC YAML scaffold
mix loka.new room <name>          # Generate room YAML scaffold

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

Scripts live in `priv/world/scripts/*.yml` (YAML files are the single source of truth).

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

### YAML-Only Architecture (Single Source of Truth)

All game content uses YAML as the single source of truth:

```
┌─────────────────────────────────────────────────────────────┐
│ Content Sources                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  priv/world/scripts/*.yml     → Scripts                     │
│  priv/world/prototypes/*.yml  → NPCs, Items, Rooms          │
│  priv/world/quests/*.yml      → Quests                      │
│  priv/world/dialogues/*.yml   → Dialogues                   │
│                                                             │
│  All loaded by TypedObject.Loader at startup                │
│  Hot-reload with: mix loka.reload                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Developer workflow:**
1. Edit YAML files directly (or via Claude)
2. Run `mix loka.reload` in dev to pick up changes
3. Deploy to push changes to production

**Admin UI:** Scripts tab is read-only (view source only). Editing requires YAML modification.

### Behaviors, Emotes, and Scripts Pattern

Three complementary systems for NPC/entity customization:

| Layer | Purpose | Files | Example |
|-------|---------|-------|---------|
| **Behaviors** | Reusable mechanics | `priv/world/scripts/behaviors/*.yml` | patrol, day_night_schedule |
| **Emotes** | Personality text | Entity YAML `emotes:` section | waking_up, greeting |
| **Scripts** | Custom one-off logic | `priv/world/scripts/*.yml` | quest-specific triggers |

**Pattern**: Behaviors emit events → Emotes display personality text

```yaml
# NPC with behavior that triggers emotes
key: monastery_guard
type: npc
emotes:
  waking_up: "*stretches and performs exercises* The watch begins."
  patrol_arrive: "*scans the area with vigilance*"
  going_to_sleep: "*sets staff beside mat* May the night be peaceful."
behaviors:
  - script: patrol
    config:
      route: [gate, courtyard, temple]
      interval: 180
  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: dusk
```

**When to use each:**
- **Behavior**: When the *mechanic* is reusable (patrol, schedules, spawning)
- **Emote**: When you want *personality* in event responses
- **Script**: When you need *custom logic* specific to one entity

**Available behaviors**: patrol, day_night_schedule, shopkeeper_hours, wander, ambient_emitter, nocturnal, spawn_condition_time

See `docs/builder-reference/behaviors.md` and `docs/builder-reference/emotes.md` for full reference.

### Future: Templates + Instances Architecture

> **Known Limitation:** The current YAML-only architecture requires file system access.
> Non-technical builders who can only use the Admin UI cannot create or edit content.

**Proposal**: See `docs/proposals/builder-content-layer.md` for the full design.

**Key architecture** (inspired by [Evennia](https://www.evennia.com/docs/latest/Components/Prototypes.html), Unity Prefabs):
- **Templates** (YAML): Define vocabulary - what kinds of things CAN exist (`base_monk`, `base_guard`)
- **Instances** (Database): Define content - what things DO exist (`monastery:novice_pema`)
- **Our content too**: Monastery Arc built as instances, validating builder workflow
- **Seeding**: Fresh deploy loads instances from `priv/seeds/instances/` YAML
- **Export**: Nightly job exports DB to YAML for git history/backups

This is deferred until we have actual non-technical builders. See `lokacore-12r`.

### Layer Boundaries

| Task | Layer | Directory |
|------|-------|-----------|
| Sandbox security | Engine | `lib/loka/engine/script/` |
| API bindings | Framework | `lib/loka/framework/scripting/bindings/` |
| Script content | Builder | `priv/world/scripts/*.yml` |
| Admin UI | Web | `lib/loka_web/live/admin_live/scripts_tab.ex` (read-only) |

### Where to Modify

- **Adding new API function**: `lib/loka/framework/scripting/bindings/*.ex`
- **Security/sandbox changes**: `lib/loka/engine/script/sandbox.ex`, `validator.ex`
- **Hook integration**: `lib/loka/framework/scripting/hook_integration.ex`
- **Script content**: YAML files in `priv/world/scripts/`

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
- Actions return `{:ok, Result.t()}` with events - never mutate directly
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

## Issue Tracking

See `docs/BACKLOG.md` for planned work and issues. Active work is tracked using Claude Code's native task tools during development sessions.

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
| **Client Architecture (React Native + Bevy)** | `docs/architecture/client-architecture.md` |
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
