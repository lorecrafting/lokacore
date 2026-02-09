---
description: Start World Builder UI development session
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
---

# Terminal Builder Session

You are now in **Builder Mode**, focused on the MUD terminal builder in `lib/loka_web/channels/builder_commands/` and `lib/loka/world_builder/`.

## Session Setup

Before diving in, clarify:
1. **What command/feature** are you implementing or modifying?
2. **Which command module** is affected (Rooms, Entities, Content, Scripts, etc.)?
3. **What user input** should trigger what behavior?

## Architecture Reminder

```
Browser (MudTerminal hook)
  ↕ Phoenix Channel (WebSocket)
GameChannel → CommandParser.parse/1 → {:builder_*, params}
  → execute_builder_command/3 (admin gate)
  → BuilderCommands.execute/3 → dispatches to sub-module
  → Sub-module → calls Manager → pushes output
```

## Key Files

| File | Purpose |
|------|---------|
| `command_parser.ex` | Input → `{:builder_*, params}` tuples |
| `builder_commands.ex` | Dispatcher to 16 sub-modules |
| `builder_commands/*.ex` | 16 command modules |
| `entity_manager.ex` | Generic entity CRUD |
| `room_manager.ex` | Room-specific (exits, YAML) |
| `tool_executor.ex` | AI tool execution |

## Command Module Pattern

```elixir
defmodule LokaWeb.Channels.BuilderCommands.MyCategory do
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:builder_my_command, %{param: value}, socket) do
    case do_work(value) do
      {:ok, result} -> {:ok, format_result(result), socket}
      {:error, reason} -> {:error, "Failed: #{reason}", socket}
    end
  end
end
```

Return values: `{:ok, text, socket}` | `{:ok, socket}` | `{:error, text, socket}` | `{:ok_text, text}`

## Development Workflow

```
1. Add command atom to CommandParser
2. Add atom to category list in BuilderCommands
3. Implement execute/3 in sub-module
4. Test: mix test test/loka_web/channels/
5. Manual test in browser at /admin/builder
```

## Quick Commands

```bash
# Start server
mix phx.server

# Parser tests
mix test test/loka_web/channels/command_parser_test.exs

# All channel tests
mix test test/loka_web/channels/

# Backend tests
mix test test/loka/world_builder/
```

## Key Documentation

| Topic | Location |
|-------|----------|
| Terminal Builder | `docs/architecture/terminal-builder.md` |
| Channel Contract | `docs/api/channel-contract.md` |

## What NOT To Do

- Don't create redundant managers (use EntityManager for NPCs/Items)
- Don't forget to add command atom to both parser AND dispatcher
- Don't forget `try/rescue` around ToolExecutor calls
- Don't use `{{cmd:}}` markup without accounting for it in display_length

## End of Session

Before finishing:
1. Test in browser at `localhost:4000/admin/builder`
2. Run `mix test test/loka_web/channels/`
3. Commit: `git add . && git commit -m "builder: ..."`
