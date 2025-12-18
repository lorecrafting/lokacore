# Scripting System (Lua Integration)

ExMUD uses Lua (via Luerl) for safe, sandboxed scripting that allows game creators to customize entity behavior.

## Sandboxed Execution

Scripts run in a sandboxed environment with:
- No file system access
- No network access
- CPU/memory limits
- Controlled API exposure

```elixir
defmodule Exmud.Engine.Scripting do
  @max_reductions 10_000  # CPU limit
  @max_memory_kb 1024     # Memory limit

  def execute(script, entity, context \\ %{}) do
    lua = init_sandbox()
    |> inject_entity(entity)
    |> inject_context(context)
    |> inject_api()

    case Lua.eval(lua, script, max_reductions: @max_reductions) do
      {:ok, result, new_lua} ->
        {:ok, extract_changes(new_lua, entity)}
      {:error, reason} ->
        {:error, {:script_error, reason}}
    end
  end
end
```

## Game API for Scripts

Functions exposed to Lua scripts:

| Function | Description |
|----------|-------------|
| `game.message(target_id, text)` | Send message to player |
| `game.message_room(room_id, text)` | Broadcast to room |
| `game.move_entity(entity_id, to_id)` | Move entity to location |
| `game.spawn_entity(template, location)` | Create entity from template |
| `game.emit_event(type, payload)` | Emit custom event |
| `game.set_flag(key, value)` | Set entity flag |
| `game.get_flag(key)` | Get entity flag |
| `game.start_quest(player_id, quest_id)` | Start quest for player |
| `game.gain_xp(player_id, amount)` | Award experience |
| `game.delay(ms, callback)` | Delayed execution |
| `game.random()` / `game.random(min, max)` | Random numbers |

## Script Examples

### NPC Greeting (at_player_enter hook)
```lua
function on_player_enter(player)
  if player.level < 5 then
    game.message(player.id, "Welcome, young adventurer!")
    game.message(player.id, "Would you like me to explain things?")
  else
    game.message(player.id, "Greetings, " .. player.name .. ".")
  end
end
```

### Shop Keeper (at_greet hook)
```lua
function on_greet(player)
  local relationship = entity.get_relationship(player.id)

  if relationship < 0 then
    game.message(player.id, "I don't serve troublemakers.")
    return false  -- Cancel interaction
  end

  if relationship > 50 then
    game.message(player.id, "My favorite customer!")
    entity.set_flag("show_rare_items", true)
  else
    game.message(player.id, "Welcome to my shop.")
  end

  return true
end
```

### Boss AI (at_tick hook)
```lua
function on_tick()
  local health_pct = entity.health.current / entity.health.max

  -- Enrage at 25% health
  if health_pct < 0.25 and not entity.get_flag("enraged") then
    entity.set_flag("enraged", true)
    game.message_room(entity.location, entity.name .. " becomes enraged!")
    entity.stats.strength = entity.stats.strength * 1.5
  end

  -- Random ability usage in combat
  if entity.in_combat and game.random() < 0.3 then
    local abilities = {"fireball", "tail_sweep", "roar"}
    local ability = abilities[game.random(1, #abilities)]
    game.use_ability(entity.id, ability, entity.combat_target)
  end
end
```

## Security Model

### Blocked Globals
```elixir
@blocked_globals [
  "os", "io", "file", "require", "dofile", "loadfile",
  "debug", "package", "rawget", "rawset", "rawequal"
]
```

### Allowed Libraries
```elixir
@allowed_math ["abs", "ceil", "floor", "max", "min", "random", "sqrt"]
@allowed_string ["byte", "char", "find", "format", "gsub", "len",
                 "lower", "match", "rep", "sub", "upper"]
@allowed_table ["concat", "insert", "remove", "sort", "unpack"]
```

### Static Analysis
```elixir
def validate_script(source) do
  checks = [
    &check_blocked_globals/1,
    &check_infinite_loops/1,
    &check_memory_abuse/1,
  ]

  Enum.reduce_while(checks, :ok, fn check, _acc ->
    case check.(source) do
      :ok -> {:cont, :ok}
      error -> {:halt, error}
    end
  end)
end
```

## Available Hooks

| Hook | Trigger | Cancellable? |
|------|---------|--------------|
| at_entity_creation | Entity first created | No |
| at_entity_init | Entity loaded to memory | No |
| at_entity_save | Before persistence | No |
| at_pre_move | Before entity moves | Yes |
| at_post_move | After entity moved | No |
| at_player_enter | Player enters room | No |
| at_player_leave | Player leaves room | No |
| at_pre_get | Before pickup | Yes |
| at_post_get | After pickup | No |
| at_use | Item used | No |
| at_pre_attack | Before attack | Yes |
| at_damage | Entity takes damage | No |
| at_death | Entity dies | No |
| at_tick | World tick | No |
| at_greet | Player starts interaction | Yes |

## Script Storage

Scripts are stored in the `scripts` table:

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

## Testing Scripts

The admin dashboard provides a test execution feature:

```elixir
def test_execute(script_id, test_context \\ %{}) do
  script = get_script!(script_id)

  # Create mock entity for testing
  mock_entity = %Entity{
    id: UUID.uuid4(),
    type: :npc,
    name: "Test NPC"
  }

  execute(script.source, mock_entity, test_context)
end
```

## Related
- [Events](./events.md) - Events that trigger script hooks
- [Entity System](./entity-system.md) - Entities that scripts act upon
- [Admin Dashboard](../admin/dashboard.md) - Script editor interface
