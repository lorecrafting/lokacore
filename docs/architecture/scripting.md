# Scripting System (Elixir Sandbox)

Loka uses sandboxed Elixir for safe scripting that allows game creators to customize entity behavior.

> **Full API Reference**: See `docs/architecture/elixir-scripts-design.md`
> **Implementation Details**: See `docs/architecture/elixir-scripts-implementation.md`

## Architecture

The scripting system uses an **extension pattern** to maintain proper layer separation:

```
┌─────────────────────────────────────────────────────────────┐
│ FRAMEWORK LAYER                                             │
│   Loka.Framework.Scripting.GameScriptAPI                    │
│   - Implements ScriptingExtension behaviour                 │
│   - Provides game-specific Elixir functions                 │
│   - Accesses Player.GameState, Quest.Progress, etc.         │
├─────────────────────────────────────────────────────────────┤
│ ENGINE LAYER                                                │
│   Loka.Engine.Script.Sandbox                                │
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
- Whitelisted bindings only

```elixir
# Basic execution
Scripting.execute(script_source, entity, context, opts)

# With game state context
Scripting.execute(script, entity, %{game_state: player_game_state})
```

## Available Elixir APIs

### Core API (Engine Layer)

Always available, regardless of extensions:

| Function | Description |
|----------|-------------|
| `message(target_id, text)` | Send message to an entity |
| `log(message)` | Log to server console |

### Game API (Framework Extension)

Provided by `GameScriptAPI` extension when `game_state` is in context:

| Function | Description |
|----------|-------------|
| `quest_active?(quest_id)` | Check if quest is active |
| `quest_complete?(quest_id)` | Check if quest is completed |
| `has_item?(item_key)` | Check if player has item |
| `has_flag?(flag_name)` | Check if player has flag |
| `get_stat(stat_name)` | Get player stat value |
| `set_flag(flag_name, value)` | Set flag (queued action) |

**Note**: State-changing functions (`set_flag`, etc.) queue actions rather than directly mutating state. Use dialogue actions for immediate persistence.

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

## Script Examples

### Quest-Based Dialogue

```elixir
# Check quest state for dialogue branching
if quest_active?("main_sleeping_master") do
  message(entity.id, "You're on the right path, traveler.")
else
  message(entity.id, "The monastery needs your help!")
end
```

### Flag-Based Branching

```elixir
# First-time greeting pattern
if has_flag?("spoke_to_elder") do
  "elder_greeting_return"
else
  log("First time talking to elder")
  "elder_greeting_first"
end
```

### Item Checks

```elixir
# Check inventory for quest items
if has_item?("ancient_scroll") do
  message(entity.id, "Ah, you found the scroll!")
  "quest_complete_dialogue"
end
```

## Entity Data in Scripts

Entity data is injected and accessible via bindings:

```elixir
# Entity properties
entity.id
entity.short_desc
entity.long_desc
entity.mood
entity.location

# Context values (passed from Elixir)
context.player_id
context.room_name
```

## Security Model

### Validation

Scripts are validated before execution:

```elixir
Scripting.validate_script(source)
# Returns :ok or {:error, {:blocked_pattern, pattern}}
```

### Restricted Operations

The sandbox prevents:
- File/OS access
- Network operations
- Dynamic code loading
- Arbitrary module access
- System introspection

See `lib/loka/engine/script/validator.ex` for blocked patterns.

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

- [elixir-scripts-design.md](./elixir-scripts-design.md) - Full API reference
- [elixir-scripts-implementation.md](./elixir-scripts-implementation.md) - Implementation details
- [Entity System](./entity-system.md) - Entities that scripts act upon
- [Hooks](./hooks-and-locks.md) - Lifecycle hooks that trigger scripts
- [Events](./events.md) - Event system for script communication
- [Admin Dashboard](../admin/dashboard.md) - Script editor interface
