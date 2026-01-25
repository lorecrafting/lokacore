# Scripting API Reference for LLMs

> **Optimized for AI/LLM Context Injection**
>
> This guide provides the complete scripting API for Loka's game content scripting system. Use this when generating scripts for NPCs, rooms, items, and quests.

---

## Quick Reference

**Current Implementation:** Lua scripts (via Luerl)
**Storage:** Database (`scripts` table) and YAML files (`priv/world/scripts/`)
**Execution:** Sandboxed - only approved functions available
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

These are read-only values available in all scripts:

```lua
-- Entity being scripted
entity.id                  -- UUID string
entity.key                 -- Prototype key, e.g., "novice_pema"
entity.type                -- "npc", "item", "room", etc.
entity.short_desc          -- Name, e.g., "Novice Pema"
entity.long_desc           -- Room description sentence
entity.extra_desc          -- Detailed examine text
entity.mood                -- Current mood string
entity.location            -- Room ID where entity is

-- Current player (if applicable)
player.id                  -- Player UUID
player.name                -- Player display name
player.level               -- Player level

-- Event context (varies by hook)
context.trigger            -- What triggered: "enter", "say", "look", etc.
context.message            -- For say events: what was said
context.target             -- For targeted actions: target entity ID
context.room               -- Current room data
context.time               -- Game time: {hour: 14, day: 3, season: "summer"}
```

---

## Query Functions

Check conditions without modifying state. Always return boolean or value.

### Quest Functions

```lua
game.quest.is_active("quest_key")           -- Returns true/false
game.quest.is_complete("quest_key")         -- Returns true/false
game.quest.complete_objective("quest_key", "objective_id")  -- Returns true/false
```

### Player Functions

```lua
game.player.has_item("item_key")            -- Returns true/false
game.player.has_flag("flag_name")           -- Returns true/false
game.player.get_stat("stat_name")           -- Returns number
game.player.get_skill_level("skill_name")   -- Returns number
```

### Action Functions

```lua
game.actions.is_granted("action_key")       -- Returns true/false
game.actions.is_blocked("action_key")       -- Returns true/false
game.actions.get_granted()                  -- Returns array of keys
game.actions.get_blocked()                  -- Returns array of keys
```

---

## Action Functions

These queue actions to be executed AFTER the script completes. Never execute immediately.

### Communication

```lua
game.message(entity_id, "text")             -- Send message to entity/player
game.log("debug message")                   -- Log to server console
```

**Note:** For NPC speech and player messages, use dialogue system actions (`set_flag`, dialogue node responses) rather than script actions.

### State Changes

**IMPORTANT:** Scripts are **read-only**. Use dialogue system actions for state changes:

```yaml
# In dialogue YAML:
actions:
  - type: set_flag
    flag: _granted_actions
    value:
      - key: "meditate"
        label: "Meditate"
        description: "Find inner peace"

  - type: set_flag
    flag: spoke_to_elder
    value: true
```

Scripts can CHECK state but not CHANGE it directly. The `game.player.set_flag()` function only logs intent - it doesn't persist.

---

## Utility Functions

Currently limited to Lua standard library functions allowed by the sandbox:

```lua
-- String manipulation
string.lower("TEXT")                        -- Convert to lowercase
string.upper("text")                        -- Convert to uppercase
string.find("haystack", "needle")           -- Find substring
string.sub("text", 1, 4)                    -- Substring (1-indexed)

-- Table/Array operations
table.insert(list, value)
table.remove(list, index)
#list                                       -- Get length

-- Math
math.random()                               -- Random 0-1
math.random(n)                              -- Random 1-n
math.random(min, max)                       -- Random in range
math.floor(n), math.ceil(n), math.round(n)
```

---

## Control Flow

Standard Lua control flow is available:

