# AI Tool Access Modes

## Overview

The AI system supports two access modes that control what tools are available and what data is returned:

| Mode | Who | Tools | Data |
|------|-----|-------|------|
| `:builder` | Builder terminal (`/ai`, `chat` mode) | All 40+ tools (CRUD + queries) | Full entity dump (components, metadata, traits) |
| `:player` | Future spark companion AI | Read-only query tools only | Redacted (no internal state) |

## Architecture

The mode is enforced at **three layers** (defense in depth):

```
Layer 1: Tool Selection (what the LLM sees)
  AnthropicClient.get_tools(:builder)  ->  all 40+ tools
  AnthropicClient.get_tools(:player)   ->  3 read-only tools only

Layer 2: Execution Gate (what the executor allows)
  ToolExecutor.execute("wb_create_room", input, mode: :player)
    -> {:error, "Tool 'wb_create_room' is not available in player mode"}

Layer 3: Data Serialization (what the response contains)
  GameQueries.serialize_entity(entity, :builder)  ->  full dump
  GameQueries.serialize_entity(entity, :player)   ->  redacted
```

### Layer 1: Tool Selection

`MCP.Tools.tools/1` returns different tool lists per mode:

- `:builder` returns all tools (guidance, rooms, entities, quests, dialogues, zones, cutscenes, storylines, scripts, queries, analysis)
- `:player` returns only `game_query_tools()` (3 tools: `wb_get_entity`, `wb_query_entities`, `wb_get_player_state`)

The tool list is passed to the Anthropic API at conversation init, so the LLM never even sees mutation tools in player mode.

### Layer 2: Execution Gate

Even if an LLM somehow hallucinated a tool name not in its tool list, `ToolExecutor.execute/3` checks `opts[:mode]` against `@player_tools` allowlist before dispatching:

```elixir
@player_tools ~w(get_entity query_entities get_player_state)

if opts[:mode] == :player and not player_allowed?(normalized_name) do
  {:error, "Tool '#{tool_name}' is not available in player mode"}
end
```

### Layer 3: Data Serialization

`GameQueries` serializers accept a mode parameter:

**`:builder` mode** returns everything:
- `id`, `key`, `type`, `name`, `description`, `location_id`
- `prototype_key`, `tags`, `traits`, `metadata`
- `components` (full map, all keys)

**`:player` mode** returns a safe subset:
- `id`, `key`, `type`, `name`, `description`, `location_id`, `tags`
- `components` with `@redacted_components` stripped:
  - `cooldowns`, `respawn_data`, `despawned`, `metadata`
  - `player`, `combatant`, `stats`, `resource_pools`, `resources`
- No `prototype_key`, `traits`, or `metadata`

## How Mode Flows Through the System

```
ai.ex ensure_conversation()
  |-- AnthropicClient.get_tools(:builder)         # Layer 1
  |-- tool_executor_fn closure captures mode
        |-- ToolExecutor.execute(name, input,
              character: character,
              mode: :builder)                      # Layer 2
              |-- dispatch(name, input, opts)
                    |-- GameQueries.execute_*(input, opts)
                          |-- serialize_entity(entity, :builder)  # Layer 3
```

For the future player AI, the only change needed is:

```elixir
# In the player-facing AI conversation setup:
config = %{
  tools: AnthropicClient.get_tools(:player),
  tool_executor_fn: fn name, input, _opts ->
    character = get_current_character()
    ToolExecutor.execute(name, input, character: character, mode: :player)
  end,
  ...
}
```

## Rich Context (System Prompt Injection)

Independent of tools, the AI system prompt includes a game state snapshot rebuilt fresh on each message:

**Room context:**
- Key, title, description (truncated to 300 chars), exits, NPCs present, items on ground
- Loaded fresh via `RoomHelpers.load_room_for_character` (not from stale socket assigns)

**Character context:**
- Name, level, XP, gold, health/mana, stats
- Inventory with resolved item names (via `Entities.find_one`)
- Equipment slots with resolved names
- Active quests with objective progress (`[x]`/`[ ]` markers, current/target counts)
- Completed quests, player flags

## Stale Data Prevention

The tool executor closure reads character from the process dictionary, not a closed-over variable:

```elixir
# Before each send_message:
Process.put(:loka_ai_character, socket.assigns[:character])

# In the closure:
character = Process.get(:loka_ai_character)
```

This ensures the tool executor always sees the latest character state, even mid-conversation after the player picks up items or completes quests.

## Files

| File | Role |
|------|------|
| `lib/loka_web/channels/builder_commands/ai.ex` | Builder AI conversation setup, context building, system prompt |
| `lib/loka/world_builder/mcp/tools.ex` | Tool definitions, `tools/1` mode filter |
| `lib/loka/world_builder/anthropic_client.ex` | `get_tools/1` mode passthrough |
| `lib/loka/world_builder/tool_executor.ex` | Dispatch + mode enforcement gate |
| `lib/loka/world_builder/tool_executor/game_queries.ex` | Read-only query handlers + builder/player serializers |

## Adding New Player-Safe Tools

1. Add tool definition to `game_query_tools()` in `mcp/tools.ex`
2. Add execution handler in `game_queries.ex`
3. Add the normalized name to `@player_tools` in `tool_executor.ex`
4. Use `opts[:mode]` in the handler to control data serialization
