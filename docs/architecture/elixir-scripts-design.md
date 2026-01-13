# Elixir Scripts Design: Sandboxed Builder Scripting

## Overview

Loka uses a clean separation between **systems** and **content**:

| Layer | Who | How | Purpose |
|-------|-----|-----|---------|
| **Engine** | Developers | Elixir code | Core infrastructure |
| **Framework** | Developers | Elixir code | Game subsystems (combat, quests) |
| **Plugins** | Developers | Elixir modules | Features (guilds, crafting, economy) |
| **Scripts** | Builders | DB-stored, sandboxed | Game world content |

**Key Insight:** If you need full Elixir access, you're building a *system* (plugin). If you're customizing game world content (NPCs, rooms, quests), you're a *builder* using scripts.

All game world customization - Novice Pema's dialogue, room environmental effects, quest triggers - is builder-level content using sandboxed scripts.

---

## Scripts: Sandboxed, DB-Stored, Builder-Created

For trusted builders who create content without code access.

### Storage

Scripts are stored in the database `scripts` table:

```elixir
# Schema
defmodule Loka.Engine.Schema.ScriptSchema do
  use Ecto.Schema

  schema "scripts" do
    field :key, :string           # Unique identifier
    field :name, :string          # Display name
    field :description, :string   # What this script does
    field :hook, :string          # Which event: "on_look", "on_enter", etc.
    field :source, :string        # Elixir source code (sandboxed)
    field :enabled, :boolean, default: true
    field :created_by, :string    # Builder who created it
    field :approved_by, :string   # Admin who approved (optional workflow)
    field :approved_at, :utc_datetime

    timestamps()
  end
end
```

### Entity Reference

```yaml
key: novice_pema
type: npc
# Reference DB script by key
builder_scripts:
  on_look: "novice_pema_look"
  on_say: "novice_pema_say"
```

Or attach via admin UI at runtime.

### Sandboxed API

Builder scripts get a **restricted set of functions** - not full Elixir:

```elixir
# What builders CAN use:
quest_active?(quest_id)           # Check if quest is active
quest_complete?(quest_id)         # Check if quest is done
complete_objective(quest_id, obj) # Mark objective complete

has_item?(item_key)               # Check player inventory
has_flag?(flag_name)              # Check player flag
set_flag(flag_name, value)        # Set player flag
get_stat(stat_name)               # Get player stat

say(message)                      # Entity speaks
emote(action)                     # Entity emotes
message(text)                     # Send message to player

entity.id                         # Current entity data
entity.short_desc
entity.location
player.id                         # Current player data
player.name

# Control flow
if/else/cond                      # Conditionals
case                              # Pattern matching
Enum basics                       # Enum.any?, Enum.find, etc.
String basics                     # String.contains?, String.downcase

# What builders CANNOT use:
System.*                          # No system commands
File.*                            # No file access
:os.*                             # No OS access
Code.*                            # No dynamic code loading
Process.*                         # No process manipulation
Node.*                            # No distributed access
Application.*                     # No application config
Kernel.apply/3                    # No arbitrary function calls
send/receive                      # No message passing
spawn                             # No process creation
```

### Script Example

```elixir
# Stored in database, key: "novice_pema_look"
# Hook: on_look

cond do
  quest_active?("sleeping_master") and has_flag?("spoke_to_pema") ->
    {:append, "Novice Pema nods at you knowingly."}

  quest_active?("sleeping_master") ->
    {:append, "Novice Pema seems anxious, glancing toward the meditation chamber."}

  quest_complete?("sleeping_master") ->
    {:append, "Novice Pema beams with gratitude when he sees you."}

  true ->
    :default
end
```

### Sandbox Implementation