```lua
-- Conditionals
if condition then
  -- code
elseif other_condition then
  -- code
else
  -- code
end

-- Multi-branch
if game.quest.is_active("main_quest") then
  return "active_dialogue"
elseif game.quest.is_complete("main_quest") then
  return "completed_dialogue"
else
  return "intro_dialogue"
end

-- Pattern matching (using if/elseif)
local keyword = string.lower(context.message or "")
if string.find(keyword, "help") then
  -- handle help
elseif string.find(keyword, "quest") then
  -- handle quest
end

-- Boolean logic
if game.player.has_flag("met_elder") and game.quest.is_active("monastery") then
  -- code
end

if game.player.has_item("key") or game.player.has_item("lockpick") then
  -- code
end

if not game.quest.is_complete("intro") then
  -- code
end
```

---

## Script Return Values

Scripts must return values appropriate to their hook type:

```lua
-- Dialogue node selection (dialogue scripts)
return "elder_greeting_first"               -- Returns node key
return "elder_greeting_return"

-- Conditional logic (dialogue conditions)
return game.quest.is_active("main_quest")   -- Returns boolean

-- Default behavior
return nil                                  -- Use default processing
```

---

## Common Patterns

### 1. Quest-Based Dialogue Branching

```lua
-- Script: elder_greeting
-- Hook: Used in dialogue condition

if game.quest.is_complete("sleeping_master") then
  return "elder_grateful"
elseif game.quest.is_active("sleeping_master") then
  if game.player.has_flag("found_culprit") then
    return "elder_progress_good"
  else
    return "elder_progress_searching"
  end
else
  return "elder_intro"
end
```

### 2. Flag-Based State Tracking

```lua
-- Script: check_first_visit
-- Hook: Dialogue condition

if game.player.has_flag("visited_monastery") then
  return "monastery_return_greeting"
else
  return "monastery_first_greeting"
end

-- Note: Set flag via dialogue action:
-- actions:
--   - type: set_flag
--     flag: visited_monastery
--     value: true
```

### 3. Item Requirement Checks

```lua
-- Script: gate_keeper_check
-- Hook: Dialogue condition

if game.player.has_item("monastery_pass") then
  return "gate_keeper_allow"
elseif game.player.has_item("elder_letter") then
  return "gate_keeper_verify"
else
  return "gate_keeper_deny"
end
```

### 4. Multi-Condition Logic

```lua
-- Script: training_availability
-- Hook: Dialogue condition

local has_quest = game.quest.is_active("training_quest")
local has_completed = game.quest.is_complete("training_quest")
local skill_level = game.player.get_skill_level("swordsmanship")

if has_completed then
  return "training_completed"
elseif has_quest and skill_level >= 5 then
  return "training_advanced"
elseif has_quest then
  return "training_beginner"
else
  return "training_not_started"
end
```

### 5. Action Modifier Checks

```lua
-- Script: check_meditation_unlocked
-- Hook: Action availability check

if game.actions.is_granted("meditate") then
  return true  -- Allow action
elseif game.actions.is_blocked("meditate") then
  return false -- Block action
else
  -- Check default requirements
  return game.player.get_stat("inner_peace") >= 10
end
```

---

## Anti-Patterns (Don't Do This)

### ❌ Trying to Modify State Directly

```lua
-- WRONG: Scripts can't persist state
game.player.set_flag("met_elder", true)  -- Only logs, doesn't save!

-- RIGHT: Use dialogue actions in YAML
-- actions:
--   - type: set_flag
--     flag: met_elder
--     value: true
```

### ❌ Forbidden Functions

```lua
-- These will cause validation errors:
os.execute("rm -rf /")     -- ❌ No OS access
io.open("file.txt")        -- ❌ No file I/O
require("socket")          -- ❌ No module loading
loadstring("code")         -- ❌ No dynamic code
debug.getinfo()            -- ❌ No debug access
```

### ❌ Infinite Loops

```lua
-- WRONG: Will timeout after 5 seconds
while true do
  game.message(player.id, "spam")
end

-- RIGHT: Use single execution
if game.player.has_flag("needs_reminder") then
  game.message(player.id, "Don't forget the key!")
end
```

### ❌ Complex Business Logic

