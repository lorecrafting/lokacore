# Hooks & Locks

Loka provides two systems for extensibility and access control.

## Hooks System

Hooks allow registering callbacks for lifecycle events. They provide extension points for game logic without modifying core engine code.

### Hook Types

| Category | Hook | When Called |
|----------|------|-------------|
| **Entity Lifecycle** | `:at_entity_creation` | Entity first created |
| | `:at_entity_delete` | Entity being destroyed |
| | `:at_pre_save` | Before entity is persisted |
| | `:at_post_load` | After entity loaded into memory |
| **Movement** | `:at_before_move` | Before entity moves (can halt) |
| | `:at_after_move` | After entity has moved |
| | `:at_enter_room` | Entity entered a room |
| | `:at_leave_room` | Entity left a room |
| **Perception** | `:at_before_look` | Before looking at something |
| | `:at_after_look` | After looking at something |
| | `:at_object_receive` | Entity received an object |
| | `:at_object_leave` | Object left entity's inventory |
| **Communication** | `:at_before_say` | Before entity says something |
| | `:at_after_say` | After entity said something |
| **Commands** | `:at_pre_command` | Before command execution (can halt) |
| | `:at_post_command` | After command execution |
| | `:at_command_fail` | Command failed |
| **Combat** | `:at_before_attack` | Before attack (can halt) |
| | `:at_after_attack` | After attack processed |
| | `:at_damage` | Entity took damage |
| | `:at_death` | Entity died |
| **Scripts** | `:at_script_execute` | Script about to run |
| | `:at_script_error` | Script had an error |

### Registering Hooks

```elixir
# Register a hook handler
Hooks.register(
  :at_entity_creation,     # Hook type
  MyGame.Combat,           # Module
  :on_entity_create,       # Function
  priority: 10             # Lower = earlier (default: 100)
)

# The handler function
defmodule MyGame.Combat do
  def on_entity_create(entity, context) do
    # Initialize combat stats if entity has combatant component
    if entity.components["combatant"] do
      # ... setup logic
    end
    {:ok, entity}
  end
end
```

### Callback Validation

Hooks validates callbacks at registration time. This catches errors early:

```elixir
# ✅ Valid - module and function exist
Hooks.register(:at_entity_creation, MyGame.Combat, :on_entity_create)
# => :ok

# ❌ Invalid hook type
Hooks.register(:invalid_hook, MyGame.Combat, :on_entity_create)
# => {:error, {:invalid_hook_type, :invalid_hook}}

# ❌ Module not loaded
Hooks.register(:at_entity_creation, NonExistent.Module, :foo)
# => {:error, {:module_not_loaded, NonExistent.Module}}

# ❌ Function doesn't exist
Hooks.register(:at_entity_creation, MyGame.Combat, :nonexistent_function)
# => {:error, {:callback_not_found, MyGame.Combat, :nonexistent_function}}
```

Use `skip_validation: true` for testing with mock modules:

```elixir
Hooks.register(:at_entity_creation, TestMock, :callback, skip_validation: true)
```

### Hook Execution

```elixir
# Fire-and-forget (all hooks run, results ignored)
Hooks.run(:at_after_say, [entity, message])

# Run until halt (stops on first {:halt, reason})
case Hooks.run_until_halt(:at_before_move, [entity, destination]) do
  :ok -> proceed_with_move()
  {:halt, reason} -> {:error, reason}
end
```

### Hook Handler Return Values

```elixir
# Success - continue to next hook
{:ok, entity}
{:ok, entity, context}

# Halt - stop processing (for run_until_halt)
{:halt, "You cannot move while stunned"}
{:halt, :blocked}

# Error - logged, processing continues
{:error, reason}
```

### Hook Priority

Hooks execute in priority order (lower = earlier):

```elixir
Hooks.register(:at_before_move, ValidateMove, :check, priority: 10)   # Runs first
Hooks.register(:at_before_move, LogMovement, :log, priority: 50)      # Runs second
Hooks.register(:at_before_move, TriggerTrap, :check, priority: 100)   # Runs last
```

---

## Locks System

Locks provide string-based access control. They're evaluated at runtime to determine if an accessor can perform an action on an entity.

### Lock String Format

```
lockfunc(args) [AND|OR] lockfunc2(args) [AND|OR NOT lockfunc3(args)]
```

