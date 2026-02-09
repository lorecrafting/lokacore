---
name: world-builder-patterns
description: Ensures World Builder code follows the correct architecture patterns. Use when working with EntityManager, RoomManager, LiveView components, or entity data access.
---

# World Builder Patterns

**Auto-applies when**: Working on terminal builder commands, entity management, or YAML content creation

## Purpose

Ensures builder code follows the terminal architecture and avoids common mistakes in entity data access and YAML handling.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Content Modules (Reusable)                         │
│   Content.Quest, Content.Dialogue, Content.Script           │
│   → Used by game code AND Builder                           │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Managers (CRUD)                                    │
│   EntityManager, RoomManager, QuestManager, etc.            │
│   → Read/write YAML files in priv/world/                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Builder Commands (Terminal UI)                     │
│   16 sub-modules in builder_commands/                       │
│   → Parse user input, call managers, format output          │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: AI Integration                                     │
│   MCP Server → Claude Desktop (no API cost)                 │
│   Anthropic Client → Terminal chat (API per token)          │
│   → Both use same ToolExecutor                              │
└─────────────────────────────────────────────────────────────┘
```

## LLM Integration Architecture

Two paths for AI-assisted world building:

### MCP Server (Recommended Long-Term)
```
Claude Desktop ──MCP──▶ /world_builder_mcp ──▶ ToolExecutor
```
- Uses your Claude subscription (no API cost)
- 16+ tools exposed via Model Context Protocol
- Files: `lib/loka/world_builder/mcp/`

### Terminal Chat
```
Terminal ──Channel──▶ BuilderCommands.AI ──▶ Loka.AI.Conversation ──▶ ToolExecutor
```
- Server-side Anthropic API calls
- Streaming responses to terminal via Channel
- Requires `ANTHROPIC_API_KEY`
- Files: `lib/loka_web/channels/builder_commands/ai.ex`

### Tool Executor (Shared)
Both paths use the same `ToolExecutor.execute/3`:
```elixir
# MCP tool callback
callback: fn args -> ToolExecutor.execute("create_room", args) end

# Terminal AI chat
ToolExecutor.execute(tool_name, input, project_key: project_key)
```

## Key Rules

### 1. Access Entity Data Through Components

**CRITICAL**: Entity properties like `level`, `item_type`, etc. are stored in components, not at the top level.

```elixir
# BAD - Direct property access
npc.level
item.item_type

# GOOD - Access through components
npc.components.stats.level
item.components.item.item_type

# GOOD - Use get_in for safety
get_in(npc, [:components, :stats, :level])
get_in(item, [:components, :item, :item_type])
```

### 2. Use EntityManager for Simple CRUD

```elixir
# GOOD - Use EntityManager for NPCs, Items, etc.
EntityManager.create_entity(:npc, %{name: "Guard", key: "town_guard"})
EntityManager.update_entity(:item, item_id, %{name: "New Name"})
EntityManager.delete_entity(:npc, npc_id)

# BAD - Don't create redundant managers
NPCManager.create_npc(...)  # Use EntityManager instead!
```

### 3. Builder Command Pattern

All builder commands follow the same pattern:
```elixir
defmodule LokaWeb.Channels.BuilderCommands.MyCategory do
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:builder_my_command, %{param: value}, socket) do
    case do_work(value) do
      {:ok, result} ->
        {:ok, format_result(result), socket}
      {:error, reason} ->
        {:error, "Failed: #{reason}", socket}
    end
  end
end
```

### 4. Terminal Markup for Clickable Commands

```elixir
# Wrap commands in {{cmd:COMMAND}}text{{/cmd}} for clickable output
"Type {{cmd:help rooms}}help rooms{{/cmd}} for room commands."
"Go {{cmd:goto town_square}}town_square{{/cmd}}"
```

### 5. YAML Template Building with Heredocs

When building YAML strings with Elixir heredocs (`~s"""`), the dedent strips leading whitespace. Interpolated multiline values must account for this:

```elixir
# BAD - 6 spaces before interpolation, dedent removes 4 → first line gets 2 extra spaces
~s"""
    extra_desc: |
      #{indent_multiline(description, 2)}
"""

# GOOD - 4 spaces = 0 after dedent, indent_multiline handles all indentation
~s"""
    extra_desc: |
    #{indent_multiline(description, 2)}
"""
```

### 6. Tool Execution Resilience

Always wrap `ToolExecutor.execute/3` in `try/rescue` when called from Channel handlers:

```elixir
result =
  try do
    ToolExecutor.execute(tool_name, input, opts)
  rescue
    e ->
      Logger.error("[Builder] Tool #{tool_name} crashed: #{Exception.message(e)}")
      %{"error" => "Tool execution failed: #{Exception.message(e)}"}
  end
```

## Common Bug Patterns

### Pattern 1: Property Access on Wrong Level
```elixir
# BUG
npc.level  # KeyError or nil

# FIX
npc.components.stats.level
```

### Pattern 2: Map.from_struct on Plain Maps
```elixir
# BUG - Data is already a plain map from YAML
Map.from_struct(yaml_data)  # Raises! Not a struct

# FIX
data = if is_struct(data), do: Map.from_struct(data), else: data
```

### Pattern 3: YAML String Keys
```elixir
# BUG - YAML loads with string keys, not atoms
data.key  # KeyError

# FIX
data["key"]
```

## Entity Data Structure Reference

```elixir
# TypedObject entity structure
%TypedObject{
  type: :npc,
  key: "town_guard",
  name: "Town Guard",
  components: %{
    stats: %{level: 5, str: 12, dex: 10},
    equipment: %{weapon: "sword", armor: "chainmail"}
  },
  behaviors: ["combat", "patrol"]
}
```

## Validation

After builder changes:

```bash
# Run builder command tests
mix test test/loka_web/channels/

# Run world builder backend tests
mix test test/loka/world_builder/

# Content validation
mix loka.test.validate
```
