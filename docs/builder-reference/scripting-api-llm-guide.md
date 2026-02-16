# Scripting API Reference for LLMs (V2)

> **Optimized for AI/LLM Context Injection**
>
> This guide provides the complete scripting API for Loka's game content scripting system. Use this when generating scripts for NPCs, rooms, items, and quests.

---

## Quick Reference

**Current Implementation:** Sandboxed Elixir scripts (via `Code.eval_string`)
**Storage:** Database (`entities` table, `components["data"]`) and YAML files (`priv/world/scripts/`)
**Execution:** Sandboxed - only approved functions available via bindings
**Timeout:** 5 seconds max per script
**Max Size:** 10,000 characters

---

## API Categories

1. [Context Variables](#context-variables) (read-only game state)
2. [Query Functions](#query-functions) (check conditions)
3. [Action Functions](#action-functions) (trigger effects)
4. [Utility Functions](#utility-functions) (helpers)
5. [Control Flow](#control-flow) (script execution control)

---

## Context Variables

These are read-only values available in all scripts (bound as variables, not map access):

```elixir
# Entity being scripted
entity_id                  # UUID string
entity_key                 # Prototype key, e.g., "novice_pema"
entity_type                # :npc, :item, :room, etc.

# Current player (if applicable)
player_id                  # Player UUID
player                     # Player entity struct

# Trait-specific bindings
config                     # Trait configuration map
trait_state                # Current trait state
```

---

## Query Functions

Check conditions without modifying state.

### Quest Functions

```elixir
quest_active.("quest_key")          # Returns true/false
quest_complete.("quest_key")        # Returns true/false
```

### Player Functions

```elixir
has_item.("item_key")               # Returns true/false
has_flag.("flag_name")              # Returns true/false
```

### Room Functions

```elixir
room_exits.()                       # Returns list of exit maps
entities_in_room.()                 # Returns list of entity structs
```

---

## Action Functions

These queue actions to be executed AFTER the script completes.

### Communication

```elixir
message.("text")                     # Send message to player/room
log.("debug message")                # Log to server console
```

### Movement

```elixir
move_entity.(entity_id, room_id)     # Move entity to room
teleport.(entity_id, room_id)        # Teleport entity
```

### Trait State

```elixir
get_trait_state.("key")              # Get trait state value
set_trait_state.("key", value)       # Set trait state value
get_behavior_state.("key")           # Legacy alias for get_trait_state
set_behavior_state.("key", value)    # Legacy alias for set_trait_state
```

### Events

```elixir
emit.(event_key)                     # Emit event for emotes
continue.()                          # Allow event to continue
handled.()                           # Mark event as handled
```

### Timers

```elixir
on_cooldown.("cooldown_key")         # Check cooldown status
cooldown_remaining.("cooldown_key")  # Get remaining time
set_cooldown.("cooldown_key", seconds) # Set cooldown
```

---

## Utility Functions

Standard Elixir functions available in the sandbox:

```elixir
# String manipulation
String.downcase("TEXT")                     # Convert to lowercase
String.upcase("text")                       # Convert to uppercase
String.contains?("haystack", "needle")      # Check substring
String.slice("text", 0..3)                  # Substring

# List operations
Enum.map(list, fn x -> x * 2 end)
Enum.filter(list, fn x -> x > 5 end)
length(list)

# Math
:rand.uniform()                             # Random 0-1
Enum.random(list)                           # Random element
```

---

## Control Flow

Standard Elixir control flow is available:

```elixir
# Conditionals
if condition do
  # code
else
  # code
end

# Multi-branch using cond
cond do
  quest_active.("main_quest") -> "active_dialogue"
  quest_complete.("main_quest") -> "completed_dialogue"
  true -> "intro_dialogue"
end

# Pattern matching with case
case player do
  %{level: level} when level >= 10 -> :high_level
  %{level: level} when level >= 5 -> :mid_level
  _ -> :low_level
end

# Boolean logic
if has_flag.("met_elder") and quest_active.("monastery") do
  # code
end

if has_item.("key") or has_item.("lockpick") do
  # code
end

unless quest_complete.("intro") do
  # code
end
```

---

## Script Return Values

Scripts must return values appropriate to their hook type:

```elixir
# Trait scripts typically signal completion
handled.()  # Mark event as handled
continue.() # Allow event to continue

# Conditional scripts return boolean
quest_active.("main_quest")  # Returns true/false

# State access returns values
get_trait_state.("last_patrol_time")
```

---

## Common Patterns

### 1. Trait State Management

```elixir
# Script: patrol trait
# Hook: on_tick

# Get last patrol time
last_time = get_trait_state.("last_patrol_index") || 0

# Calculate next index
route = config["route"]
next_index = rem(last_time + 1, length(route))

# Update state
set_trait_state.("last_patrol_index", next_index)

# Move to next room
next_room = Enum.at(route, next_index)
move_entity.(entity_id, next_room)

# Emit arrival event
emit.(:patrol_arrive)

handled.()
```

### 2. Conditional Behavior

```elixir
# Script: time_based_spawn trait
# Hook: on_tick

# Get current game time
hour = time_of_day.()

# Check if in active hours
active_hours = config["active_hours"] || []

if hour in active_hours do
  # Spawn logic
  prototype = config["prototype"]
  max_count = config["max_count"] || 1

  # Check current spawn count
  current = get_trait_state.("spawn_count") || 0

  if current < max_count do
    spawn_npc.(prototype)
    set_trait_state.("spawn_count", current + 1)
    emit.(:spawned_entity)
  end
else
  # Despawn logic
  despawn_spawned.()
  set_trait_state.("spawn_count", 0)
  emit.(:despawned_entities)
end

handled.()
```

### 3. Emote-Driven Behavior

```elixir
# Script: ambient_emitter trait
# Hook: on_tick

# Check chance
chance = config["chance"] || 100
random_value = :rand.uniform(100)

if random_value <= chance do
  # Emit the configured event
  emote_key = config["emote_key"] || :ambient
  emit.(emote_key)
end

handled.()
```

### 4. Multi-Condition Logic

```elixir
# Script: training_availability
# Hook: Dialogue condition

has_quest = quest_active.("training_quest")
has_completed = quest_complete.("training_quest")

cond do
  has_completed -> "training_completed"
  has_quest and has_flag.("advanced_training") -> "training_advanced"
  has_quest -> "training_beginner"
  true -> "training_not_started"
end
```

### 5. Action Modifier Checks

```elixir
# Script: check_meditation_unlocked
# Hook: Action availability check

cond do
  has_flag.("meditation_unlocked") -> true
  has_flag.("meditation_blocked") -> false
  true -> false
end
```

---

## Anti-Patterns (Don't Do This)

### ❌ Missing Dot-Call Syntax

```elixir
# WRONG: Will fail at runtime
message("hello")              # Error: undefined function
emit(:event)                  # Error: undefined function

# RIGHT: Use dot-call syntax
message.("hello")             # Works
emit.(:event)                 # Works
```

### ❌ Forbidden Functions

```elixir
# These will cause validation/runtime errors:
File.read("file.txt")         # ❌ No file I/O
System.cmd("rm", ["-rf"])     # ❌ No OS access
Code.eval_string("code")      # ❌ No dynamic code
:erlang.halt()                # ❌ No system control
```

### ❌ Infinite Loops

```elixir
# WRONG: Will timeout after 5 seconds
while true do
  message.("spam")
end

# RIGHT: Use single execution
if has_flag.("needs_reminder") do
  message.("Don't forget the key!")
end
```

### ❌ Complex Business Logic

```elixir
# WRONG: Too complex for a script
base = attacker_str * 2
defense = defender_armor / 3
crit = if :rand.uniform() > 0.9, do: 2, else: 1
# 50 more lines...

# RIGHT: Complex systems belong in Framework modules
# Scripts are for content customization, not game systems
```

---

## Debugging Scripts

### Validation Errors

When a script fails validation, you'll see errors like:

```
Script validation failed: Forbidden pattern: /System\./
```

**Common causes:**
- Using forbidden modules (System, File, Process, etc.)
- Syntax errors
- Script too long (>10,000 chars)

### Runtime Errors

If a script crashes during execution:

```
Script execution error: attempt to index nil value
```

**Common causes:**
- Accessing undefined context variables
- Type mismatches (string vs number)
- Calling undefined functions

### Testing Scripts

Use the admin UI script editor "Test" feature to run scripts with mock data before deploying.

---

## Script Hooks Reference

Scripts can attach to these entity hooks:

| Hook | When It Fires | Available Bindings | Expected Return |
|------|---------------|-------------------|-----------------|
| `trait` | Periodic tick or event | `entity_id`, `config`, `trait_state`, plus action bindings | `handled.()` or `continue.()` |
| `on_enter` | Player enters room | `player`, `room` | N/A (check only) |
| `on_say` | Speech in room | `player`, `message` | N/A (check only) |
| `on_look` | Entity examined | `player`, `entity` | N/A (check only) |

**Note:** Trait scripts have full action bindings. Event scripts are typically read-only checks.

---

## Best Practices

### ✅ DO

1. **Keep scripts simple** - Under 50 lines when possible
2. **Check conditions** - Use scripts for branching logic
3. **Return early** - Exit as soon as you have an answer
4. **Use descriptive names** - `elder_greeting_first` not `script1`
5. **Comment complex logic** - `# Check if player completed training arc`
6. **Test thoroughly** - Use admin UI test feature

### ✅ DON'T

1. **Don't modify state** - Use dialogue actions instead
2. **Don't write game systems** - Use Framework/Plugins for that
3. **Don't use forbidden functions** - Stick to approved API
4. **Don't create infinite loops** - Scripts timeout after 5s
5. **Don't duplicate logic** - Extract common checks to shared scripts
6. **Don't return nil unexpectedly** - Always have a fallback case

---

## Example: Complete Dialogue Condition Script

```elixir
# Script key: monastery_elder_greeting_logic
# Purpose: Determine which greeting dialogue node to use based on player state
# Hook: dialogue_condition
# Entity: monastery_elder

cond do
  # Check quest completion first (highest priority)
  quest_complete.("sleeping_master_quest") ->
    "elder_grateful_savior"

  # Active quest with sub-checks
  quest_active.("sleeping_master_quest") and has_flag.("identified_traitor") ->
    "elder_quest_climax"

  quest_active.("sleeping_master_quest") and has_flag.("searched_caves") ->
    "elder_quest_progress"

  quest_active.("sleeping_master_quest") ->
    "elder_quest_active_start"

  # Returning visitor
  has_flag.("met_monastery_elder") ->
    "elder_greeting_return"

  # First time meeting
  true ->
    "elder_greeting_first_time"
end
```

---

## FAQ

**Q: Can scripts modify the database directly?**
A: No. Scripts are read-only. Use dialogue actions for state changes.

**Q: Can I call other scripts from a script?**
A: No. Scripts run in isolation. Extract common logic to shared Elixir functions in the Framework layer instead.

**Q: How do I test scripts without deploying?**
A: Use the admin UI script editor's "Test" button with mock player data.

**Q: What's the performance impact of scripts?**
A: Minimal. Scripts execute in ~1-5ms. Avoid loops and complex calculations.

**Q: Can scripts access the internet?**
A: No. No network access, file I/O, or OS commands allowed.

**Q: How do I debug a script?**
A: Use `log.("debug message")` to log to server console. Check logs with `tail -f logs/dev.log`.

---

## Complete API Surface (Alphabetical)

```elixir
# Context Variables (bound as variables)
entity_id, entity_key, entity_type       # Entity context
player_id, player                         # Player context
config, trait_state                       # Trait context

# Query Functions (all use dot-call syntax)
quest_active.(quest_id)                   # boolean
quest_complete.(quest_id)                 # boolean
has_item.(item_key)                       # boolean
has_flag.(flag_name)                      # boolean
room_exits.()                             # list of maps
entities_in_room.()                       # list of structs

# Action Functions (all use dot-call syntax)
message.(text)                            # Send message
log.(message)                             # Log to console
move_to.(room_key)                        # Move entity
teleport.(player_id, room_key)            # Teleport player
emit.(event_key)                          # Emit event
get_trait_state.(key)                     # Get state
set_trait_state.(key, value)              # Set state
continue.()                               # Continue event
handled.()                                # Mark handled
on_cooldown.(key)                         # Check cooldown
cooldown_remaining.(key)                  # Get remaining time
set_cooldown.(key, seconds)               # Set cooldown

# Elixir Standard Library (sandbox-safe subset)
String.downcase, String.upcase, String.contains?, String.slice
Enum.map, Enum.filter, Enum.at, Enum.random, length
:rand.uniform
if/do/else/end, cond/do, case/do, unless/do
```

---

**Last Updated:** 2026-02-15
**Status:** V2 sandboxed Elixir implementation
**Critical**: Always use dot-call syntax for function bindings in scripts
**Contact:** See `docs/architecture/elixir-scripts-design.md` for implementation details
