# Scripting System (Lua Integration)

Loka uses Lua (via Luerl) for safe, sandboxed scripting that allows game creators to customize entity behavior.

## Architecture

The scripting system uses an **extension pattern** to maintain proper layer separation:

```
┌─────────────────────────────────────────────────────────────┐
│ FRAMEWORK LAYER                                             │
│   Loka.Framework.Scripting.GameScriptAPI                    │
│   - Implements ScriptingExtension behaviour                 │
│   - Provides game-specific Lua functions                    │
│   - Accesses Player.GameState, Quest.Progress, etc.         │
├─────────────────────────────────────────────────────────────┤
│ ENGINE LAYER                                                │
│   Loka.Engine.Scripting                                     │
│   - Sandbox execution environment                           │
│   - Core API (message, log)                                 │
│   - Extension loading mechanism                             │
│                                                             │
│   Loka.Engine.ScriptingExtension (behaviour)                │
│   - Defines interface for extensions                        │
│   - api_namespace/0, api_functions/0 callbacks              │
└─────────────────────────────────────────────────────────────┘
```

This design ensures the Engine layer remains game-agnostic while the Framework layer provides game-specific functionality (quests, inventory, stats, etc.).

## Sandboxed Execution

Scripts run in a sandboxed environment with:
- No file system access
- No network access
- 5 second timeout (configurable)
- Result size limits (prevent memory exhaustion)
- Blocked dangerous Lua globals

```elixir
# Basic execution
Scripting.execute(script_source, entity, context, opts)

# With game state context
Scripting.execute(script, entity, %{game_state: player_game_state})
```

## Available Lua APIs

### Core API (Engine Layer)

Always available, regardless of extensions:

| Function | Description |
|----------|-------------|
| `game.message(target_id, text)` | Send message to an entity |
| `game.log(message)` | Log to server console |

### Game API (Framework Extension)

Provided by `GameScriptAPI` extension when `game_state` is in context:

| Function | Description |
|----------|-------------|
| `game.quest.is_active(quest_id)` | Check if quest is active |
| `game.quest.is_complete(quest_id)` | Check if quest is completed |
| `game.quest.complete_objective(quest_id, obj_id)` | Complete objective (logs only) |
| `game.player.has_item(item_key)` | Check if player has item |
| `game.player.has_flag(flag_name)` | Check if player has flag |
| `game.player.get_stat(stat_name)` | Get player stat value |
| `game.player.set_flag(flag_name, value)` | Set flag (logs intent only) |
| `game.player.get_skill_level(skill_name)` | Get skill level |

**Note**: State-changing functions (`set_flag`, `complete_objective`) log intent but don't persist changes. Use dialogue actions for persistence.

## Configuration

Extensions are configured in `config/config.exs`:

```elixir
config :loka, :scripting_extensions, [
  Loka.Framework.Scripting.GameScriptAPI
]
```

Or pass extensions at runtime:

```elixir
Scripting.execute(script, entity, context, extensions: [MyCustomExtension])
```

## Creating Custom Extensions

Extensions implement the `ScriptingExtension` behaviour:

```elixir
defmodule MyGame.CustomScriptAPI do
  @behaviour Loka.Engine.ScriptingExtension

  @impl true
  def api_namespace, do: "custom"

  @impl true
  def api_functions do
    %{
      "greet" => &greet/2,
      "utils" => %{
        "roll_dice" => &roll_dice/2
      }
    }
  end

  defp greet([name], lua) when is_binary(name) do
    {["Hello, " <> name], lua}
  end

  defp greet(_, lua), do: {["Hello!"], lua}

  defp roll_dice([sides], lua) when is_number(sides) do
    {[:rand.uniform(round(sides))], lua}
  end

  defp roll_dice(_, lua), do: {[1], lua}
end
```

This creates:
- `custom.greet("Alice")` → "Hello, Alice"
- `custom.utils.roll_dice(20)` → random 1-20

### Function Signature

All Lua API functions must follow the Luerl signature:

```elixir
(args :: list(), lua_state) :: {results :: list(), lua_state}
```

- `args` - List of arguments from Lua
- `lua_state` - Opaque Luerl state (pass through)
- Returns `{[return_values], lua_state}`

## Script Examples

### Quest-Based Dialogue
```lua
-- Check quest state for dialogue branching
if game.quest.is_active("main_sleeping_master") then
  game.message(entity.id, "You're on the right path, traveler.")
else
  game.message(entity.id, "The monastery needs your help!")
end
```

### Flag-Based Branching
```lua
-- First-time greeting pattern
if game.player.has_flag("spoke_to_elder") then
  return "elder_greeting_return"
else
  game.log("First time talking to elder")
  return "elder_greeting_first"
end
```

### Item Checks
```lua
-- Check inventory for quest items
if game.player.has_item("ancient_scroll") then
  game.message(entity.id, "Ah, you found the scroll!")
  return "quest_complete_dialogue"
end
```

## Entity Data in Scripts

Entity data is injected and accessible via the `entity` global:

```lua
-- Entity properties
local id = entity.id
local name = entity.short_desc
local desc = entity.long_desc
local mood = entity.mood
local location = entity.location
```

Context data is accessible via the `context` global:

```lua
-- Access context values (passed from Elixir)
local player_id = context.player_id
local room_name = context.room_name
```

## Security Model

### Blocked Globals

The following Lua globals are removed from the sandbox:

```
dofile, loadfile, load, loadstring, rawget, rawset, rawequal,
rawlen, getmetatable, setmetatable, collectgarbage, module,
require, newproxy, os, io, debug, package, coroutine
```

### Static Analysis

Scripts are validated before execution:

```elixir
Scripting.validate_script(source)
# Returns :ok or {:error, {:blocked_pattern, pattern}}
```

Blocked patterns include:
- File/OS access (`os.`, `io.`, `file.`)
- Debug/introspection (`debug.`, `package.`)
- Dynamic code loading (`load(`, `loadstring(`, `require(`)
- Metatable manipulation (`getmetatable(`, `setmetatable(`)
- Global table access (`_G`, `_ENV`)
- Memory abuse (`string.rep` with large numbers)
- Infinite loops (`while true do end`)

## Script Storage

Scripts are stored in the `scripts` table for runtime customization:

```sql
CREATE TABLE scripts (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  hook TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  inserted_at DATETIME,
  updated_at DATETIME
);
```

## Related

- [Entity System](./entity-system.md) - Entities that scripts act upon
- [Hooks](./hooks-and-locks.md) - Lifecycle hooks that trigger scripts
- [Events](./events.md) - Event system for script communication
- [Admin Dashboard](../admin/dashboard.md) - Script editor interface
