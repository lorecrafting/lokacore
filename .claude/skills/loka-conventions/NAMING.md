# Naming Conventions

## Modules

### Framework Modules
```elixir
Loka.Framework.Quest           # Domain concepts
Loka.Framework.Dialogue        # Core systems
Loka.Framework.Combat          # Game mechanics
```

### Engine Modules
```elixir
Loka.Engine.Entities          # Entity system
Loka.Engine.TypedObject       # Content system
Loka.Engine.Hooks             # Hook registry
```

### Game Actions
```elixir
Loka.Game.Actions.Navigation  # Player actions
Loka.Game.Actions.Combat      # Combat actions
Loka.Game.Actions.Dialogue    # Dialogue actions
```

### Testing
```elixir
Loka.Testing.Bot.ChannelBot   # Test infrastructure
Loka.Testing.QuestStrategy    # Test strategies
```

## Functions

### Public API Functions
- Use clear, descriptive names
- Active voice: `start_conversation`, `complete_quest`
- Boolean queries: `quest_completed?`, `has_item?`

```elixir
# Good
def start_conversation(entity_id, opts)
def quest_completed?(game_state, quest_id)
def has_item?(inventory, item_key)

# Avoid
def conv(id, o)
def check_quest(g, q)
def item?(i, k)
```

### Private Helpers
- Prefix with verb: `parse_`, `format_`, `build_`, `validate_`
- Clear purpose: `get_destination_name`, `extract_quest_data`

```elixir
defp parse_objectives(data)
defp format_room(room_entity)
defp build_context(socket)
defp validate_quest_definition(quest)
```

### Pattern Matching Functions
- Use descriptive patterns
- Add docstrings for complex matches

```elixir
defp handle_event({:quest_accepted, quest_id}, state)
defp dispatch_event({:dialogue_start, data}, socket)
defp convert_action({:navigate, direction})
```

## Variables

### Use Descriptive Names
```elixir
# Good
def process_quest(game_state, quest_id) do
  quest_def = Quest.get_quest_definition(quest_id)
  active_objectives = find_incomplete_objectives(quest_def)
  next_objective = List.first(active_objectives)
end

# Avoid
def process_quest(gs, qid) do
  qd = Quest.get_quest_definition(qid)
  ao = find_incomplete_objectives(qd)
  no = List.first(ao)
end
```

### Context Variables
- `ctx` or `context` for Action context
- `socket` for Phoenix socket
- `bot` for ChannelBot struct
- `player` for player record
- `game_state` for GameState struct

## File Names

### Match Module Names
```
lib/loka/framework/quest.ex          → Loka.Framework.Quest
lib/loka/game/actions/dialogue.ex    → Loka.Game.Actions.Dialogue
lib/loka_web/live/game_live.ex       → LokaWeb.GameLive
```

### Test Files
```
test/loka/framework/quest_test.exs
test/loka/game/actions/dialogue_test.exs
test/loka_web/live/game_live_test.exs
```

## Constants and Attributes

### Module Attributes (Constants)
```elixir
@default_timeout 5000
@max_retries 3
@allowed_quest_types [:main, :side, :daily]
```

### Magic Numbers
- Define as named constants
- Document purpose

```elixir
# Good
@entry_effect_delay 800  # milliseconds
@max_dialogue_choices 6

# Avoid
Process.sleep(800)  # What is 800?
if length(choices) > 6  # Why 6?
```

## Database and Schema Fields

### Schema Fields (snake_case)
```elixir
schema "quests" do
  field :quest_id, :string
  field :quest_type, :string
  field :giver_key, :string
  field :turn_in_npc, :string
  timestamps()
end
```

### JSON/Map Keys
Use string keys for external data, atom keys for internal:
```elixir
# External (YAML, JSON)
%{"quest_id" => "intro_welcome", "type" => "main"}

# Internal (structs, pattern matching)
%{quest_id: "intro_welcome", type: :main}
```

## Avoid

- Single-letter variables (except `i` in simple loops)
- Abbreviations that aren't obvious (`ctx` is ok, `qstdf` is not)
- Overly generic names (`data`, `info`, `stuff`)
- Hungarian notation (`strName`, `intCount`)
- Inconsistent naming between similar functions