```lua
-- WRONG: Too complex for a script
function calculate_damage(attacker, defender)
  local base = attacker.strength * 2
  local defense = defender.armor / 3
  local crit = math.random() > 0.9 and 2 or 1
  -- 50 more lines...
  return final_damage
end

-- RIGHT: Complex systems belong in Framework/Plugins
-- Scripts are for content customization, not game systems
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

| Hook | When It Fires | Available Context | Expected Return |
|------|---------------|-------------------|-----------------|
| `dialogue_condition` | Before showing dialogue node | `player`, `entity`, `context.game_state` | Boolean or node key string |
| `on_enter` | Player enters room | `player`, `room`, `entity` | N/A (check only) |
| `on_say` | Speech in room | `player`, `entity`, `context.message` | N/A (check only) |
| `on_look` | Entity examined | `player`, `entity` | N/A (check only) |

**Note:** Most hooks are for **conditional checks** (dialogue branching, action availability). State changes happen via dialogue/action system, not scripts.

---

## Best Practices

### ✅ DO

1. **Keep scripts simple** - Under 50 lines when possible
2. **Check conditions** - Use scripts for branching logic
3. **Return early** - Exit as soon as you have an answer
4. **Use descriptive names** - `elder_greeting_first` not `script1`
5. **Comment complex logic** - `-- Check if player completed training arc`
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

```lua
-- Script key: monastery_elder_greeting_logic
-- Purpose: Determine which greeting dialogue node to use based on player state
-- Hook: dialogue_condition
-- Entity: monastery_elder

-- Check quest completion first (highest priority)
if game.quest.is_complete("sleeping_master_quest") then
  return "elder_grateful_savior"
end

-- Check active quest state
if game.quest.is_active("sleeping_master_quest") then
  -- Sub-check: has player found the culprit?
  if game.player.has_flag("identified_traitor") then
    return "elder_quest_climax"
  elseif game.player.has_flag("searched_caves") then
    return "elder_quest_progress"
  else
    return "elder_quest_active_start"
  end
end

-- Check if player has met the elder before
if game.player.has_flag("met_monastery_elder") then
  -- Returning visitor
  if game.player.get_stat("reputation_monastery") >= 50 then
    return "elder_greeting_honored"
  else
    return "elder_greeting_return"
  end
else
  -- First time meeting
  return "elder_greeting_first_time"
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
A: Use `game.log("debug message")` to log to server console. Check logs with `tail -f logs/dev.log`.

---

## Migration from Lua to Elixir Scripts (Future)

The system is designed to migrate from Lua to sandboxed Elixir scripts in the future:

**Current (Lua):**
```lua
if game.quest.is_active("main_quest") then
  return "active_dialogue"
end
```

**Future (Elixir):**
```elixir
if quest_active?("main_quest") do
  :active_dialogue
end
```

The API functions remain the same, only the syntax changes. LLMs trained on Elixir will be able to generate scripts directly without Lua knowledge.

---

## Complete API Surface (Alphabetical)

```lua
-- Context Variables (read-only)
entity.id, entity.key, entity.type, entity.short_desc, entity.long_desc
entity.extra_desc, entity.mood, entity.location
player.id, player.name, player.level
context.trigger, context.message, context.target, context.room, context.time

-- Quest Functions
game.quest.is_active(quest_id)              -- boolean
game.quest.is_complete(quest_id)            -- boolean
game.quest.complete_objective(quest_id, objective_id)  -- boolean (logs only)

-- Player Functions
game.player.has_item(item_key)              -- boolean
game.player.has_flag(flag_name)             -- boolean
game.player.get_stat(stat_name)             -- number
game.player.set_flag(flag_name, value)      -- boolean (logs only, use dialogue actions)
game.player.get_skill_level(skill_name)     -- number

-- Action Functions
game.actions.is_granted(action_key)         -- boolean
game.actions.is_blocked(action_key)         -- boolean
game.actions.get_granted()                  -- array of strings
game.actions.get_blocked()                  -- array of strings

-- Core Functions
game.message(entity_id, text)               -- Send message
game.log(message)                           -- Log to console

-- Lua Standard Library (whitelisted subset)
string.lower, string.upper, string.find, string.sub
table.insert, table.remove, #table
math.random, math.floor, math.ceil
if/then/else/elseif/end
```

---

**Last Updated:** 2026-01-24
**Status:** Current implementation (Lua), Elixir migration planned
**Contact:** See `docs/architecture/elixir-scripts-design.md` for implementation details
