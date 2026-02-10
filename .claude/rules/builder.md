---
paths: ["lib/loka_web/channels/builder_commands/**", "lib/loka_web/channels/command_parser.ex", "lib/loka_web/channels/game_channel.ex", "lib/loka/world_builder/**"]
---

# Terminal Builder Context

This context auto-loads when working on the MUD terminal builder.

## Architecture Overview

```
Browser (MudTerminal hook)
  ↕ Phoenix Channel (WebSocket)
GameChannel
  → CommandParser.parse/1          → {:builder_goto, %{room_key: "tavern"}}
  → execute_builder_command/3      → checks player.is_admin
  → BuilderCommands.execute/3      → dispatches to sub-module
  → BuilderCommands.Rooms.execute  → calls RoomManager, pushes output
```

### Command Flow

1. User types in terminal → `MudTerminal` hook pushes `"command"` event via Channel
2. `GameChannel.handle_in("command")` → `CommandParser.parse(input)`
3. Parser returns `{:builder_*atom, %{params}}` for builder commands
4. `strip_builder_prefix/1` dynamically removes prefix → `execute_builder_command/3` gates on `player.is_admin`
5. `BuilderCommands.execute/3` dispatches to the correct sub-module via attribute-based guard clauses
6. Sub-module returns `{:ok, text, socket}` | `{:ok, socket}` | `{:error, text, socket}`

### Module Map

| Module | Purpose |
|--------|---------|
| `CommandParser` | Splits input, pattern matches to `{:builder_*, params}` tuples |
| `BuilderCommands` | Thin dispatcher routing to sub-modules via attribute guards |
| `BuilderCommands.Rooms` | Room CRUD: dig, link, @desc, @name |
| `BuilderCommands.Entities` | NPC/Item CRUD |
| `BuilderCommands.Content` | Quest/Dialogue CRUD |
| `BuilderCommands.Scripts` | Script CRUD, templates, attach/detach |
| `BuilderCommands.Zones` | Zone CRUD |
| `BuilderCommands.Cutscenes` | Cutscene CRUD |
| `BuilderCommands.Storylines` | Storyline CRUD |
| `BuilderCommands.Navigation` | goto, rooms, where |
| `BuilderCommands.Inspection` | info, list, find |
| `BuilderCommands.Testing` | spawn, purge, give, flags, godmode |
| `BuilderCommands.World` | reload, validate, settime |
| `BuilderCommands.Map` | Zone layout and inline minimap |
| `BuilderCommands.AI` | `/ai` commands, chat mode, streaming |
| `BuilderCommands.Help` | Categorized help system |
| `BuilderCommands.Guides` | Markdown guide reader |
| `BuilderCommands.Formatter` | Tables, sections, display_length, count_label |
| `BuilderCommands.Helpers` | teleport_to_room, normalize_direction, ensure_dir, push_builder |

### Backend Managers (in `lib/loka/world_builder/`)

| File | Purpose |
|------|---------|
| `room_manager.ex` | Room YAML CRUD |
| `entity_manager.ex` | NPC/Item prototype CRUD |
| `quest_manager.ex` | Quest YAML CRUD |
| `dialogue_manager.ex` | Dialogue YAML CRUD |
| `validation_manager.ex` | Content validation |
| `tool_executor.ex` | Executes MCP/AI tool calls |
| `yaml_builder.ex` | YAML generation utilities |
| `anthropic_client.ex` | Claude API client (streaming SSE) |
| `script_templates.ex` | 15 built-in script templates |
| `audit_log.ex` | Builder action logging |
| `mcp/` | MCP server (tools.ex, router.ex, server.ex) |

## Key Rules

### 1. Command Parser Conventions

- Builder commands return atoms prefixed with `:builder_*`
- Support abbreviations: `n`→north, `dl`→dialogue, `sc`→script, `cs`→cutscene, `sl`→storyline
- Multi-word commands: `create <type> <args>`, `edit <type> <args>`
- All output uses `Helpers.push_builder/2` (prefixes with `[BUILDER]`)

### 2. Sub-Module Return Values

```elixir
# Standard returns from sub-module execute/3:
{:ok, text, socket}    # Success with output text
{:ok, socket}          # Success, output already pushed
{:error, text, socket} # Error with message
{:ok_text, text}       # Raw text (no [BUILDER] prefix)
```

### 3. Terminal Markup

Clickable commands use `{{cmd:COMMAND}}text{{/cmd}}` markup:
```elixir
"Type {{cmd:help rooms}}help rooms{{/cmd}} for room commands."
```
The `Formatter.display_length/1` strips markup tags when calculating column widths for tables.

### 4. YAML Operations

All content CRUD goes through managers that read/write YAML in `priv/world/`. After mutations, call `TypedObject.Loader.reload()` to refresh ETS caches.

### 5. AI Integration

- `BuilderCommands.AI` handles `/ai` prompts and chat mode toggle
- Uses `Loka.AI.Conversation` for streaming (NOT the old `chat.ex`)
- Tool calls go through `ToolExecutor.execute/3`
- MCP server exposes same tools for Claude Desktop

## Validation

```bash
# Parser tests
mix test test/loka_web/channels/command_parser_test.exs

# Formatter tests
mix test test/loka_web/channels/builder_commands/formatter_test.exs

# Security tests (admin gating)
mix test test/loka_web/channels/builder_command_security_test.exs

# CRUD integration tests
mix test test/loka_web/channels/builder_crud_test.exs

# YAML builder tests
mix test test/loka/world_builder/yaml_builder_test.exs
```

## Documentation

- `docs/architecture/terminal-builder.md`
- `docs/api/channel-contract.md`