```elixir
defmodule Loka.Script.Sandbox do
  @moduledoc """
  Evaluates builder scripts with restricted bindings.
  Only approved functions are available.
  """

  @timeout 5_000
  @max_result_size 10_000

  @doc """
  Execute a builder script with sandboxed bindings.
  """
  def execute(source, entity, context) do
    bindings = build_bindings(entity, context)

    task = Task.async(fn ->
      try do
        {result, _bindings} = Code.eval_string(source, bindings, __ENV__)
        {:ok, result}
      rescue
        e -> {:error, {:exception, Exception.message(e)}}
      end
    end)

    case Task.yield(task, @timeout) || Task.shutdown(task) do
      {:ok, {:ok, result}} -> validate_result(result)
      {:ok, {:error, reason}} -> {:error, reason}
      nil -> {:error, :timeout}
    end
  end

  defp build_bindings(entity, context) do
    player = context[:player]

    [
      # Entity data (read-only maps)
      entity: safe_entity_map(entity),
      player: safe_player_map(player),

      # Quest functions
      quest_active?: fn quest_id -> Quests.active?(player, quest_id) end,
      quest_complete?: fn quest_id -> Quests.complete?(player, quest_id) end,
      complete_objective: fn quest_id, obj_id ->
        Quests.complete_objective(player, quest_id, obj_id)
      end,

      # Player functions
      has_item?: fn item_key -> Players.has_item?(player, item_key) end,
      has_flag?: fn flag -> Players.has_flag?(player, flag) end,
      set_flag: fn flag, value -> Players.set_flag(player, flag, value) end,
      get_stat: fn stat -> Players.get_stat(player, stat) end,

      # Entity actions (queue events, don't execute directly)
      say: fn msg -> queue_event(:say, entity, msg) end,
      emote: fn action -> queue_event(:emote, entity, action) end,
      message: fn text -> queue_event(:message, player, text) end,
    ]
  end

  defp safe_entity_map(entity) do
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      short_desc: entity.short_desc,
      long_desc: entity.long_desc,
      location: entity.location_id,
      mood: entity.mood
    }
  end

  defp safe_player_map(nil), do: nil
  defp safe_player_map(player) do
    %{
      id: player.id,
      name: player.short_desc,
      level: get_in(player.components, [:character, :level]) || 1
    }
  end

  defp validate_result(result) when byte_size(inspect(result)) > @max_result_size do
    {:error, :result_too_large}
  end
  defp validate_result(result), do: {:ok, result}

  defp queue_event(type, target, data) do
    # Events are collected and executed after script completes
    Process.put(:script_events, [
      {type, target, data} | Process.get(:script_events, [])
    ])
    :ok
  end
end
```

### Static Analysis (Pre-Save Validation)

Before saving a builder script, validate it doesn't use forbidden constructs:

```elixir
defmodule Loka.Script.Validator do
  @moduledoc """
  Validates builder scripts before saving to database.
  """

  @forbidden_patterns [
    ~r/System\./,
    ~r/File\./,
    ~r/:os\./,
    ~r/Code\./,
    ~r/Process\./,
    ~r/Node\./,
    ~r/Application\./,
    ~r/Kernel\.apply/,
    ~r/\bspawn\b/,
    ~r/\bsend\b/,
    ~r/\breceive\b/,
    ~r/\bself\(\)/,
    ~r/__ENV__/,
    ~r/__MODULE__/,
    ~r/__DIR__/,
    ~r/__CALLER__/,
    ~r/import\s/,
    ~r/require\s/,
    ~r/use\s/,
    ~r/alias\s/,
    ~r/defmodule/,
    ~r/defmacro/,
    ~r/def\s/,
    ~r/defp\s/,
    ~r/quote\s/,
    ~r/unquote/,
    ~r/\|>/,  # No pipe operator (can chain arbitrary functions)
  ]

  @max_length 10_000

  def validate(source) do
    with :ok <- validate_length(source),
         :ok <- validate_patterns(source),
         :ok <- validate_syntax(source) do
      :ok
    end
  end

  defp validate_length(source) when byte_size(source) > @max_length do
    {:error, "Script too long (max #{@max_length} characters)"}
  end
  defp validate_length(_), do: :ok

  defp validate_patterns(source) do
    case Enum.find(@forbidden_patterns, &Regex.match?(&1, source)) do
      nil -> :ok
      pattern -> {:error, "Forbidden pattern: #{inspect(pattern)}"}
    end
  end

  defp validate_syntax(source) do
    case Code.string_to_quoted(source) do
      {:ok, _ast} -> :ok
      {:error, {_line, message, _token}} -> {:error, "Syntax error: #{message}"}
    end
  end
end
```

---

## Approval Workflow (Optional)

For extra safety, builder scripts can require admin approval:

```elixir
# Config option
config :loka, :script_approval_required, true

# Workflow:
# 1. Builder creates script -> status: :pending
# 2. Admin reviews in admin UI
# 3. Admin approves -> status: :approved, approved_by: admin_id
# 4. Script becomes active

defmodule Loka.Scripts do
  def create_builder_script(attrs, builder) do
    approval_required = Application.get_env(:loka, :script_approval_required, false)

    attrs
    |> Map.put(:created_by, builder.id)
    |> Map.put(:status, if(approval_required, do: :pending, else: :approved))
    |> ScriptSchema.changeset()
    |> Repo.insert()
  end

  def approve_script(script_id, admin) do
    script = Repo.get!(ScriptSchema, script_id)

    script
    |> Ecto.Changeset.change(%{
      status: :approved,
      approved_by: admin.id,
      approved_at: DateTime.utc_now()
    })
    |> Repo.update()
  end
end
```

---

## Admin UI for Builder Scripts

LiveView interface for creating/editing scripts:

