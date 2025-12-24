defmodule Exmud.Framework.Quest.Progress do
  @moduledoc """
  Quest progress management for the game framework.

  Handles accepting quests, tracking progress, completing objectives,
  and claiming rewards.

  ## Player Quest State

  Quests are stored in the player's game state under the `quests` field:

      %{
        active: %{
          "quest_id" => %{
            objectives: %{
              "obj_1" => %{completed: false, progress: 0},
              "obj_2" => %{completed: true, progress: 5}
            },
            accepted_at: ~U[2024-01-01 00:00:00Z]
          }
        },
        completed: ["old_quest_1", "old_quest_2"]
      }

  ## Usage

      alias Exmud.Framework.Quest.Progress

      # Accept a new quest
      {:ok, state} = Progress.accept_quest(state, "find_sword")

      # Check progress
      Progress.get_active_quests(state)

      # Complete an objective manually
      {:ok, state} = Progress.complete_objective(state, "find_sword", "talk_to_blacksmith")

      # Check if quest is complete
      Progress.is_complete?(state, "find_sword")

      # Turn in for rewards
      {:ok, state, rewards} = Progress.turn_in_quest(state, "find_sword")
  """

  alias Exmud.Framework.Player.GameState
  alias Exmud.Framework.Quest.Definitions

  @doc """
  Accepts a quest for the player.

  Creates a new entry in the player's active quests with fresh objective progress.

  Returns `{:ok, updated_state}` on success.
  Returns `{:error, reason}` if the quest can't be accepted.

  ## Examples

      iex> accept_quest(state, "find_sword")
      {:ok, %GameState{quests: %{active: %{"find_sword" => ...}}}}
  """
  def accept_quest(%GameState{quests: quests} = state, quest_id) do
    # Quests from DB use string keys
    active = Map.get(quests, "active") || Map.get(quests, :active, %{})
    completed = Map.get(quests, "completed") || Map.get(quests, :completed, [])

    cond do
      Map.has_key?(active, quest_id) ->
        {:error, :already_active}

      quest_id in completed ->
        {:error, :already_completed}

      true ->
        case Definitions.get_quest_definition(quest_id) do
          nil ->
            {:error, :quest_not_found}

          quest_def ->
            objectives = initialize_objectives(quest_def.objectives)

            new_active =
              Map.put(active, quest_id, %{
                "objectives" => objectives,
                "accepted_at" => DateTime.utc_now()
              })

            # Use string keys for DB storage
            new_quests = Map.put(quests, "active", new_active)
            GameState.update_state(state, %{quests: new_quests})
        end
    end
  end

  @doc """
  Updates quest progress based on a game event.

  Automatically checks active quests for matching objectives and updates progress.

  ## Event Format

      %{type: :talk, target_id: "npc_blacksmith"}
      %{type: :kill, target_id: "goblin", count: 1}
      %{type: :get_item, target_id: "magic_sword"}
      %{type: :go_to, target_id: "dark_forest"}

  Returns `{:ok, updated_state, completed_objectives}`.
  """
  def update_progress(%GameState{quests: quests} = state, event) do
    active = Map.get(quests, "active") || Map.get(quests, :active, %{})
    # Events are in-memory so use atom keys
    event_type = Map.get(event, :type)
    target_id = Map.get(event, :target_id)
    count = Map.get(event, :count, 1)

    {new_active, completed} =
      Enum.reduce(active, {%{}, []}, fn {quest_id, quest_data}, {acc_active, acc_completed} ->
        objectives = quest_data["objectives"] || quest_data[:objectives] || %{}

        {updated_objectives, newly_completed} =
          update_quest_objectives(objectives, event_type, target_id, count, quest_id)

        new_quest_data = Map.put(quest_data, "objectives", updated_objectives)
        {Map.put(acc_active, quest_id, new_quest_data), acc_completed ++ newly_completed}
      end)

    new_quests = Map.put(quests, "active", new_active)

    case GameState.update_state(state, %{quests: new_quests}) do
      {:ok, new_state} -> {:ok, new_state, completed}
      error -> error
    end
  end

  @doc """
  Manually completes an objective for a quest.

  Useful for objectives that can't be auto-tracked.

  Returns `{:ok, updated_state}` on success.
  """
  def complete_objective(%GameState{quests: quests} = state, quest_id, objective_id) do
    active = Map.get(quests, "active") || Map.get(quests, :active, %{})

    case Map.get(active, quest_id) do
      nil ->
        {:error, :quest_not_active}

      quest_data ->
        objectives = quest_data["objectives"] || quest_data[:objectives] || %{}

        case Map.get(objectives, objective_id) do
          nil ->
            {:error, :objective_not_found}

          _objective ->
            updated_objective = %{"completed" => true, "progress" => 1}
            objectives = quest_data["objectives"] || quest_data.objectives
            updated_objectives = Map.put(objectives, objective_id, updated_objective)
            updated_quest_data = Map.put(quest_data, "objectives", updated_objectives)
            new_active = Map.put(active, quest_id, updated_quest_data)
            new_quests = Map.put(quests, "active", new_active)
            GameState.update_state(state, %{quests: new_quests})
        end
    end
  end

  @doc """
  Checks if all objectives for a quest are complete.

  ## Examples

      iex> is_complete?(state, "find_sword")
      true
  """
  def is_complete?(%GameState{quests: quests}, quest_id) do
    active = Map.get(quests, "active") || Map.get(quests, :active, %{})

    case Map.get(active, quest_id) do
      nil ->
        false

      quest_data ->
        objectives = quest_data["objectives"] || quest_data[:objectives] || %{}

        Enum.all?(objectives, fn {_id, obj} ->
          Map.get(obj, "completed") || Map.get(obj, :completed, false)
        end)
    end
  end

  @doc """
  Turns in a completed quest and claims rewards.

  Moves the quest from active to completed and applies rewards.

  Returns `{:ok, updated_state, rewards}` on success.
  Returns `{:error, reason}` if the quest can't be turned in.

  ## Reward Types

  - `:xp` - Experience points
  - `:gold` - Gold currency (stored in flags)
  - `:items` - List of item IDs to add to inventory
  """
  def turn_in_quest(%GameState{quests: quests} = state, quest_id) do
    if not is_complete?(state, quest_id) do
      {:error, :quest_not_complete}
    else
      case Definitions.get_quest_definition(quest_id) do
        nil ->
          {:error, :quest_not_found}

        quest_def ->
          active = Map.get(quests, "active") || Map.get(quests, :active, %{})
          completed = Map.get(quests, "completed") || Map.get(quests, :completed, [])

          new_active = Map.delete(active, quest_id)
          new_completed = [quest_id | completed]

          new_quests =
            quests
            |> Map.put("active", new_active)
            |> Map.put("completed", new_completed)

          with {:ok, state} <- GameState.update_state(state, %{quests: new_quests}),
               {:ok, state} <- apply_rewards(state, quest_def.rewards) do
            {:ok, state, quest_def.rewards}
          end
      end
    end
  end

  @doc """
  Gets all active quests with their progress.

  Returns a list of maps with quest info and progress.
  """
  def get_active_quests(%GameState{quests: quests}) do
    active = Map.get(quests, "active") || Map.get(quests, :active, %{})

    Enum.map(active, fn {quest_id, quest_data} ->
      quest_def = Definitions.get_quest_definition(quest_id)

      objectives = quest_data["objectives"] || quest_data[:objectives] || %{}
      accepted_at = quest_data["accepted_at"] || quest_data[:accepted_at]

      %{
        id: quest_id,
        name: quest_def && quest_def.name,
        description: quest_def && quest_def.description,
        objectives: format_objectives(objectives, quest_def),
        accepted_at: accepted_at,
        is_complete: all_objectives_complete?(objectives)
      }
    end)
  end

  @doc """
  Gets the list of completed quest IDs.
  """
  def get_completed_quests(%GameState{quests: quests}) do
    Map.get(quests, "completed") || Map.get(quests, :completed, [])
  end

  @doc """
  Gets the progress for a specific quest.

  Returns nil if the quest is not active.
  """
  def get_quest_progress(%GameState{quests: quests}, quest_id) do
    active = Map.get(quests, "active") || Map.get(quests, :active, %{})
    Map.get(active, quest_id)
  end

  # Private functions

  defp initialize_objectives(objectives) do
    objectives
    |> Enum.map(fn obj ->
      # Use string keys for DB storage
      {obj.id, %{"completed" => false, "progress" => 0}}
    end)
    |> Map.new()
  end

  defp update_quest_objectives(objectives, event_type, target_id, count, quest_id) do
    Enum.reduce(objectives, {%{}, []}, fn {obj_id, obj_data}, {acc_obj, acc_completed} ->
      # Get the objective definition to check if it matches
      quest_def = Definitions.get_quest_definition(quest_id)
      obj_def = quest_def && Enum.find(quest_def.objectives, &(&1.id == obj_id))

      # Handle both atom and string keys from DB
      is_completed = Map.get(obj_data, "completed") || Map.get(obj_data, :completed, false)
      current_progress = Map.get(obj_data, "progress") || Map.get(obj_data, :progress, 0)

      if obj_def && obj_def.type == event_type && obj_def.target_id == target_id &&
           not is_completed do
        new_progress = current_progress + count
        completed = new_progress >= obj_def.target_count

        # Use string keys for DB storage
        updated = %{"progress" => new_progress, "completed" => completed}

        completed_list =
          if completed do
            [{quest_id, obj_id}]
          else
            []
          end

        {Map.put(acc_obj, obj_id, updated), acc_completed ++ completed_list}
      else
        {Map.put(acc_obj, obj_id, obj_data), acc_completed}
      end
    end)
  end

  defp all_objectives_complete?(objectives) do
    Enum.all?(objectives, fn {_id, obj} ->
      Map.get(obj, "completed") || Map.get(obj, :completed, false)
    end)
  end

  defp format_objectives(progress_map, quest_def) do
    if quest_def do
      Enum.map(quest_def.objectives, fn obj ->
        progress = Map.get(progress_map, obj.id, %{"completed" => false, "progress" => 0})
        prog_val = Map.get(progress, "progress") || Map.get(progress, :progress, 0)
        completed_val = Map.get(progress, "completed") || Map.get(progress, :completed, false)

        %{
          id: obj.id,
          type: obj.type,
          description: obj.description,
          target_count: obj.target_count,
          progress: prog_val,
          completed: completed_val
        }
      end)
    else
      []
    end
  end

  defp apply_rewards(state, rewards) do
    # Rewards from DB use string keys
    xp = Map.get(rewards, "xp") || Map.get(rewards, :xp, 0)
    gold = Map.get(rewards, "gold") || Map.get(rewards, :gold, 0)
    items = Map.get(rewards, "items") || Map.get(rewards, :items, [])

    with {:ok, state} <- apply_xp_reward(state, xp),
         {:ok, state} <- apply_gold_reward(state, gold),
         {:ok, state} <- apply_item_rewards(state, items) do
      {:ok, state}
    end
  end

  defp apply_xp_reward(state, 0), do: {:ok, state}

  defp apply_xp_reward(state, xp) do
    # Stats from DB use string keys
    current_xp = Map.get(state.stats, "xp") || Map.get(state.stats, :xp, 0)
    new_xp = current_xp + xp
    new_stats = Map.put(state.stats, "xp", new_xp)
    GameState.update_state(state, %{stats: new_stats})
  end

  defp apply_gold_reward(state, 0), do: {:ok, state}

  defp apply_gold_reward(state, gold) do
    # Flags from DB use string keys
    current_gold = Map.get(state.flags, "gold") || Map.get(state.flags, :gold, 0)
    new_gold = current_gold + gold
    new_flags = Map.put(state.flags, "gold", new_gold)
    GameState.update_state(state, %{flags: new_flags})
  end

  defp apply_item_rewards(state, []), do: {:ok, state}

  defp apply_item_rewards(state, items) do
    new_inventory = state.inventory ++ items
    GameState.update_state(state, %{inventory: new_inventory})
  end
end