### Built-in Lock Functions

| Function | Description | Example |
|----------|-------------|---------|
| `all()` | Always passes | `"all()"` |
| `none()` | Always fails | `"none()"` |
| `perm(name)` | Check permission | `"perm(admin)"` |
| `attr(name, val)` | Check attribute equals | `"attr(level, 10)"` |
| `attr_gt(name, val)` | Attribute greater than | `"attr_gt(strength, 50)"` |
| `attr_lt(name, val)` | Attribute less than | `"attr_lt(level, 5)"` |
| `id(entity_id)` | Match entity ID | `"id(abc123)"` |
| `tag(name)` | Entity has tag | `"tag(admin)"` |
| `has_item(key)` | Has item in inventory | `"has_item(gold_key)"` |
| `has_key(key)` | Alias for has_item | `"has_key(skeleton_key)"` |
| `is_type(type)` | Accessor is type | `"is_type(character)"` |
| `in_room(room_key)` | Accessor is in room | `"in_room(throne_room)"` |

### Lock Examples

```elixir
# Anyone can look
"all()"

# Only admins can edit
"perm(admin)"

# Owner or admin
"id(owner_id_123) OR perm(admin)"

# Has the key and high enough strength
"has_key(gold_key) AND attr_gt(strength, 50)"

# Builder permission, but not if item is broken
"perm(builder) AND NOT tag(broken)"

# Complex example
"(perm(admin) OR id(owner123)) AND NOT tag(banned)"
```

### Entity Lock Configuration

Locks are stored per-action on entities:

```elixir
entity = %Entity{
  locks: %{
    "get" => "all()",
    "drop" => "all()",
    "use" => "perm(admin) OR attr_gt(level, 10)",
    "edit" => "perm(builder)",
    "delete" => "perm(admin)"
  }
}
```

In YAML prototypes:

```yaml
key: magic_sword
type: item
name: "Enchanted Sword"
locks:
  get: "attr_gt(strength, 30)"
  use: "tag(warrior) OR tag(paladin)"
  drop: "none()"  # Cannot be dropped
```

### Checking Locks

```elixir
# Check if accessor can perform action on entity
case Locks.check(entity, accessor, "get") do
  :ok ->
    # Access granted
    do_get(entity, accessor)
  {:denied, reason} ->
    # Access denied
    {:error, reason}
end

# Evaluate lock string directly
Locks.evaluate("perm(admin) OR id(abc123)", accessor, entity)
# => true | false
```

### Custom Lock Functions

Register custom lock functions via ETS:

```elixir
# Register custom function
Locks.register_function(:is_guild_member, fn args, accessor, _target ->
  guild_id = List.first(args)
  accessor.components["guild"]["id"] == guild_id
end)

# Use in lock string
"is_guild_member(thieves_guild)"
```

### Lock Evaluation

Locks are parsed into an AST and evaluated:

```elixir
# Tokenize
"perm(admin) OR id(123)"
# => [{:func, "perm", ["admin"]}, :or, {:func, "id", ["123"]}]

# Parse to AST
# => {:or, {:func, "perm", ["admin"]}, {:func, "id", ["123"]}}

# Evaluate with accessor and target
# => true | false
```

---

## Usage Patterns

### Validation Hook

```elixir
# Prevent movement while in combat
Hooks.register(:at_before_move, __MODULE__, :check_combat, priority: 10)

def check_combat(entity, _destination, context) do
  if context[:in_combat] do
    {:halt, "You cannot move while in combat!"}
  else
    {:ok, entity}
  end
end
```

### Access Control for Commands

```elixir
# In command execution
def execute(command, entity, target) do
  case Locks.check(target, entity, command.action) do
    :ok -> do_execute(command, entity, target)
    {:denied, reason} -> {:error, reason}
  end
end
```

### Combining Hooks and Locks

```elixir
# Hook that checks locks
def at_before_get(entity, target, context) do
  case Locks.check(target, entity, "get") do
    :ok -> {:ok, entity}
    {:denied, _} -> {:halt, "You can't pick that up."}
  end
end
```

## Related

- [Entity System](./entity-system.md) - Entity structure
- [Entity Lifecycle](./entity-lifecycle.md) - When hooks fire
- [Commands](./commands.md) - Command pipeline and hooks
- [Scripting](./scripting.md) - Elixir scripts and hooks