```
┌─────────────────────────────────────────────────────────────┐
│ Script Editor                                         [Save] │
├─────────────────────────────────────────────────────────────┤
│ Key:  [novice_pema_look          ]                          │
│ Name: [Novice Pema - Look Script ]                          │
│ Hook: [on_look ▼]                                           │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ cond do                                                 │ │
│ │   quest_active?("sleeping_master") ->                   │ │
│ │     {:append, "Pema watches anxiously."}                │ │
│ │   true ->                                               │ │
│ │     :default                                            │ │
│ │ end                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Validate] [Test with Entity ▼]                             │
│                                                              │
│ ✓ Syntax valid                                              │
│ ✓ No forbidden patterns                                     │
├─────────────────────────────────────────────────────────────┤
│ Available Functions:                                         │
│ • quest_active?(quest_id), quest_complete?(quest_id)        │
│ • has_item?(key), has_flag?(flag), set_flag(flag, val)      │
│ • say(msg), emote(action), message(text)                    │
│ • entity.id, entity.short_desc, player.name                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Global Systems (Plugins, Not Scripts)

Game-wide systems like weather, day/night cycles, and economy are **plugins**, not scripts:

```elixir
# lib/loka/plugins/weather/weather.ex
defmodule Loka.Plugins.Weather do
  use Loka.Plugin

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # Full Elixir - this is a plugin, not a script
  def handle_info(:tick, state) do
    new_weather = calculate_weather(state)
    broadcast_to_outdoor_rooms(new_weather)
    {:noreply, %{state | current: new_weather}}
  end
end
```

**Why not scripts?**
- Global systems need full Elixir for performance/complexity
- They're developed once, not per-entity content
- They require code deployment (and should!)

Scripts are for **entity-specific content**, not game systems.

---

## Comparison: Lua vs Elixir Builder Scripts

| Aspect | Old (Lua) | New (Elixir Sandbox) |
|--------|-----------|----------------------|
| Syntax | Lua | Elixir |
| Storage | Database | Database |
| Sandbox | Pattern + runtime | Pattern + binding restriction |
| API | Explicit exposure | Explicit exposure |
| LLM Friendly | Good | Excellent (same as app) |
| Debugging | Separate | Same as app |
| Runtime | Luerl (~5ms) | Code.eval_string (~1ms) |

**Key Difference:** We're replacing Lua syntax with Elixir syntax, but keeping the sandboxed approach. Builders still can't access arbitrary system functions.

---

## Hook Integration

```elixir
defmodule Loka.Script.HookIntegration do
  @moduledoc """
  Integrates scripts with the hooks system.
  Scripts are looked up by entity key + hook name.
  """

  alias Loka.Script.Sandbox
  alias Loka.Engine.Scripts

  def run_entity_script(entity, hook, context) do
    case get_script(entity, hook) do
      nil -> :no_script
      script -> Sandbox.execute(script.source, entity, context)
    end
  end

  defp get_script(entity, hook) do
    hook_string = Atom.to_string(hook)

    # Look up by entity's scripts map or by convention
    cond do
      # Check entity's scripts field (from YAML)
      script_key = get_in(entity.scripts, [hook_string]) ->
        Scripts.get_by_key(script_key)

      # Convention: {entity_key}_{hook}
      true ->
        Scripts.get_by_key("#{entity.key}_#{hook_string}")
    end
  end
end
```

---

## Entity Schema Updates

```elixir
# Add to Entity struct
defstruct [
  # ... existing fields ...
  scripts: %{},    # Map of hook -> script_key (DB references)
]
```

```yaml
# YAML prototype - reference DB-stored scripts by key
key: novice_pema
type: npc
scripts:
  on_look: novice_pema_look
  on_say: novice_pema_say
  on_enter: novice_pema_enter

# Or rely on convention: scripts keyed as "{entity_key}_{hook}"
# e.g., "novice_pema_on_look" auto-discovered
```

---

## Summary

| Layer | Who | Storage | Sandboxed | Use For |
|-------|-----|---------|-----------|---------|
| **Engine/Framework** | Developers | Code | No | Core systems |
| **Plugins** | Developers | Code | No | Game features |
| **Scripts** | Builders | Database | Yes | World content |

**The Rule:** If you need full Elixir, write a plugin. If you're customizing game content, use scripts.

Scripts use Elixir syntax (LLM-friendly!) but with a controlled API. Builders can create immersive content without risking server stability.

---

## Migration from Lua

1. Keep the same sandbox philosophy
2. Replace Lua syntax with Elixir syntax
3. Keep the same API functions (quest_active?, has_item?, etc.)
4. Store in same `scripts` table
5. Swap Luerl for Code.eval_string with restricted bindings

The builder experience stays similar - write scripts in admin UI with a controlled API. We just use Elixir syntax instead of Lua.

---

## Why This Design?

**vs Full Elixir Access:**
- Builders shouldn't have System.cmd() or File.write()
- Sandboxing prevents accidental/malicious damage
- Clear separation: systems (plugins) vs content (scripts)

**vs Lua:**
- One language in the codebase
- LLMs know Elixir well
- Same debugging tools
- Faster (~1ms vs ~5ms)
- No Luerl dependency

**Security Model:**
- Loka's scripts are truly sandboxed
- Scripts are stored in database
- Event-based triggers for extensibility

---

## Scripting API Surface

### Loka Current API (Lua)

```lua
-- Core (Engine layer)
game.message(target_id, text)
game.log(message)

