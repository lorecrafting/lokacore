# Common Patterns

## Action Result Pattern

Game actions return `{:ok, Result.t()} | {:error, reason}`:

```elixir
def execute_action(ctx, params) do
  case validate_preconditions(ctx, params) do
    :ok ->
      result = Result.new(
        state: %{game_state: updated_game_state, room: new_room},
        events: [{:event, "Action succeeded"}, {:stats_update, stats}]
      )
      {:ok, result}

    {:error, reason} ->
      {:error, reason}
  end
end
```

**Result struct contains:**
- `state`: Map of state changes (game_state, room, combat, dialogue, etc.)
- `events`: List of events to dispatch to client

## Event Dispatch Pattern

Events are tuples with type and data:

```elixir
events = [
  {:event, "You picked up an item"},
  {:inventory_update, %{action: "add", item_id: item_id}},
  {:stats_update, %{stats: new_stats}}
]
```

ActionBridge dispatches each event to appropriate handler:
```elixir
defp dispatch_event({:inventory_update, data}, socket) do
  Phoenix.Channel.push(socket, "inventory_update", data)
  socket
end
```

## State Update Pattern

Use `maybe_assign` pattern for conditional socket updates:

```elixir
socket
|> maybe_assign(:game_state, state[:game_state])
|> maybe_assign(:room, state[:room])
|> maybe_assign(:combat, state[:combat])

defp maybe_assign(socket, _key, nil), do: socket
defp maybe_assign(socket, key, value), do: Phoenix.Socket.assign(socket, key, value)
```

## Quest Progress Pattern

Update quest progress through centralized function:

```elixir
case Quest.update_progress(game_state, %{type: :talk, target_id: npc_key}) do
  {:ok, updated_state, completed_objectives} ->
    # Broadcast updates
    Phoenix.Channel.push(socket, "game_state", %{quests: updated_state.quests})
    {:ok, updated_state}

  {:error, reason} ->
    {:error, reason}
end
```

## Entity Component Pattern

Entities use composition over inheritance:

```elixir
# Entity with components
%Entity{
  id: "uuid",
  key: "elder_monk",
  type: :npc,
  components: %{
    "dialogue_tree" => dialogue_data,
    "combatant" => combat_stats,
    "quest_giver" => quest_ids
  }
}

# Check for component
def has_dialogue?(entity) do
  Map.has_key?(entity.components || %{}, "dialogue_tree")
end
```

## TypedObject Loading Pattern

Load content with fallback chain:

```elixir
def get_quest_definition(quest_id) do
  # 1. TypedObject (newest)
  case Content.Quest.get(quest_id) do
    {:ok, typed_object} ->
      quest_from_typed_object(typed_object)

    {:error, :not_found} ->
      # 2. QuestRegistry (YAML)
      case QuestRegistry.get(quest_id) do
        {:ok, quest} -> quest
        {:error, :not_found} ->
          # 3. Database (legacy)
          get_quest_from_entity(quest_id)
      end
  end
end
```

## Pipeline Pattern

Use pipes for transformations:

```elixir
def format_room(room) do
  contents = Entities.get_contents(room.id)

  npcs =
    contents
    |> Enum.filter(&(&1.type == :npc))
    |> Enum.reject(&is_despawned?/1)
    |> Enum.map(&format_npc/1)

  # ...
end
```

## With Pattern for Complex Logic

Use `with` for sequential operations that can fail:

```elixir
def complete_quest(ctx, quest_id) do
  with {:ok, quest_def} <- get_quest_definition(quest_id),
       :ok <- validate_all_objectives_complete(ctx.game_state, quest_def),
       {:ok, rewards} <- calculate_rewards(quest_def),
       {:ok, new_state} <- apply_rewards(ctx.game_state, rewards) do
    {:ok, new_state, rewards}
  else
    {:error, reason} -> {:error, reason}
  end
end
```

## Logger Pattern

Use structured logging with context:

```elixir
require Logger

# Info level for normal flow
Logger.info("[STRATEGY] Phase transition: #{old_phase} → #{new_phase}")

# Warning for recoverable issues
Logger.warning("[DIALOGUE] Failed to update quest progress: #{inspect(reason)}")

# Debug for detailed traces (only in dev)
Logger.debug("[PATHFINDING] Exploring node: #{inspect(node)}, distance: #{distance}")
```

## Error Handling Pattern

Return errors, don't raise (except for programmer errors):

```elixir
# Good - return error
def find_npc(room, npc_key) do
  case Enum.find(room.entities, &(&1.key == npc_key)) do
    nil -> {:error, :npc_not_found}
    npc -> {:ok, npc}
  end
end

# Raise only for programmer errors
def get_quest_definition!(quest_id) do
  case get_quest_definition(quest_id) do
    nil -> raise "Quest definition not found: #{quest_id}"
    quest -> quest
  end
end
```

## Testing Pattern

Structure tests with setup, execute, assert:

```elixir
test "completes talk objective when starting conversation" do
  # Setup
  player = create_test_player()
  game_state = GameState.new() |> accept_quest("intro_welcome")
  ctx = %Context{player_id: player.id, game_state: game_state}

  # Execute
  {:ok, result} = Dialogue.start_conversation(ctx, "novice_pema")

  # Assert
  updated_quests = result.state.game_state.quests
  talk_objective = get_objective(updated_quests, "intro_welcome", "talk_pema")
  assert talk_objective.completed == true
end
```

## Bot Decision Pattern

Bot strategies return action + updated state:

```elixir
@impl true
def decide(context, strategy_state) do
  case strategy_state.phase do
    :navigate ->
      case find_path(context.room, strategy_state.target_room) do
        {:ok, [next_direction | _]} ->
          {{:move, next_direction}, strategy_state}

        {:error, :no_path} ->
          {{:stuck, :unreachable}, %{strategy_state | phase: :failed}}
      end

    :dialogue ->
      choice_index = find_best_choice(context.dialogue, strategy_state.goal)
      {{:dialogue_choice, choice_index}, strategy_state}
  end
end
```
