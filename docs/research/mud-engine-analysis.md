# MUD Engine Analysis: Evennia, tbaMUD, and Classic Patterns

This document compares Loka with established MUD engines to learn from decades of experience.

**Research Date:** January 2026
**Engines Analyzed:** Evennia (Python), tbaMUD/CircleMUD (C), LPMud, MOO, MUSH

---

## Executive Summary

Loka's architecture aligns well with modern MUD design patterns while leveraging Elixir's unique strengths. Key findings:

| Pattern | Evennia | tbaMUD | Loka |
|---------|---------|--------|------|
| Object Model | Typeclasses (Python classes) | Prototypes + Instances | Entity-Component-Behavior + YAML |
| Spawning | 1:Many (prototype→instances) | 1:Many (zone resets) | 1:Many (YAML→entities) |
| Scripting | Full Python + Scripts | DG Scripts (safe sandbox) | Lua (sandboxed via Luerl) |
| Admin Tools | OLC + Django admin | OasisOLC menus | LiveView admin |
| Event System | Hooks + Django Signals | Triggers (MTRIG/OTRIG/WTRIG) | 22 hook types |
| Process Model | Twisted async | Single-threaded | GenServer per entity |

**Key Insight:** Loka's YAML prototype system is NOT 1:1 - like Evennia and tbaMUD, one prototype spawns unlimited instances. Our GenServer-per-entity model provides the fault isolation that made LPMud's driver/mudlib separation revolutionary.

---

## Table of Contents