-- Quest (Framework layer)
game.quest.is_active(quest_id)
game.quest.is_complete(quest_id)
game.quest.complete_objective(quest_id, objective_id)

-- Player (Framework layer)
game.player.has_item(item_key)
game.player.has_flag(flag_name)
game.player.get_stat(stat_name)
game.player.set_flag(flag_name, value)  -- logs intent only
game.player.get_skill_level(skill_name)

-- Context Variables
entity.id, entity.type, entity.short_desc, entity.long_desc
entity.extra_desc, entity.keywords, entity.mood, entity.location
context.*  -- arbitrary context passed in
```

### Proposed Elixir Script API

Comprehensive API organized by domain:

#### 1. Context Variables (Read-Only)

```elixir
# Entity being scripted
entity.id                    # UUID
entity.key                   # Prototype key (e.g., "novice_pema")
entity.type                  # :npc, :item, :room
entity.short_desc            # Display name
entity.long_desc             # Room description
entity.extra_desc            # Examine text
entity.mood                  # Current mood
entity.location              # Room ID

# Current player (if applicable)
player.id
player.name
player.level

# Event context
context.trigger              # What triggered: :enter, :say, :look, etc.
context.message              # For :say events, what was said
context.target               # For targeted actions
context.room                 # Current room data
context.time                 # Game time: %{hour: 14, day: 3, season: :summer}
```

#### 2. Query Functions (Read-Only)

```elixir
# Quest state
quest_active?(quest_id)              # Is quest in progress?
quest_complete?(quest_id)            # Is quest finished?
quest_objective_done?(quest_id, obj) # Is specific objective complete?
quest_stage(quest_id)                # Current stage number

# Player state
has_item?(item_key)                  # Check inventory
has_item?(item_key, count)           # Check quantity
has_flag?(flag_name)                 # Check flag
get_flag(flag_name, default)         # Get flag value
get_stat(stat_name)                  # Get stat value
get_skill(skill_name)                # Get skill level
get_currency(currency_type)          # Get gold, karma, etc.

# Entity queries
entities_in_room()                   # List entities in current room
entities_in_room(type: :npc)         # Filter by type
entity_present?(entity_key)          # Is specific entity here?
player_in_room?(player_id)           # Is player here?

# World state
time_of_day()                        # :dawn, :morning, :noon, :evening, :night
current_hour()                       # 0-23
current_weather()                    # :clear, :rain, :storm, etc.
is_outdoor?()                        # Is current room outdoors?
```

#### 3. Action Functions (Queued, Not Immediate)

Actions are queued and executed after script completes. This maintains transactional safety.

```elixir
# Communication
say(message)                         # Entity speaks
say(message, to: player_id)          # Speak to specific player
emote(action)                        # Entity emotes: "*smiles warmly*"
message(text)                        # Send text to triggering player
message(text, to: player_id)         # Send to specific player
announce(text)                       # Broadcast to room

# State changes (logged, applied after script)
set_flag(flag_name, value)           # Set player flag
complete_objective(quest_id, obj_id) # Complete quest objective
start_quest(quest_id)                # Begin quest for player
give_item(item_key)                  # Add item to player inventory
give_item(item_key, count: 3)        # Add multiple
take_item(item_key)                  # Remove from inventory
give_xp(amount)                      # Award experience
give_currency(amount, type)          # Award gold/karma/etc.

# Entity state
set_mood(mood)                       # Change entity mood
set_description(text)                # Temporarily change description

# NPC actions
move_to(room_id)                     # NPC moves to room
follow(player_id)                    # NPC follows player
stop_following()                     # Stop following
attack(target_id)                    # Initiate combat
```

#### 4. Control Flow Functions

```elixir
# Action control (for "before" hooks)
deny()                               # Prevent the triggering action
deny(reason)                         # Prevent with message to player

# Event chaining
after(seconds, script_key)           # Run another script after delay
after(seconds, script_key, context)  # With additional context
emit_event(event_name, data)         # Trigger custom event

# Script flow
halt()                               # Stop script execution
halt(return_value)                   # Stop with specific return
```

#### 5. Utility Functions

```elixir
# Randomness
chance?(percentage)                  # 30 = 30% chance, returns boolean
roll(dice)                           # roll("2d6+3") returns integer
random(min, max)                     # Random integer in range
pick(list)                           # Random element from list

# String helpers
contains?(text, substring)           # Case-insensitive check
matches?(text, pattern)              # Regex match
downcase(text)
upcase(text)

# List helpers
any?(list, fn)                       # Enum.any?
all?(list, fn)                       # Enum.all?
find(list, fn)                       # Enum.find
count(list)                          # Length
```

### Script Return Values

Scripts can return values that affect the triggering system:

```elixir
# For on_look hooks
:default                             # Use default description
{:replace, "Custom description"}     # Replace entirely
{:append, "Additional text"}         # Add to description
{:prepend, "Before the default"}     # Add before

# For before_* hooks (validation)
:ok                                  # Allow action
:deny                                # Block action silently
{:deny, "You cannot do that."}       # Block with message

