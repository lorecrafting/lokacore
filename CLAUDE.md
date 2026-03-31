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
| Mobile Client | React Native (Expo) | SDK 52 |
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
├── rn-client/                # React Native (Expo) mobile client
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

# Dev Game Console (test game state without browser)
# HTTP endpoint (against running server — fastest):
curl -s http://localhost:4000/dev/cmd -H "Content-Type: application/json" \
  -d '{"command": "look"}' | jq -r '.output'
curl -s http://localhost:4000/dev/reset -H "Content-Type: application/json" \
  -d '{}' | jq -r '.output'                              # Teleport to starting room

# Telnet (interactive + ambient events — needs server restart to activate):
nc localhost 4023                                        # Interactive session
printf "look\nnorth\nlook\n" | nc localhost 4023        # Multi-step sequence

# Mix task (offline, starts own app — slow on first use):
mix loka.console "look" "talk thera" "1" north look

# React Native Client
cd rn-client
npm start                         # Start Expo dev server
npm run ios                       # iOS simulator
npm run android                   # Android emulator

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

Main game client is the React Native (Expo) app connecting via Phoenix Channels. Godot client archived on `archive/godot-client` branch.

## Key Design Decisions

1. **React Native Client**: Expo-based mobile client replacing the Godot "magic book" (archived on `archive/godot-client`)
2. **SQLite**: Simpler, cheaper, sufficient for single-server MVP
3. **No Redis**: ETS handles caching until multi-server needed
4. **Elixir Scripting**: Sandboxed Elixir for game customization (replaces Lua)

## Sub-Agent Model Policy

When using the Task tool to spawn sub-agents:

**Model selection:**
- Use `model: "sonnet"` for all execution tasks — file edits, targeted searches, bash commands, test runs, content changes, any well-scoped unit of work
- Use `model: "opus"` only when the sub-task itself requires deep architectural reasoning across many files
- Default to `model: "sonnet"` when in doubt — it handles the vast majority of implementation work well

**Task prompt quality (non-negotiable):**
Sub-agent prompts must be self-contained and explicit. The sub-agent has no memory of the parent conversation. Every prompt must include:
- **What** to do — the exact change, in concrete terms
- **Where** — specific file paths, function names, line references if known
- **Why** — enough context to make correct judgment calls (e.g., which pattern to follow, what invariant to preserve)
- **How to verify** — what success looks like (test to run, output to check, pattern to confirm)
- **Constraints** — relevant conventions, things NOT to change, architectural rules that apply

A vague prompt like "fix the authentication bug" is not acceptable. Write it as if handing off to a skilled developer who has never seen the codebase.

## Development Guidelines

- Actions return `{:ok, Result.t()}` with events - never mutate directly
- **`Actions.execute/3` without a socket**: Build `%Context{player_id, player_name, character, room, dialogue, combat, container}` manually, call `Actions.execute(action, params, ctx)` → `{:ok, result}`. Format `result.events` as text: `{:event, text}`, `{:dialogue_start, data}`, `{:room_changed, data}`. Used by `Loka.Dev.GameConsole`.
- **Dev tools only in supervision tree**: Use `Mix.env() == :dev` in `application.ex` children list for dev-only supervised processes. Pattern: `children = [...] ++ if Mix.env() == :dev, do: [MyServer], else: []`
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