1. [Evennia Deep Dive](#evennia-deep-dive)
2. [tbaMUD/CircleMUD Analysis](#tbamud-analysis)
3. [Classic MUD Patterns](#classic-mud-patterns)
4. [Scripting System Comparison](#scripting-system-comparison)
5. [Feature Comparison Matrix](#feature-comparison-matrix)
6. [Recommendations for Loka](#recommendations)

---

## Evennia Deep Dive

### Typeclass System

Evennia uses Python classes ("typeclasses") as the foundation for all game entities. Technically these are Django proxy models - only base database models (`AccountDB`, `ObjectDB`, `ScriptDB`, `ChannelDB`) represent actual database tables.

**Three-Level Inheritance:**
```
Level 1: Database Models (ObjectDB, etc.)
    └── Define database tables via Django ORM

Level 2: Default Implementations (DefaultObject, DefaultCharacter, etc.)
    └── Provide standard behavior and 30+ hook methods

Level 3: Game Directory Classes (your customizations)
    └── Inherit from Level 2, customize without modifying core
```

**Object Hierarchy:**
- `DefaultObject` - Base for items, NPCs, furniture
- `DefaultCharacter` - Player-controlled entities
- `DefaultRoom` - Locations (always have `location=None`)
- `DefaultExit` - One-way connectors between rooms

**Key Characteristics:**
- `db_typeclass_path` stores Python path for dynamic class loading
- Class names must be globally unique
- Use hooks instead of `__init__` (`at_object_creation()`, `at_init()`)
- **Typeclass swapping** allows runtime transformation: `obj.swap_typeclass("path.to.NewClass")`

### Prototype System

Prototypes are dictionaries that define per-instance customizations:

```python
GOBLIN = {
    "prototype_key": "goblin",
    "prototype_parent": "base_monster",  # Inheritance!
    "typeclass": "typeclasses.monsters.Goblin",
    "key": "a goblin",
    "attrs": [("health", 50), ("damage", 10)],
    "tags": [("enemy", "combat")],
}
```

**Storage Options:**
- **Module-based** (Python files) - read-only from in-game
- **Database** (Script objects) - editable via OLC

**Dynamic Values:**
- Python lambdas: `"health": lambda: randint(20, 30)`
- Protfuncs: `"key": "$choice(Sword, Axe, Mace)"`

**Relationship:** 1:Many - one prototype spawns unlimited objects. Spawned objects are tagged with their prototype key for tracking.

### Admin/Builder Tools

**In-Game Commands:**
| Command | Purpose |
|---------|---------|
| `create` | Create object in inventory |
| `create/drop` | Create and drop in room |
| `spawn <prototype>` | Create from prototype |
| `spawn/olc` | Enter prototype OLC wizard |
| `dig` | Create room with exits |
| `tunnel` | Create room in cardinal direction |
| `@set` | Set attributes |
| `@desc` | Set descriptions |
| `@lock` | Set access locks |
| `typeclass` | Swap typeclass at runtime |

**Batch Building:**
- `.ev` files - sequences of in-game commands
- `.py` files - full Python access for complex building

**Web Admin:**
- Django admin at `/admin`
- Database management, attribute editing, account linking

### Scripts System (Timers/Events)

Scripts are out-of-character entities for persistent storage and timing:

```python
class Weather(Script):
    def at_script_creation(self):
        self.key = "weather_script"
        self.interval = 300  # 5 minutes

    def at_repeat(self):
        self.obj.msg_contents("A breeze sweeps by.")
```

**Timer Control:**
- `.start()`, `.stop()`, `.pause()`, `.unpause()`
- `.force_repeat()` for immediate execution
- Persistent across server reloads

**Global Scripts:**
```python
# settings.py
GLOBAL_SCRIPTS = {
    "weather": {
        "typeclass": "typeclasses.scripts.Weather",
        "interval": 300
    }
}
```

### In-Game Python Scripting

Evennia's contrib allows trusted staff to script object behaviors at runtime:

**Event Callbacks:**
Scripts attach to events on typeclasses (enter, traverse, say, etc.) and execute when events fire.

**Security:**
- Permission-gated (only trusted builders)
- Validation workflow for approval
- Emergency disable setting

**Example (voice-operated elevator):**
```python
# Attached to "say" event with parameter "one"
call_event(self, "chain_1", 2)  # After 2 seconds, trigger chain
```

---

## tbaMUD Analysis

tbaMUD (The Builder Academy MUD) is CircleMUD's continuation, representing 30+ years of MUD evolution.

### World File Structure

```
lib/world/
├── wld/     # Room definitions (.wld)
├── mob/     # Mobile/NPC definitions (.mob)
├── obj/     # Object/item definitions (.obj)
├── zon/     # Zone configuration and resets (.zon)
├── shp/     # Shop definitions (.shp)
├── trg/     # DG Script triggers (.trg)
└── qst/     # Quest definitions (.qst)
```

**VNUM System:**
Each entity has a unique virtual number. Zone 30 owns vnums 3000-3099. Vnums are independent per type - room #3001, object #3001, and mobile #3001 can all exist.

### Zone Reset System

Zones periodically "reset" to restore content:

**Reset Commands:**
| Command | Purpose |
|---------|---------|
| `M` | Spawn mobile in room |
| `O` | Spawn object in room |
| `G` | Give object to last mobile |
| `E` | Equip object on last mobile |
| `P` | Put object in container |
| `D` | Set door state |

**Reset Timer:** Typically 15-20 minutes

**Population Limits:** Each reset command specifies a maximum count.

### OasisOLC System

In-game building via menu interfaces:

| Editor | Purpose |
|--------|---------|
| `redit` | Room editing |
| `medit` | Mobile editing |
| `oedit` | Object editing |
| `zedit` | Zone editing |
| `sedit` | Shop editing |
| `trigedit` | Trigger editing |
| `qedit` | Quest editing |

### DG Scripts (Trigger System)

**Trigger Categories:**

**MTRIG (Mobile):**
- `GREET` - Character enters room
- `SPEECH` - Character speaks keyword
- `RECEIVE` - Given an item
- `DEATH` - Mobile dies
- `FIGHT` - Combat starts
- `HITPRCNT` - Health percentage threshold
- `RANDOM` - Periodic random chance
- `TIME` - Specific game hour

**OTRIG (Object):**
- `GET`, `DROP`, `GIVE`, `WEAR`, `REMOVE`
- `CONSUME`, `TIMER`

**WTRIG (World/Room):**
- `ENTER`, `LEAVE`, `RESET`
- `COMMAND`, `SPEECH`

**Script Capabilities:**
```
Control: if/elseif/else/end, while/done, switch/case
Variables: set, eval, unset, global, context
Actions: dg_cast, dg_affect, teleport
Special: wait (delays), return (exit)
```

---

## Classic MUD Patterns

### DikuMUD Family
- Monolithic C codebase
- Prototype/Instance separation (memory-efficient)
- Zone-based reset system
- "Special Procedures" for custom NPC behavior

### LPMud Family
- **Driver/Mudlib separation** - infrastructure (C) vs game logic (LPC)
- Hot-reloadable game code
- **Error isolation** - bugs in one system don't crash the server
- Inspired by Java's virtual machine concept

### MOO Family
- Persistent object database
- Single-inheritance hierarchy
- In-game programming via MOO language
- All code inspectable and modifiable

### MUSH Family
- Attribute-based softcode programming
- `$-commands` trigger code execution
- Functional programming paradigm
- Player creativity emphasis

### Richard Bartle's Player Types

1. **Achievers** - Concrete goals (XP, levels, gear)
2. **Explorers** - Investigate the world
3. **Socializers** - Player interaction
4. **Killers** - Competition/defeating others

### Raph Koster's Design Wisdom

> "As soon as you decide to make storytelling or quests the basis of your experience, you sacrifice having dynamic and emergent things in the game."

Start with simulation/UGC foundation, layer static content on top.

---

## Scripting System Comparison

### Feature Matrix

| Feature | Loka (Lua) | Evennia (Python) | tbaMUD (DG Scripts) |
|---------|------------|------------------|---------------------|
| **Language** | Lua (functional) | Python (OOP) | DG Script (C-like) |
| **Runtime** | Luerl (Erlang VM) | Python interpreter | MUD-integrated |
| **Sandbox Level** | Pattern + runtime | Trust-based only | Bytecode limits |
| **API Access** | Controlled extension | Direct object access | Trigger commands |
| **State Changes** | Read-only + messages | Direct mutation | Via triggers |
| **Performance** | ~1-5ms per call | ~10-50ms overhead | <1ms (native) |
| **Fault Tolerance** | Timeout + isolation | Exceptions propagate | Crash entire MUD |
| **Learning Curve** | Easy | Medium | Steep |

### Loka's Lua Scripting

**Architecture:**
```
Engine Layer (scripting.ex)
    ├── Luerl execution engine
    ├── Static analysis (blocked patterns)
    └── Runtime sandbox (removed globals)

Framework Layer (game_script_api.ex)
    └── Game-specific API extension
```

**Available Hooks:**
- `on_enter`, `on_leave` - Room movement
- `on_look` - Entity examination
- `on_attack` - Combat
- `on_tick` - Periodic
- `on_say`, `on_give`, `on_use` - Interactions

**API Available:**
```lua
-- Core API (always available)
game.message(target_id, text)
game.log(message)

-- Game API (with game_state context)
game.quest.is_active(quest_id)
game.quest.is_complete(quest_id)
game.player.has_item(item_key)
game.player.has_flag(flag_name)
game.player.get_stat(stat_name)
game.player.get_skill_level(skill_name)
```

**Security (Two-Layer Defense):**

1. **Static Analysis** - Blocks dangerous patterns:
   - File/OS access: `os.`, `io.`, `file.`
   - Dynamic code: `load()`, `loadstring()`, `require()`
   - Debug/introspection: `debug.`, `package.`
   - Global access: `_G`, `_ENV`
   - Memory attacks: `string.rep()`, infinite loops

2. **Runtime Sandbox:**
   - Dangerous globals removed from Lua state
   - 5-second timeout (configurable)
   - Result size limited to 10KB

### Evennia's Python Scripting

**Full Python Access:**
Scripts can use any Python library, modify objects directly, call any Evennia API.

**Security Model:**
Trust-based - only grant to deeply trusted staff.

**Power:** Maximum flexibility, can implement anything.

**Risk:** Full system access, errors can crash server.

### tbaMUD's DG Scripts

**Safe Sandbox:**
Limited command set, can't access system resources.

**Trigger-Based:**
Scripts only run in response to game events.

**Builder-Friendly:**
Non-programmers can learn the simple syntax.

**Limitations:**
No complex data structures, limited control flow.

### Tradeoffs Analysis

**Loka's Approach (Lua Sandbox):**

| Pro | Con |
|-----|-----|
| Safe by default | Limited capabilities |
| Easy to learn (Lua is simple) | Can't do everything Python can |
| Fault-tolerant (Erlang isolation) | API must be explicitly exposed |
| Fast execution (~1-5ms) | Read-only state (by design) |
| Predictable behavior | Less "power user" flexibility |

**Evennia's Approach (Full Python):**

| Pro | Con |
|-----|-----|
| Maximum flexibility | Security risk |
| Direct object manipulation | Errors propagate |
| Full language features | Requires Python knowledge |
| No API limitations | Performance overhead |

**tbaMUD's Approach (DG Scripts):**

| Pro | Con |
|-----|-----|
| Very safe | Limited expressiveness |
| Fast (native C) | Steep learning curve |
| Builder-accessible | Can't extend easily |
| Decades of patterns | Tightly coupled to codebase |

### Recommendation for Loka

Loka's current approach is **correct for the target use case:**

1. **Safety First:** Game content creators shouldn't be able to crash the server
2. **Controlled Power:** Expose APIs deliberately, not accidentally
3. **Immersion Focus:** Scripts should enhance storytelling, not become programming exercises
4. **Erlang Leverage:** Fault tolerance is a core strength - maintain it

**Consider Adding:**

1. **Script-triggered events** - Scripts can `game.emit_event()` for complex chains
2. **Delayed execution** - `game.after(5, callback_name)` for timed sequences
3. **State machines** - Simple FSM support for multi-step interactions
4. **Inline templating** - `{if player.has_flag("secret")}You notice...{end}` in descriptions

---

## Feature Comparison Matrix

### Object/Entity Systems

| Feature | Evennia | tbaMUD | Loka |
|---------|---------|--------|------|
| Object Model | Python typeclasses | C structs | Elixir structs + components |
| Inheritance | Python class hierarchy | VNUM-based templates | YAML parent prototypes |
| Components | Via attributes | Fixed fields | First-class components |
| Behaviors | Methods on typeclasses | Spec procs + triggers | Behavior modules |
| Runtime Modification | Typeclass swap | None | Component manipulation |

### Spawning/World Building

| Feature | Evennia | tbaMUD | Loka |
|---------|---------|--------|------|
| Template Storage | Python modules + DB | .mob/.obj files | YAML prototypes |
| Instance Creation | `spawn()` function | Zone reset commands | `Spawner.spawn()` |
| Relationship | 1:Many | 1:Many | 1:Many |
| In-Game Editing | OLC + spawn/olc | OasisOLC menus | LiveView admin |
| Batch Building | .ev/.py files | Zone files | WorldLoader |

### Admin/Builder Tools

| Feature | Evennia | tbaMUD | Loka |
|---------|---------|--------|------|
| In-Game Building | Commands + OLC | OasisOLC menus | Admin LiveView |
| Web Admin | Django admin | None | Phoenix admin |
| Permissions | Lock strings | Level-based | Lock strings |
| Hot Reload | Portal/Server split | None | Code reload |

### Event/Hook Systems

| Feature | Evennia | tbaMUD | Loka |
|---------|---------|--------|------|
| Hook Types | 30+ typeclass hooks | MTRIG/OTRIG/WTRIG | 22 hook types |
| Event Bus | Django signals | Trigger processing | Phoenix PubSub |
| Scripted Events | In-game Python | DG Scripts | Lua scripts |
| Timer Support | Scripts + TickerHandler | Zone resets | Timers module |

---

## Recommendations

### High Priority Adoptions

1. **Zone Reset System**
   - tbaMUD's periodic respawn is battle-tested
   - Consider configurable reset timers per area
   - Support population limits per spawn

2. **Layered Combat (from Evennia Contrib)**
   - Start with basic combat
   - Progressive layers: equipment, items, magic, positioning
   - Let game creators choose complexity

3. **Traits System (from Evennia Contrib)**
   - Static (value = base + mod)
   - Counter (moveable with min/max)
   - Gauge (depletable resource)
   - Natural fit for Loka's components

### Medium Priority

4. **Extended Room Descriptions**
   - Time-of-day variations
   - State-dependent text
   - Virtual detail system (examine without DB objects)

5. **Trading Safety Pattern**
   - Mutual acceptance required
   - Prevent one-sided scams
   - From Evennia's barter contrib

6. **Achievements System**
   - Tracking types: sum vs separate
   - Prerequisite chains
   - Straightforward engagement

### Future Exploration

7. **Wilderness Generation**
   - Room recycling for large areas
   - Coordinate-based spawning
   - Memory-efficient for huge worlds

8. **Recognition System (RP)**
   - Characters known by appearance, not names
   - Players assign nicknames to met characters
   - Deepens social immersion

9. **State Machine Rooms**
   - Puzzle dungeons with progression
   - Instanced content
   - Inspired by EvscapeRoom

---

## Sources

- [Evennia Documentation](https://www.evennia.com/docs/latest/)
- [Evennia GitHub](https://github.com/evennia/evennia)
- [tbaMUD GitHub](https://github.com/tbamud/tbamud)
- [DG Scripts Reference](http://dgscripts.tbamud.com/)
- [CircleMUD Builder's Manual](https://www.circlemud.org/cdp/building/building-2.html)
- [Richard Bartle - Designing Virtual Worlds](https://mud.co.uk/richard/)
- [Raph Koster's Game Design](https://www.raphkoster.com/)
- [LPMud Wiki](https://mud.fandom.com/wiki/LPMud)
- [MOO Programmer's Manual](https://www.hayseed.net/MOO/manuals/ProgrammersManual.html)