# For on_say hooks
:continue                            # Normal processing
:handled                             # Script handled it, stop processing
{:respond, "NPC response"}           # Auto-respond

# For on_enter hooks
:allow                               # Allow entry
:deny                                # Block entry
{:redirect, room_id}                 # Send to different room
```

### Hook Types (Mapped to Engine Hooks)

Scripts can attach to these hooks:

| Hook | Trigger | Return Type |
|------|---------|-------------|
| `on_look` | Entity examined | `:default`, `{:append, text}` |
| `on_enter` | Player enters room | `:allow`, `:deny`, `{:redirect, room}` |
| `on_leave` | Player leaves room | `:allow`, `:deny` |
| `on_say` | Speech in room | `:continue`, `:handled`, `{:respond, text}` |
| `on_give` | Item given to entity | `:accept`, `:refuse`, `{:respond, text}` |
| `on_attack` | Entity attacked | `:allow`, `:deny`, `{:counter, target}` |
| `on_death` | Entity dies | Side effects only |
| `on_tick` | Periodic (configurable) | Side effects only |
| `on_time` | Specific game hour | Side effects only |
| `on_use` | Entity used/activated | `:success`, `:failure`, `{:message, text}` |

### Example: Full-Featured NPC Script

```elixir
# Script key: "elder_monk_say"
# Hook: on_say

keyword = downcase(context.message)

cond do
  # Greeting
  contains?(keyword, "hello") or contains?(keyword, "greetings") ->
    if has_flag?("met_elder") do
      say("Welcome back, #{player.name}.")
    else
      set_flag("met_elder", true)
      say("Greetings, young traveler. I am Elder Tenzin.")
      say("The monastery has seen better days...")
      :handled
    end

  # Quest hook
  contains?(keyword, "help") and not quest_active?("monastery_quest") ->
    say("Indeed, we could use assistance.")
    say("Dark forces stir in the caves below...")
    start_quest("monastery_quest")
    give_item("monastery_key")
    message("Elder Tenzin hands you an old iron key.")
    :handled

  # Quest progress check
  contains?(keyword, "caves") and quest_active?("monastery_quest") ->
    if has_item?("dark_crystal") do
      say("You found it! The source of the corruption!")
      complete_objective("monastery_quest", "find_crystal")
      :handled
    else
      say("The crystal must be somewhere in those caves...")
      :continue
    end

  # Random flavor
  contains?(keyword, "wisdom") ->
    wisdom = pick([
      "The mountain does not climb itself.",
      "Water flows around obstacles, not through them.",
      "Even the longest journey begins beneath your feet."
    ])
    say(wisdom)
    emote("strokes his beard thoughtfully")
    :handled

  # Fallback
  true ->
    :continue
end
```

---

## World Manipulation API

Scripts can manipulate the game world extensively. All mutations are queued and validated before execution.

### Room & Environment

```elixir
# Room queries
room()                               # Current room data
room(room_id)                        # Get specific room
room().key                           # Room key
room().name                          # Room name
room().exits                         # Available exits: %{north: room_id, ...}
room().attributes                    # Custom room attributes

# Room attributes (read)
get_room_attr(key)                   # Get room attribute
get_room_attr(key, default)          # With default
is_indoor?()                         # Check if indoor
is_dark?()                           # Check lighting
danger_level()                       # 0-10 danger rating

# Room state changes (queued)
set_room_attr(key, value)            # Set custom attribute
set_room_desc(text)                  # Temporarily change description
set_room_desc(text, duration: 300)   # Change for 5 minutes
add_room_effect(effect)              # Add visual/ambient effect
remove_room_effect(effect)           # Remove effect

# Exits and doors
lock_exit(direction)                 # Lock an exit
unlock_exit(direction)               # Unlock exit
hide_exit(direction)                 # Make exit invisible
reveal_exit(direction)               # Make exit visible
create_exit(direction, target_room)  # Create temporary exit
remove_exit(direction)               # Remove temporary exit

# Environmental effects
set_lighting(level)                  # :bright, :dim, :dark, :pitch_black
set_temperature(level)               # :freezing, :cold, :mild, :warm, :hot
trigger_weather(type)                # :rain, :storm, :fog (outdoor only)
trigger_effect(effect_key)           # Predefined effect (earthquake, etc.)

# Room-wide messages
announce_room(text)                  # Message to all in room
announce_room(text, except: [ids])   # Exclude specific entities
announce_adjacent(text)              # Message to adjacent rooms
```

### Entity Manipulation

```elixir
# Entity queries (read-only)
get_entity(entity_id)                # Get entity by ID
get_entity(key: "novice_pema")       # Get by key
find_entities(type: :npc)            # Find by type in room
find_entities(key: "goblin")         # Find by key pattern
find_entities(tag: "hostile")        # Find by tag
entity_exists?(entity_id)            # Check if entity exists
entity_in_room?(entity_id)           # Check if in current room

