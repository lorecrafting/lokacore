# Scripting Systems Deep Dive: Customizability for Immersion

This document analyzes scripting approaches across MUD engines to understand how extreme customizability enables depth and player immersion.

---

## The Core Tension

**Flexibility vs Safety vs Accessibility**

Every MUD scripting system balances three competing concerns:

| Concern | Maximum Value | Risk |
|---------|---------------|------|
| **Flexibility** | Anything is possible | Security holes, bugs crash server |
| **Safety** | Server never crashes | Limited what builders can create |
| **Accessibility** | Non-programmers can build | Complex behaviors impossible |

Different engines make different tradeoffs:

```
                    FLEXIBILITY
                         │
    Evennia ────────────►│
    (Full Python)        │
                         │
                         │
         Loka ──────────►│
         (Lua Sandbox)   │
                         │
                         │
     tbaMUD ────────────►│
     (DG Scripts)        │
                         │
    ─────────────────────┼─────────────────────
                         │         SAFETY
```

---

## Evennia Scripts System

### Architecture

Evennia uses Python Scripts as the primary timer/event mechanism, with a separate "In-Game Python" contrib for runtime scripting:

**Scripts (Typeclassed Timers):**
```python
class Weather(Script):
    def at_script_creation(self):
        self.key = "weather_script"
        self.interval = 300  # 5 minutes
        self.persistent = True  # Survives reloads

    def at_repeat(self):
        """Called every interval seconds."""
        weather = random.choice(["sunny", "cloudy", "rainy"])
        self.obj.msg_contents(f"The weather is now {weather}.")

    def is_valid(self):
        """Return False to stop the script."""
        return self.obj.db.weather_enabled
```

**Script Lifecycle Hooks:**
| Hook | When Called |
|------|-------------|
| `at_script_creation()` | Once at creation |
| `at_start()` | Timer starts |
| `at_repeat()` | Every interval |
| `at_stop()` | Timer stops |
| `at_pause()` | Timer pauses |
| `at_server_reload()` | Server reloads |
| `at_server_shutdown()` | Server stops |

**Timer Control:**
- `.start()`, `.stop()`, `.pause()`, `.unpause()`
- `.force_repeat()` - Immediate execution
- `.time_until_next_repeat()` - Check countdown

### In-Game Python (Contrib)

Allows trusted builders to write Python directly attached to game objects:

**Event Types:**
- `can_traverse` - Before exit traversal
- `traverse` - During exit traversal
- `say` - Speech with keyword filtering
- `time` - Specific game time
- `enter/leave` - Room movement
- `give/get/drop` - Object interactions

**Example: Voice-Operated Elevator**
```python
# Event: say, Parameter: "one"
# Attached to elevator room

if character.location != elevator:
    return

# Announce movement
character.msg("The elevator begins to move...")

# Chain to next event after delay
call_event(self, "chain_1", 2)  # 2 second delay

# chain_1 event:
character.location = first_floor
character.msg("Ding! First floor.")
```

**Security Model:**
- **Trust-based** - Only grant to deeply trusted staff
- Validation workflow available (events require approval)
- Emergency disable setting
- Full Python access = full system access

**Power Level:** Maximum flexibility, can do anything Python can do.

**Risk Level:** High - malicious or buggy scripts can:
- Crash the server
- Access filesystem
- Modify any game state
- Create infinite loops

---

## tbaMUD DG Scripts

### What Are DG Scripts?

