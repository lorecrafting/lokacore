defmodule Loka.Framework.Quest.QuestItemSpawner do
  @moduledoc """
  Spawns player-instanced quest items.

  When a quest with `get_item` objectives is accepted and the objective has
  `quest_spawn: true`, this module spawns a player-specific instance of the
  item with a pickup lock.

  ## How It Works

  1. Quest with `get_item` objective is accepted
  2. If objective has `quest_spawn: true`, spawn the item
  3. Item gets lock: `%{"get" => "id(player_id)"}` - only that player can pick it up
  4. Item is tagged with `quest_item` component for tracking

  ## YAML Format

      objectives:
        - id: find_journal
          type: get_item
          target_id: meditation_journal
          quest_spawn: true              # Enables player-instanced spawning
          spawn_location: tenzins_cell   # Room key where item spawns
          description: "Find the meditation journal"

  ## Usage

      # Called automatically by Quest.Progress on quest accept
      QuestItemSpawner.spawn_quest_items(quest_def, player_id)

  ## Lock System

  Uses string-based locks. The lock `id(player_id)` means only that specific
  player can perform the locked action (in this case, "get" the item).
  """

  require Logger

  alias Loka.Engine.{Spawner, Entities}
  alias Loka.Framework.Quest.Handlers.ObjectiveHelper

  @doc """
  Spawns all quest items for objectives that have `quest_spawn: true`.

  Called when a quest is accepted. Scans objectives for get_item types
  with quest_spawn enabled and spawns player-locked instances.

  Returns `{:ok, spawned_items}` or `{:error, reason}`.
  """
  def spawn_quest_items(quest_def, player_id) when is_binary(player_id) do
    spawnable_objectives =
      quest_def.objectives
      |> Enum.filter(&should_spawn?/1)

    if Enum.empty?(spawnable_objectives) do
      {:ok, []}
    else
      results =
        Enum.map(spawnable_objectives, fn objective ->
          spawn_for_objective(objective, player_id, quest_def.id)
        end)

      # Separate successes from failures
      {successes, failures} =
        Enum.split_with(results, fn
          {:ok, _} -> true
          {:error, _} -> false
        end)

      spawned_items = Enum.map(successes, fn {:ok, entity} -> entity end)

      if Enum.any?(failures) do
        Logger.warning(
          "QuestItemSpawner: Some items failed to spawn for quest #{quest_def.id}: #{inspect(failures)}"
        )
      end

      Logger.info(
        "QuestItemSpawner: Spawned #{length(spawned_items)} quest items for player #{player_id}"
      )

      {:ok, spawned_items}
    end
  end

  def spawn_quest_items(_quest_def, _player_id), do: {:ok, []}

  @doc """
  Spawns a single player-locked quest item.

  Creates an item at the specified location with a lock that only
  allows the specified player to pick it up.

  ## Options

  - `:location_id` - Room ID where item spawns (required if room_key not in objective)
  - `:quest_id` - Quest this item belongs to (for tracking)

  ## Returns

  - `{:ok, entity}` on success
  - `{:error, reason}` on failure
  """
  def spawn_for_player(item_key, player_id, room_id, quest_id) when is_binary(item_key) do
    Spawner.spawn(item_key,
      location_id: room_id,
      locks: %{"get" => "id(#{player_id})"},
      components: %{
        "quest_item" => %{
          "owner_id" => player_id,
          "quest_id" => quest_id
        }
      },
      tags: ["quest_item", "player_instance"]
    )
  end

  @doc """
  Cleans up quest items for a player when they abandon or complete a quest.

  Removes any player-instanced quest items that are still in the world.
  """
  def cleanup_quest_items(player_id, quest_id) do
    # Find all quest items owned by this player for this quest
    # This is a future enhancement - for now items naturally despawn

    Logger.debug("QuestItemSpawner: Cleanup requested for player #{player_id}, quest #{quest_id}")

    :ok
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp should_spawn?(objective) do
    obj_type = ObjectiveHelper.get_type(objective)
    quest_spawn = ObjectiveHelper.get_field(objective, :quest_spawn)

    obj_type == :get_item && quest_spawn == true
  end

  defp spawn_for_objective(objective, player_id, quest_id) do
    item_key = ObjectiveHelper.get_target_id(objective)
    spawn_location = ObjectiveHelper.get_field(objective, :spawn_location)

    if is_nil(item_key) do
      {:error, {:missing_target_id, objective}}
    else
      room_id = resolve_room_id(spawn_location)

      if is_nil(room_id) do
        {:error, {:spawn_location_not_found, spawn_location}}
      else
        spawn_for_player(item_key, player_id, room_id, quest_id)
      end
    end
  end

  defp resolve_room_id(nil), do: nil

  defp resolve_room_id(room_key) when is_binary(room_key) do
    case Entities.get_entity_by_key(room_key) do
      nil -> nil
      room -> room.id
    end
  end

  defp resolve_room_id(_), do: nil
end