# Entity attributes (read)
get_attr(entity, key)                # Get entity attribute
get_attr(entity, key, default)       # With default
get_component(entity, component)     # Get component data

# Entity state changes (queued)
set_attr(entity_id, key, value)      # Set attribute
set_mood(entity_id, mood)            # Change mood
set_hostile(entity_id, boolean)      # Set hostility
set_description(entity_id, text)     # Change description
add_tag(entity_id, tag)              # Add tag
remove_tag(entity_id, tag)           # Remove tag

# Entity movement
move_entity(entity_id, room_id)      # Move to room
teleport(entity_id, room_id)         # Instant move (no triggers)
follow_player(npc_id, player_id)     # NPC follows player
stop_following(npc_id)               # Stop following
patrol(npc_id, [room_ids])           # Set patrol route

# Entity visibility
hide_entity(entity_id)               # Make invisible
reveal_entity(entity_id)             # Make visible
set_visible_to(entity_id, [player_ids])  # Visible only to specific players
```

### NPC Control

```elixir
# NPC communication
npc_say(npc_id, text)                # NPC speaks
npc_say(npc_id, text, to: player)    # NPC speaks to specific player
npc_emote(npc_id, action)            # NPC emotes
npc_whisper(npc_id, player_id, text) # Private message

# NPC actions
npc_look_at(npc_id, target_id)       # NPC looks at something
npc_use(npc_id, object_id)           # NPC uses object
npc_give(npc_id, item_key, to: target) # NPC gives item
npc_take(npc_id, item_key)           # NPC takes item from room
npc_drop(npc_id, item_key)           # NPC drops item

# NPC behavior
set_behavior(npc_id, behavior_key)   # Change behavior module
trigger_behavior(npc_id, event)      # Trigger specific behavior
pause_behavior(npc_id)               # Pause AI
resume_behavior(npc_id)              # Resume AI

# NPC combat
npc_attack(npc_id, target_id)        # NPC attacks
npc_flee(npc_id)                     # NPC flees combat
npc_defend(npc_id)                   # NPC enters defensive stance
set_aggro(npc_id, player_id, amount) # Modify threat

# NPC dialogue
start_dialogue(npc_id, player_id, dialogue_key)  # Begin dialogue
advance_dialogue(npc_id, player_id, choice)      # Advance dialogue state
end_dialogue(npc_id, player_id)                  # End dialogue
```

### Object Creation & Manipulation

```elixir
# Spawn objects (queued)
spawn_item(item_key)                 # Spawn in current room
spawn_item(item_key, in: room_id)    # Spawn in specific room
spawn_item(item_key, to: player_id)  # Spawn in player inventory
spawn_item(item_key, on: entity_id)  # Spawn on entity (equipped)
spawn_item(item_key, count: 5)       # Spawn multiple

spawn_npc(npc_key)                   # Spawn NPC in current room
spawn_npc(npc_key, in: room_id)      # Spawn in specific room
spawn_npc(npc_key, attrs: %{})       # Spawn with custom attributes

# Object manipulation
destroy_entity(entity_id)            # Remove from world
destroy_item(item_key)               # Remove first matching item in room
destroy_all(item_key)                # Remove all matching items

move_item(item_id, to: container_id) # Move to container
move_item(item_id, to: room_id)      # Move to room floor
equip_item(player_id, item_id, slot) # Equip on player/NPC
unequip_item(player_id, slot)        # Unequip from slot

# Object state
set_item_attr(item_id, key, value)   # Set item attribute
transform_item(item_id, new_key)     # Transform into different item
repair_item(item_id)                 # Restore durability
damage_item(item_id, amount)         # Reduce durability

# Containers
add_to_container(item_id, container_id)
remove_from_container(item_id)
container_contents(container_id)     # List contents
container_has?(container_id, item_key)
```

### Combat & Damage

```elixir
# Combat initiation
start_combat(attacker_id, target_id) # Begin combat
join_combat(entity_id, side: :attacker) # Join existing combat
leave_combat(entity_id)              # Leave combat
end_combat()                         # End all combat in room

# Damage and healing
damage(target_id, amount)            # Deal damage
damage(target_id, amount, type: :fire) # Typed damage
heal(target_id, amount)              # Restore health
kill(target_id)                      # Instant kill (for scripts/traps)
resurrect(target_id)                 # Bring back to life

# Status effects
apply_effect(target_id, effect_key)  # Apply status effect
apply_effect(target_id, effect_key, duration: 60)
remove_effect(target_id, effect_key) # Remove effect
has_effect?(target_id, effect_key)   # Check for effect
clear_effects(target_id)             # Remove all effects

# Combat state
in_combat?(entity_id)                # Check if in combat
get_combat_target(entity_id)         # Current target
set_combat_target(entity_id, target) # Change target
```

### World State & Persistence

```elixir
# Global flags (persist across sessions)
get_world_flag(key)                  # Get global flag
get_world_flag(key, default)         # With default
set_world_flag(key, value)           # Set global flag
increment_world_flag(key)            # Increment counter
increment_world_flag(key, by: 5)     # Increment by amount