DG (Death's Gate) Scripts are a safe, trigger-based scripting language developed for CircleMUD derivatives. They're simpler than Python but powerful enough for complex NPC behaviors.

### Trigger Types

**Mobile Triggers (MTRIG):**
| Trigger | Fires When |
|---------|------------|
| `GREET` | Player enters room |
| `GREET_ALL` | Any character enters |
| `SPEECH` | Player says keyword |
| `RECEIVE` | Given an item |
| `BRIBE` | Given gold |
| `DEATH` | Mobile dies |
| `FIGHT` | Combat starts |
| `HITPRCNT` | Health drops below % |
| `RANDOM` | Random chance each tick |
| `TIME` | Specific game hour |
| `ENTRY` | Mobile enters room |
| `MEMORY` | Remembers attacker |
| `CAST` | Spell cast on mobile |
| `LEAVE` | Character leaves room |
| `DOOR` | Door manipulated |
| `LOAD` | Mobile spawns |
| `DAMAGE` | Takes damage |

**Object Triggers (OTRIG):**
- `GET`, `DROP`, `GIVE`, `WEAR`, `REMOVE`
- `CONSUME` (eaten/drunk), `TIMER`, `RANDOM`
- `COMMAND`, `CAST`, `LEAVE`, `LOAD`, `TIME`

**World/Room Triggers (WTRIG):**
- `RESET` (zone resets), `ENTER`, `LEAVE`
- `COMMAND`, `SPEECH`, `DROP`
- `CAST`, `DOOR`, `TIME`, `LOGIN`

### Script Syntax

**Variables:**
```
%actor.name%          - Actor's name
%actor.level%         - Actor's level
%actor.gold%          - Actor's gold
%self%                - The scripted entity
%random.1%            - Random 0-1 (percentage check)
%time.hour%           - Current game hour
```

**Control Flow:**
```
if %actor.level% > 10
  say Welcome, experienced adventurer!
elseif %actor.level% > 5
  say You show promise, young one.
else
  say Begone, novice!
end
```

**Actions:**
```
wait 5 sec            - Delay 5 seconds
teleport %actor% 3001 - Move actor to room 3001
dg_cast 'heal' %actor%- Cast spell
dg_affect %actor% blind 100 - Apply affect
mload 3015            - Load mobile #3015
oload 3050            - Load object #3050
purge %actor%         - Remove actor
damage %actor% 50     - Deal 50 damage
```

### Example: Quest NPC

```
Name: Quest Giver - Sword Quest
Type: Mobile
Triggers: GREET, SPEECH

--- GREET trigger (fires when player enters) ---
if %actor.varexists(sword_quest)%
  if %actor.sword_quest% == 1
    wait 1 sec
    say Ah, you've returned! Do you have the sword?
  end
else
  wait 1 sec
  say Greetings, traveler! I seek a brave soul...
  say The goblin king stole my father's sword.
  say Will you retrieve it for me?
end

--- SPEECH trigger, keyword: "yes" ---
if !%actor.varexists(sword_quest)%
  set sword_quest 1
  remote sword_quest %actor.id%
  say Excellent! The goblin caves are to the north.
  say Return with the sword and I shall reward you.
end

--- SPEECH trigger, keyword: "sword" ---
if %actor.sword_quest% == 1
  if %actor.has_item(3056)%
    say You found it! Thank you, brave hero!
    nop %actor.remove_item(3056)%
    oload 3100
    give reward %actor.name%
    set sword_quest 2
    remote sword_quest %actor.id%
    say This gold is yours. May fortune favor you!
  else
    say You don't have the sword yet. Keep searching!
  end
end
```

### Security Model

**Inherently Safe:**
- No file/network access
- Limited command set
- Can't execute arbitrary code
- Runs within MUD's process

**Limitations:**
- No complex data structures (lists, maps)
- No functions/procedures
- Limited math operations
- Global state via variables only

---

## Loka Lua Scripting

### Architecture

Loka uses Luerl (Lua in Erlang) with a two-layer security model:

```
┌─────────────────────────────────────────────┐
│             Framework Layer                  │
│  GameScriptAPI - game.quest.*, game.player.* │
├─────────────────────────────────────────────┤
│              Engine Layer                    │
│  Scripting.ex - sandbox, execution, API     │
├─────────────────────────────────────────────┤
│               Luerl Runtime                  │
│  Lua 5.3 interpreter in Erlang              │
└─────────────────────────────────────────────┘
```

### Available Hooks

| Hook | Trigger | Use Case |
|------|---------|----------|
| `on_enter` | Player enters room | Welcome messages, ambushes |
| `on_leave` | Player leaves room | Farewells, pursuit |
| `on_look` | Entity examined | Contextual descriptions |
| `on_attack` | Entity attacked | Combat reactions |
| `on_tick` | Periodic timer | Environmental effects |
| `on_say` | Speech nearby | Conversation triggers |
| `on_give` | Item received | Quest progression |
| `on_use` | Entity used | Interactive objects |
| `custom` | Plugin-defined | Extension point |

### API Reference

**Core API (Always Available):**
```lua
game.message(target_id, text)  -- Send message to entity
game.log(message)              -- Log to server console
```

**Entity Context:**
```lua
entity.id           -- Unique entity ID
entity.type         -- "npc", "room", "item", etc.
entity.short_desc   -- Display name
entity.long_desc    -- Room description
entity.extra_desc   -- Examination text
entity.keywords     -- Targeting keywords
entity.mood         -- Current mood
entity.location     -- Room ID
```

**Game API (with game_state context):**
```lua
-- Quest System
game.quest.is_active(quest_id)      -- Check if quest active
game.quest.is_complete(quest_id)    -- Check if quest done
game.quest.complete_objective(id, obj_id)  -- Mark objective

-- Player System
game.player.has_item(item_key)      -- Check inventory
game.player.has_flag(flag_name)     -- Check player flag
game.player.get_stat(stat_name)     -- Get stat value
game.player.set_flag(flag, value)   -- Set player flag
game.player.get_skill_level(skill)  -- Get skill level
```

### Example: Quest NPC

```lua
-- on_enter hook for Temple Room
if game.quest.is_active("sleeping_master") then
  if game.player.has_item("sacred_incense") then
    game.message(context.player_id,
      "The monks look up expectantly as you enter, "..
      "eyes drawn to the incense you carry.")
  else
    game.message(context.player_id,
      "The monks continue their vigil, barely "..
      "acknowledging your presence.")
  end
end

-- on_look hook for Novice Pema
if game.quest.is_active("sleeping_master") then
  if game.player.has_flag("spoke_to_pema") then
    return "Novice Pema nods at you knowingly."
  else
    return "Novice Pema seems anxious, glancing toward "..
           "the meditation chamber repeatedly."
  end
end

-- on_say hook for Abbot
if context.message:match("master") then
  if not game.quest.is_active("sleeping_master") then
    game.message(entity.id,
      "The Abbot's face grows solemn. 'Master Tenzin "..
      "has not woken in three days...'")
  end
end
```

### Security: Two-Layer Defense

**Layer 1: Static Analysis (Before Saving)**

Blocked patterns via regex:
```
os., io., file., require(), dofile(), loadfile()
debug., package., rawget(), rawset()
getmetatable(), setmetatable()
load(), loadstring()
_G, _ENV
string.rep() with large counts
while true do end
string.dump()
```

Max script length: 50,000 characters

**Layer 2: Runtime Sandbox**

Removed from Lua state:
- `os`, `io`, `debug`, `package`, `coroutine` modules
- All blocked functions

Execution limits:
- 5-second timeout (configurable)
- 10KB max result size

**Important Design Decision:**

State-changing functions (`game.player.set_flag()`, `game.quest.complete_objective()`) **only log intent** - they don't persist changes directly. The dialogue/action system handles actual persistence.

This is intentional:
- Scripts can't corrupt game state
- All state changes flow through validated paths
- Easier to debug and audit

---

## Comparison Matrix

### Capability Comparison

| Capability | Loka | Evennia | tbaMUD |
|------------|------|---------|--------|
| **Custom NPC Dialogue** | Yes (Lua) | Yes (Python) | Yes (DG) |
| **Quest Triggers** | Yes | Yes | Yes |
| **Timed Events** | on_tick | Scripts | TIME trigger |
| **Combat Reactions** | on_attack | Hooks | FIGHT/HITPRCNT |
| **Room Ambiance** | on_enter | Scripts | ENTER trigger |
| **Interactive Objects** | on_use | Commands | GET/DROP/etc |
| **Weather Systems** | Custom script | Global script | Global variable |
| **Dynamic Descriptions** | on_look return | return_appearance | GREET + describe |
| **Player Tracking** | flags + quests | Attributes | Variables |
| **Multi-step Quests** | Quest system | Custom | Variables |
| **Voice Commands** | on_say | say event | SPEECH trigger |
| **Delayed Actions** | N/A (planned) | call_event | wait |
| **State Machines** | N/A (planned) | Custom | if/else chains |

### Performance Comparison

| Metric | Loka | Evennia | tbaMUD |
|--------|------|---------|--------|
| Script Execution | ~1-5ms | ~10-50ms | <1ms |
| Memory per Script | ~1KB | ~10KB | ~100 bytes |
| Fault Isolation | Yes (Erlang) | No | No |
| Timeout Protection | Yes (5s) | No | No |
| Hot Reload | Yes | Yes | No |

### Safety Comparison

| Risk | Loka | Evennia | tbaMUD |
|------|------|---------|--------|
| Infinite Loop | Timeout kills | Crashes server | Crashes server |
| Memory Exhaustion | Size limits | Full access | Limited |
| File Access | Blocked | Possible | Impossible |
| Network Access | Blocked | Possible | Impossible |
| State Corruption | Read-only design | Possible | Possible |

---

## Recommendations for Extreme Customizability

### Current Strengths

Loka's approach is well-suited for:
1. **Safe builder empowerment** - Non-programmers can't break the server
2. **Storytelling focus** - Scripts enhance narrative, not replace it
3. **Controlled complexity** - API is intentionally limited

### Suggested Enhancements

**1. Delayed Execution**
```lua
game.after(seconds, callback_name, args)
-- Example:
game.after(5, "delayed_message", {
  target = context.player_id,
  text = "The door slowly creaks open..."
})
```

**2. Event Emission**
```lua
game.emit_event("custom_event_name", {
  source = entity.id,
  target = context.player_id,
  data = { key = "value" }
})
-- Other scripts can listen to custom events
```

**3. Inline Templating in Descriptions**
```yaml
long_desc: |
  A weathered monk stands here{if player.quest.sleeping_master},
  watching you with keen interest{end}.
```

**4. Simple State Machine Support**
```lua
-- Define states
local states = {
  idle = { on_enter = ..., transitions = { "talking" } },
  talking = { on_enter = ..., transitions = { "idle", "combat" } },
  combat = { on_enter = ..., transitions = { "idle" } }
}

-- Transition
game.set_state(entity.id, "talking")
```

**5. Script Chaining**
```lua
-- In script A
game.call_script(entity.id, "secondary_script", context)

-- This allows modular script design without
-- duplicating code
```

### What NOT to Add

1. **Full Language Access** - Keep the sandbox
2. **Direct Database Access** - Maintain abstraction
3. **Network Capabilities** - Security risk
4. **Dynamic Code Execution** - `load()` is dangerous
5. **Global State Modification** - Use controlled APIs

---

## Conclusion

Loka's scripting system occupies a sweet spot between safety and capability. The key insight from tbaMUD's decades of success is that **limited scripting is often sufficient** - complex behaviors emerge from simple triggers.

Evennia's full Python access is powerful but requires trust. Loka's Lua sandbox provides:
- **Safety by default** (can't crash server)
- **Accessibility** (Lua is easy to learn)
- **Extensibility** (API can grow as needed)
- **Fault tolerance** (Erlang's supervision)

The recommendation is to **extend the API, not the language access**. Add more `game.*` functions rather than removing sandbox restrictions.

---

## Sources

- [Evennia Scripts Documentation](https://www.evennia.com/docs/latest/Components/Scripts.html)
- [Evennia In-Game Python Contrib](https://www.evennia.com/docs/latest/Contribs/Contrib-Ingame-Python.html)
- [DG Scripts Reference](http://dgscripts.tbamud.com/)
- [tbaMUD DG Scripts Source](https://github.com/tbamud/tbamud/blob/master/src/dg_scripts.h)
- [OasisOLC and DG Scripts](http://old.tbamud.com/Oasis_DG_pages/contents/trigedit.htm)
