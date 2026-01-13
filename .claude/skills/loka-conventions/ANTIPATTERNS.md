# Anti-Patterns to Avoid

## ❌ Direct Entity Mutation

**Don't** mutate entities directly:
```elixir
# BAD
def add_item(entity, item) do
  entity.inventory = entity.inventory ++ [item]
  entity
end
```

**Do** return new state via Actions:
```elixir
# GOOD
def add_item(ctx, item_id) do
  result = Result.new(
    state: %{game_state: updated_game_state},
    events: [{:inventory_update, %{action: "add", item_id: item_id}}]
  )
  {:ok, result}
end
```

## ❌ Side Effects in Strategies

**Don't** perform side effects in strategy logic:
```elixir
# BAD
def decide(context, state) do
  # Side effect! Strategy should be pure
  Phoenix.Channel.push(socket, "event", %{text: "Deciding..."})
  {:move, "north"}
end
```

**Do** keep strategies pure:
```elixir
# GOOD
def decide(context, state) do
  # Pure function - returns action, no side effects
  {:move, "north"}
end
```

## ❌ Mixing Concerns

**Don't** mix layers:
```elixir
# BAD - Framework calling Web directly
defmodule Loka.Framework.Quest do
  def complete_quest(quest_id) do
    Phoenix.Channel.broadcast(...)  # Web concern in Framework!
  end
end
```

**Do** respect layer boundaries:
```elixir
# GOOD - Framework returns events, Web layer broadcasts
defmodule Loka.Framework.Quest do
  def complete_quest(quest_id) do
    {:ok, %{events: [{:quest_completed, quest_id}]}}
  end
end

# Web layer handles broadcasting
defmodule LokaWeb.Channels.ActionBridge do
  defp dispatch_event({:quest_completed, quest_id}, socket) do
    Phoenix.Channel.push(socket, "quest_completed", %{quest_id: quest_id})
    socket
  end
end
```

## ❌ Inconsistent Error Handling

**Don't** mix error patterns:
```elixir
# BAD
def foo, do: nil              # Returns nil
def bar, do: {:error, reason} # Returns tuple
def baz, do: raise "Error"    # Raises exception
```

**Do** use consistent error returns:
```elixir
# GOOD
def foo, do: {:ok, result} | {:error, :not_found}
def bar, do: {:ok, result} | {:error, :invalid}
def baz, do: {:ok, result} | {:error, :failed}
```

## ❌ Magic Values

**Don't** use unexplained magic numbers:
```elixir
# BAD
Process.sleep(800)
if length(list) > 6, do: truncate(list)
```

**Do** use named constants:
```elixir
# GOOD
@entry_effect_delay 800
@max_dialogue_choices 6

Process.sleep(@entry_effect_delay)
if length(list) > @max_dialogue_choices, do: truncate(list)
```

## ❌ Implicit Dependencies

**Don't** rely on implicit state:
```elixir
# BAD
def process_quest do
  # Where does current_quest come from?
  Quest.complete(current_quest)
end
```

**Do** pass dependencies explicitly:
```elixir
# GOOD
def process_quest(game_state, quest_id) do
  Quest.complete(game_state, quest_id)
end
```

## ❌ God Modules

**Don't** create modules that do everything:
```elixir
# BAD
defmodule GameLogic do
  def handle_combat(...)
  def handle_dialogue(...)
  def handle_movement(...)
  def handle_inventory(...)
  # 50 more functions...
end
```

**Do** split by domain:
```elixir
# GOOD
defmodule Loka.Game.Actions.Combat
defmodule Loka.Game.Actions.Dialogue
defmodule Loka.Game.Actions.Navigation
defmodule Loka.Game.Actions.Inventory
```

## ❌ Leaky Abstractions

**Don't** expose implementation details:
```elixir
# BAD
def get_quest(quest_id) do
  # Returns raw Ecto schema - implementation detail leaked!
  Repo.get(QuestSchema, quest_id)
end
```

**Do** return domain types:
```elixir
# GOOD
def get_quest(quest_id) do
  case Repo.get(QuestSchema, quest_id) do
    nil -> {:error, :not_found}
    schema -> {:ok, to_quest_struct(schema)}
  end
end
```

## ❌ Premature Optimization

**Don't** optimize before measuring:
```elixir
# BAD - Overly complex caching for rare reads
def get_quest(quest_id) do
  case Cache.get(:quests, quest_id) do
    nil ->
      quest = expensive_load(quest_id)
      Cache.put(:quests, quest_id, quest, ttl: 3600)
      quest
    cached -> cached
  end
end
```

**Do** start simple, optimize when needed:
```elixir
# GOOD - Simple until proven slow
def get_quest(quest_id) do
  QuestRegistry.get(quest_id)
end
```

## ❌ Overusing Macros

**Don't** create macros for simple functions:
```elixir
# BAD
defmacro log_and_return(value) do
  quote do
    Logger.info("Returning: #{inspect(unquote(value))}")
    unquote(value)
  end
end
```

**Do** use functions:
```elixir
# GOOD
def log_and_return(value) do
  Logger.info("Returning: #{inspect(value)}")
  value
end
```

## ❌ Stringly-Typed Code

**Don't** use strings for enums:
```elixir
# BAD
def handle_phase("init", state), do: ...
def handle_phase("navigate", state), do: ...
def handle_phase("dlg", state), do: ...  # Typo!
```

**Do** use atoms:
```elixir
# GOOD
def handle_phase(:init, state), do: ...
def handle_phase(:navigate, state), do: ...
def handle_phase(:dialogue, state), do: ...
```

## ❌ Testing Implementation Details

**Don't** test private functions directly:
```elixir
# BAD
test "parse_objectives parses correctly" do
  # Testing private implementation detail
  result = MyModule.__private_parse_objectives__(data)
  assert result == expected
end
```

**Do** test public API:
```elixir
# GOOD
test "loads quest with objectives" do
  {:ok, quest} = Quest.get_quest_definition("intro_welcome")
  assert length(quest.objectives) == 1
  assert List.first(quest.objectives).type == :talk
end
```

## ❌ Ignoring Compiler Warnings

**Don't** leave warnings unfixed:
```
warning: unused variable "player"
warning: variable "quest_id" is unused
warning: function foo/1 is undefined or private
```

**Do** fix all warnings:
- Remove unused variables
- Add underscore prefix if intentionally unused: `_player`
- Fix undefined function calls

## ❌ Nested Conditionals

**Don't** create deep nesting:
```elixir
# BAD
def process(data) do
  if data do
    if data.valid? do
      if data.user do
        if data.user.active? do
          # Finally do something
        end
      end
    end
  end
end
```

**Do** use guard clauses or with:
```elixir
# GOOD with guards
def process(nil), do: {:error, :no_data}
def process(%{valid?: false}), do: {:error, :invalid}
def process(%{user: nil}), do: {:error, :no_user}
def process(%{user: %{active?: false}}), do: {:error, :inactive}
def process(data), do: {:ok, do_process(data)}

# OR with 'with'
def process(data) do
  with {:ok, validated} <- validate(data),
       {:ok, user} <- get_user(data),
       :ok <- check_active(user) do
    {:ok, do_process(validated, user)}
  end
end
```