# Zone state
get_zone_flag(zone_id, key)          # Zone-specific flag
set_zone_flag(zone_id, key, value)   # Set zone flag
reset_zone(zone_id)                  # Reset zone to default state

# Time and scheduling
schedule(delay, script_key)          # Run script after delay
schedule(delay, script_key, context) # With context
schedule_at(hour, script_key)        # Run at specific game hour
cancel_schedule(schedule_id)         # Cancel scheduled script
recurring(interval, script_key)      # Repeat every N seconds
cancel_recurring(recurring_id)       # Stop recurring

# Persistence
save_data(key, value)                # Persist custom data
load_data(key)                       # Load custom data
load_data(key, default)              # With default
delete_data(key)                     # Remove persisted data
```

### Triggers & Events

```elixir
# Traps and hazards
trigger_trap(trap_id)                # Activate trap
arm_trap(trap_id)                    # Arm trap
disarm_trap(trap_id)                 # Disarm trap
is_trap_armed?(trap_id)              # Check trap state

# Puzzles and mechanics
set_puzzle_state(puzzle_id, state)   # Update puzzle
check_puzzle_solved?(puzzle_id)      # Check if solved
reset_puzzle(puzzle_id)              # Reset puzzle

# Custom events
emit(event_name, data)               # Emit custom event
emit_to(entity_id, event_name, data) # Emit to specific entity
emit_room(event_name, data)          # Emit to room
emit_zone(zone_id, event_name, data) # Emit to zone
broadcast(event_name, data)          # Global broadcast

# Cutscenes and sequences
start_cutscene(cutscene_key, player_id)
advance_cutscene(player_id)
skip_cutscene(player_id)
end_cutscene(player_id)

# Sound and visual effects
play_sound(sound_key)                # Play to room
play_sound(sound_key, to: player_id) # Play to player
show_effect(effect_key)              # Visual effect in room
show_effect(effect_key, at: coords)  # At specific position
```

### Player Manipulation

```elixir
# Player state
get_player(player_id)                # Get player data
player_online?(player_id)            # Check if online
player_location(player_id)           # Get player's room

# Player movement
teleport_player(player_id, room_id)  # Instant teleport
recall_player(player_id)             # Return to bind point
set_bind_point(player_id, room_id)   # Set recall location

# Player resources
restore_health(player_id)            # Full heal
restore_mana(player_id)              # Full mana
restore_stamina(player_id)           # Full stamina
add_xp(player_id, amount)            # Award XP
add_currency(player_id, amount, type) # Award currency
remove_currency(player_id, amount, type)

# Player state effects
stun(player_id, duration)            # Stun player
root(player_id, duration)            # Prevent movement
silence(player_id, duration)         # Prevent abilities
blind(player_id, duration)           # Reduce visibility
confuse(player_id, duration)         # Random movement

# Transformation
transform_player(player_id, form)    # Polymorph
restore_form(player_id)              # Return to normal
set_player_size(player_id, scale)    # Change size
set_player_speed(player_id, multiplier)
```

### Party & Social

```elixir
# Party queries
get_party(player_id)                 # Get party members
in_party?(player_id)                 # Check if in party
party_leader?(player_id)             # Check if leader
party_size(player_id)                # Number in party

# Party manipulation
create_party(leader_id)              # Create new party
invite_to_party(leader_id, player_id)
kick_from_party(leader_id, player_id)
disband_party(leader_id)

# Party-wide effects
party_message(player_id, text)       # Message to party
party_teleport(leader_id, room_id)   # Teleport whole party
party_heal(leader_id, amount)        # Heal party
party_buff(leader_id, effect_key)    # Apply effect to party
```

### Example: Complex Environmental Script

```elixir
# Script key: "ancient_tomb_enter"
# Hook: on_enter
# Attached to: room "ancient_tomb"

# Check if player has the key
unless has_item?("tomb_key") do
  message("The ancient door refuses to budge without the proper key.")
  deny()
end

# First time entry - dramatic reveal
unless get_world_flag("tomb_opened") do
  set_world_flag("tomb_opened", true)

  # Environmental effects
  announce_room("Ancient dust swirls as the tomb opens for the first time in centuries...")
  play_sound("stone_grinding")
  set_lighting(:dim)

  # Spawn the guardian
  spawn_npc("tomb_guardian", attrs: %{
    mood: "ancient and watchful",
    hostile: false
  })

  # Spawn treasure
  spawn_item("ancient_artifact")
  spawn_item("gold_coins", count: 100)

  # Start the puzzle
  set_puzzle_state("tomb_puzzle", :active)

  # Schedule the guardian's greeting
  after(2, "tomb_guardian_greet", %{player_id: player.id})

  # Notify adjacent rooms
  announce_adjacent("A low rumble echoes from the ancient tomb...")
end

# Check for curse
if has_effect?(player.id, "tomb_curse") do
  damage(player.id, 10, type: :necrotic)
  message("The curse burns within you...")
