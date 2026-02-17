# CLAUDE.md - Loka Development Guide

## Project Overview

**Loka** is an Elixir MUD engine framework for building text-based RPGs. Built with Elixir's OTP concurrency, fault tolerance, and real-time LiveView.

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Elixir/Phoenix | 1.19.4 / 1.8.3 |
| Runtime | Erlang/OTP | 28.3 |
| Real-time | Phoenix LiveView | 1.1.19 |
| Database | SQLite (via Ecto) | ecto_sqlite3 |
| Auth | phx.gen.auth + Guardian JWT | 2.4.0 |
| Scripting | Elixir (sandboxed) | Native |
| Mobile Client | Godot | 4.6 |
| Deployment | Fly.io | ~$5/month |

## Architecture

Layers (top to bottom): Game Content (YAML in `priv/world/`) → Game Framework (`lib/loka/framework/`, ~52 modules across 14 directories) → Engine Core (`lib/loka/engine/`) → Session Layer (`lib/loka/session/`) → Platform (Phoenix 1.8, LiveView, Ecto + SQLite)

### Core Patterns (V2)

- **Unified Entity System**: Everything is an entity — rooms, NPCs, items, quests, skills, etc.
- **Single DB Truth**: SQLite is the source of truth. No ETS registries, no dual-store sync.
- **Components**: All game data lives in `entity.components` (JSON map). No `data`, `attributes`, or `contents` fields.
- **Traits**: `entity.traits` — list of behavior module atoms or script maps. Replaces V1 `behaviors`.
- **Prototype System**: YAML templates with inheritance, seeded into DB on startup by `EntitySeeder`
- **GenServer per Entity**: Supervised processes with auto-save (60s dirty check)
- **StateMachine**: Shared state machine engine for quests, combat, crafting, dialogue, NPC AI
- **Event Bus**: Phoenix.PubSub (`location:{id}`, `entity:{id}`)
- **Hooks**: 22 lifecycle event types for extensibility

### Content & Entity Access

**Content modules** provide domain-specific APIs: `Content.Quest`, `Content.Dialogue`, `Content.Script`, `Content.Zone`. Resolution: Content modules → `Entities.find_one(key: key, type: :quest)`.

```elixir
# Content modules (type-safe, convenient)
{:ok, quest} = Content.Quest.get("intro_welcome")
objectives = Content.Quest.objectives(quest)

# Direct entity lookup
entity = Entities.find_one(key: "goblin", type: :npc)
entities = Entities.find_all(type: :room, location_id: zone_id)

# Component accessors (lib/loka/components/)
health = Components.Combatant.health(entity)
```

YAML directories: `priv/world/prototypes/`, `quests/`, `zones/`, `dialogues/`, `scripts/`

## Project Structure

```
lokacore/
├── server/
│   ├── lib/loka/
│   │   ├── engine/           # Core: entities, entity_server, entity_seeder, spawner, state_machine
│   │   ├── components/       # Component accessor modules (24 modules)
│   │   ├── behaviors/        # EntityBehavior modules (guard, patrol, weather, etc.)
│   │   ├── content/          # Content modules (Quest, Dialogue, Script, Zone)
│   │   ├── framework/        # Game subsystems (quest, combat, inventory, etc.)
│   │   ├── timers/           # Persistent timers (crafting, offline progression)
│   │   └── session/          # Client messaging layer
│   ├── lib/loka_web/
│   │   ├── channels/         # Phoenix Channels (game_channel, command_parser, builder_commands)
│   │   └── live/admin_live/  # Admin dashboard + Builder (MUD terminal)
│   └── priv/world/           # YAML game content (prototypes, quests, zones, scripts)
├── docs/                     # Architecture documentation
├── godot-client/             # Godot 4.6 mobile client (3D "magic book")
└── CLAUDE.md
```

## Quick Commands

```bash
# Server Development
cd server
mix deps.get && mix ecto.setup    # Setup
mix phx.server                     # Start at localhost:4000
mix test                           # Run tests
mix credo                          # Code quality
mix dialyzer                       # Type checking (first run builds PLT)
mix loka.test                     # All tests (unit + content + balance)
mix loka.test --quick             # Skip slow balance simulations
mix loka.test.validate            # Validate prototypes, quests, dialogues
mix loka.validate.yaml            # Quick YAML syntax check
mix test test/integration/storyline_channel_test.exs  # ChannelBot E2E (95% parity)

# Content Scaffolding
mix loka.new quest|npc|room <name>

# Godot Client
cd godot-client
./dev.sh                          # Hot reload (~1s per change)
./build_web.sh --fast             # Quick build (~30s)
./check.sh                        # Validate scripts (headless)
./run_tests.sh                    # Run unit tests

# Deployment
fly deploy
```

## Routes

| Path | Description | Auth |
|------|-------------|------|
| `/` | Landing page | No |
| `/admin` | Admin dashboard | Admin |
| `/admin/builder` | MUD terminal builder (content creation) | Admin |
| `/client/auth/login` | Game client auth (magic link → JWT deep link) | No |

Main game client is the Godot app connecting via Phoenix Channels.

## Key Design Decisions

1. **Godot Client**: 3D "magic book" for mobile/web (see `docs/decisions/2026-01-26-godot-client-migration.md`)
2. **SQLite**: Simpler, cheaper, sufficient for single-server MVP
3. **No Redis**: ETS handles caching until multi-server needed
4. **Elixir Scripting**: Sandboxed Elixir for game customization (replaces Lua)

## Development Guidelines

- Actions return `{:ok, Result.t()}` with events - never mutate directly
- **Timers**: Use `Loka.Timers` for persistent timers (survive restarts, work offline)
- **Function Clause Grouping**: Keep all clauses of the same function together. Don't place private helpers between `handle_event/3` or `handle_info/2` clauses.
- **No inline computation in `render/1`**: Cache results in assigns, update via helpers when source data changes.
- **HEEx `:if` directives** only, never ERB `<%= if %>` syntax.
- **Shared UI components** in `admin_live/components.ex` (badges, stat_cards, etc.)
- **All public functions require `@spec`** — use domain types (`Entity.t()`, `StateMachine.t()`, not `map()`)
- **Property tests** for math invariants, roundtrips, state machines — use `ExUnitProperties` + shared generators in `test/support/generators.ex`

## Pre-Commit Hooks

**Pre-commit:** Elixir formatting, compile (warnings-as-errors), YAML validation, GDScript validation, secrets scan.
**Pre-push:** Content validation (`mix loka.test.validate --quick`).
Skip with `git commit --no-verify` (use sparingly).

## Post-Implementation Verification

1. `mix test` - ensure nothing broke
2. `mix loka.test.validate` - check content integrity
3. `mix compile --warnings-as-errors` - no warnings
4. `mix dialyzer` - type correctness (when PLT is built)
5. Check: all public functions have `@spec`, pattern matching on `{:ok, value}`, nil guards

## Documentation & References

Docs organized by MUD roles: **Builder** (`docs/builder-reference/`), **Developer** (`docs/architecture/`, `docs/framework/`), **Admin** (`docs/admin/`, `docs/operations/`).

| Topic | Location |
|-------|----------|
| Quest/Dialogue/Entity YAML | `docs/builder-reference/` |
| Architecture | `docs/architecture/` |
| Scripting API | `docs/architecture/elixir-scripts-design.md` |
| Channel API | `docs/api/channel-contract.md` |
| Live Operations | `docs/operations/live-operations-guide.md` |
| Audit Commands | `.claude/commands/` (run `/audit-harness`) |

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
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
```