end

# Track visits for achievement
increment_world_flag("tomb_visits")
if get_world_flag("tomb_visits") >= 10 do
  unless has_flag?("tomb_explorer_badge") do
    set_flag("tomb_explorer_badge", true)
    message("Achievement Unlocked: Tomb Explorer!")
  end
end

:allow
```

### Example: Interactive NPC Merchant

```elixir
# Script key: "wandering_merchant_say"
# Hook: on_say

keyword = downcase(context.message)

cond do
  # Show wares
  contains?(keyword, "buy") or contains?(keyword, "wares") or contains?(keyword, "shop") ->
    npc_emote(entity.id, "spreads out a colorful array of goods")

    # Dynamic inventory based on world state
    wares = if get_world_flag("festival_active") do
      ["festival_mask", "sparkler", "lucky_charm"]
    else
      ["health_potion", "torch", "rope"]
    end

    message("Available wares:")
    for item <- wares do
      price = get_item_price(item)
      message("  • #{item_name(item)} - #{price} gold")
    end

    :handled

  # Purchase item
  matches?(keyword, ~r/buy (.+)/) ->
    [_, item_name] = Regex.run(~r/buy (.+)/, keyword)
    item_key = normalize_item_key(item_name)
    price = get_item_price(item_key)

    cond do
      price == nil ->
        say("I don't have that, friend.")

      get_currency(player.id, :gold) < price ->
        say("You don't have enough gold for that!")
        npc_emote(entity.id, "shakes his head sadly")

      true ->
        remove_currency(player.id, price, :gold)
        spawn_item(item_key, to: player.id)
        say("Pleasure doing business!")
        npc_emote(entity.id, "hands over the #{item_name}")

        # Random bonus for big spenders
        if price > 100 and chance?(20) do
          spawn_item("merchant_token", to: player.id)
          say("Here's a little something extra for a valued customer.")
        end
    end
    :handled

  # Haggle
  contains?(keyword, "haggle") or contains?(keyword, "discount") ->
    if has_flag?("haggled_today") do
      say("We already made a deal today, friend.")
    else
      if get_skill(player.id, "persuasion") >= 5 and chance?(50) do
        set_flag("haggled_today", true)
        set_flag("merchant_discount", 0.9)
        say("Alright, alright! 10% off, but just for today!")
      else
        say("These prices are already rock bottom!")
        npc_emote(entity.id, "crosses his arms")
      end
    end
    :handled

  # Gossip
  contains?(keyword, "news") or contains?(keyword, "rumors") ->
    rumors = [
      "I heard strange lights in the old tower last night...",
      "The blacksmith's daughter went missing. Terrible business.",
      "They say the king is looking for adventurers.",
      "Watch yourself in the eastern woods. Wolves have been spotted."
    ]
    say(pick(rumors))
    :handled

  true ->
    :continue
end
```

### Security: What Scripts CANNOT Do

Even with this extensive API, scripts remain sandboxed:

```elixir
# BLOCKED - System access
System.cmd("rm", ["-rf", "/"])       # No shell access
File.write("hack.txt", "data")       # No file system
:os.cmd("whoami")                    # No OS commands

# BLOCKED - Process manipulation
spawn(fn -> loop() end)              # No process creation
send(pid, :message)                  # No message passing
Process.exit(pid, :kill)             # No process killing

# BLOCKED - Code execution
Code.eval_string("malicious")        # No dynamic code
apply(Module, :func, [])             # No arbitrary calls
import SomeModule                    # No imports

# BLOCKED - Network access
:httpc.request(:get, {url, []}, [], [])  # No HTTP
:gen_tcp.connect(host, port, [])         # No sockets

# RATE LIMITS (enforced at runtime)
spawn_item/spawn_npc                 # Max 10 per script execution
damage/heal                          # Max 1000 per call
announce_*                           # Max 5 per script
schedule/recurring                   # Max 3 active per entity
```

### Implementation Priority

**Phase 1 - Core (Week 1-2):**
- Context variables (entity, player, context, room)
- Query functions (quest_*, has_*, get_*, room queries)
- Basic actions (say, message, set_flag, give_item)
- Return values for hooks

**Phase 2 - Environment (Week 3-4):**
- Room manipulation (set_room_attr, lighting, exits)
- Entity queries (find_entities, get_entity)
- Object spawning (spawn_item, spawn_npc, destroy_entity)
- Environmental effects

**Phase 3 - NPC & Combat (Week 5-6):**
- NPC control (npc_say, npc_move, behaviors)
- Combat functions (damage, heal, status effects)
- Entity movement (move_entity, teleport, follow)

**Phase 4 - Advanced (Week 7-8):**
- World state (world flags, zone flags, persistence)
- Scheduling (after, schedule_at, recurring)
- Custom events (emit, broadcast)
- Party functions

**Phase 5 - Polish (Week 9-10):**
- Cutscenes and sequences
- Sound and visual effects
- Puzzles and traps
- Admin UI improvements
- Documentation and examples
