defmodule Loka.Framework.Quest.Listeners do
  @moduledoc """
  Hook listeners that automatically update quest progress based on game events.

  This module bridges the gap between game actions (movement, combat, inventory)
  and the quest system, providing a single source of truth for quest triggers.

  ## Supported Objective Types

  - `:go_to` - Triggered when entering a room (via :at_enter_room hook)
  - `:get_item` - Triggered when picking up an item (via :at_object_receive hook)
  - `:kill` - Triggered when defeating an enemy (via :at_death hook)
  - `:talk` - Triggered via dialogue system (handled by dialogue_manager)

  ## Hook Registration

  Call `register_all/0` at application startup to register all quest listeners:

      # In application.ex after Hooks starts
      Loka.Framework.Quest.Listeners.register_all()

  ## How It Works

  1. Game action occurs (player enters room, picks up item, defeats enemy)
  2. The relevant hook fires with context information
  3. Listener extracts the target_id (room key, item key, enemy key)
  4. Quest.Progress.update_progress is called to update matching objectives
  5. Completed objectives are returned for UI feedback

  ## Example Flow

      Player enters "temple" room
      → :at_enter_room hook fires with %{room_key: "temple"}
      → on_room_entry/2 extracts room_key
      → Quest.Progress.update_progress(state, %{type: :go_to, target_id: "temple"})
      → If "intro_find_temple" quest has objective targeting "temple", it completes
  """

  require Logger

  alias Loka.Content
  alias Loka.Engine.Hooks
  alias Loka.Framework.Quest.Progress, as: QuestProgress

  @doc """
  Registers all quest-related hook listeners.

  Call this at application startup after the Hooks GenServer has started.
  """
  def register_all do
    Logger.info("Quest.Listeners: Registering quest hooks...")

    # Room entry triggers go_to objectives
    Hooks.register(:at_enter_room, __MODULE__, :on_room_entry, priority: 50)

    # Item pickup triggers get_item objectives
    Hooks.register(:at_object_receive, __MODULE__, :on_item_received, priority: 50)

    # Entity death triggers kill objectives
    Hooks.register(:at_death, __MODULE__, :on_entity_death, priority: 50)

    # First room entry grants system quests
    Hooks.register(:at_enter_room, __MODULE__, :grant_system_quests_once, priority: 100)

    Logger.info("Quest.Listeners: All hooks registered")
    :ok
  end

  @doc """
  Called when a player enters a room. Triggers go_to quest objectives.

  This is the hook callback - it logs completions but doesn't return updated state.
  For getting updated state, use `check_room_entry/2` directly.

  ## Parameters

  - `player_context` - Map containing player info and character entity
  - `room_info` - Map with room details including `:room_key`
  """
  def on_room_entry(player_context, room_info) do
    room_key = extract_room_key(room_info)
    character = get_character(player_context)

    if room_key && character do
      case QuestProgress.update_progress(character, %{type: :go_to, target_id: room_key}) do
        {:ok, _updated_state, completed} when completed != [] ->
          log_completions(:go_to, room_key, completed)

        _ ->
          :ok
      end
    end

    :ok
  end

  @doc """
  Checks and updates quest progress for room entry.

  Call this directly when you need the updated character back.
  Returns `{updated_character, quest_events}`.

  ## Parameters

  - `character` - The player's character entity
  - `room_key` - The prototype key of the room entered

  ## Example

      {updated_character, events} = Quest.Listeners.check_room_entry(character, "temple")
  """
  def check_room_entry(character, room_key) when is_binary(room_key) do
    {:ok, updated_character, completed_objectives} =
      QuestProgress.update_progress(character, %{type: :go_to, target_id: room_key})

    events =
      Enum.map(completed_objectives, fn {_quest_id, objective_id} ->
        %{
          type: :quest,
          text: "Quest objective completed — #{format_objective_id(objective_id)}",
          timestamp: DateTime.utc_now()
        }
      end)

    {updated_character, events}
  end

  def check_room_entry(character, _room_key), do: {character, []}

  @doc """
  Checks and updates quest progress for item pickup.

  Returns `{updated_character, quest_events}`.
  """
  def check_item_received(character, item_key) when is_binary(item_key) do
    {:ok, updated_character, completed_objectives} =
      QuestProgress.update_progress(character, %{type: :get_item, target_id: item_key})

    events =
      Enum.map(completed_objectives, fn {_quest_id, objective_id} ->
        %{
          type: :quest,
          text: "Quest objective completed — #{format_objective_id(objective_id)}",
          timestamp: DateTime.utc_now()
        }
      end)

    {updated_character, events}
  end

  def check_item_received(character, _item_key), do: {character, []}

  @doc """
  Checks and updates quest progress for talking to an NPC.

  Returns `{updated_character, quest_events}`.

  ## Parameters

  - `character` - The player's character entity
  - `npc_key` - The prototype key of the NPC being talked to
  - `dialogue_topic` - The dialogue node/topic being visited
  """
  def check_talk(character, npc_key, dialogue_topic)
      when is_binary(npc_key) do
    # dialogue_topic can be nil for objectives that just require talking to the NPC
    event = %{type: :talk, target_id: npc_key}

    event =
      if is_binary(dialogue_topic) do
        Map.put(event, :dialogue_topic, dialogue_topic)
      else
        event
      end

    {:ok, updated_character, completed_objectives} =
      QuestProgress.update_progress(character, event)

    events =
      Enum.map(completed_objectives, fn {_quest_id, objective_id} ->
        %{
          type: :quest,
          text: "Quest objective completed — #{format_objective_id(objective_id)}",
          timestamp: DateTime.utc_now()
        }
      end)

    {updated_character, events}
  end

  def check_talk(character, _npc_key, _dialogue_topic), do: {character, []}

  @doc """
  Checks and updates quest progress for enemy kills.

  Returns `{updated_character, quest_events}`.
  """
  def check_entity_death(character, entity_key, count \\ 1)

  def check_entity_death(character, entity_key, count) when is_binary(entity_key) do
    {:ok, updated_character, completed_objectives} =
      QuestProgress.update_progress(character, %{
        type: :kill,
        target_id: entity_key,
        count: count
      })

    events =
      Enum.map(completed_objectives, fn {_quest_id, objective_id} ->
        %{
          type: :quest,
          text: "Quest objective completed — #{format_objective_id(objective_id)}",
          timestamp: DateTime.utc_now()
        }
      end)

    {updated_character, events}
  end

  def check_entity_death(character, _entity_key, _count), do: {character, []}

  @doc """
  Checks and updates quest progress for crafting an item.

  Returns `{updated_character, quest_events}`.

  ## Parameters

  - `character` - The player's character entity
  - `recipe_key` - The key of the recipe that was crafted
  """
  def check_craft(character, recipe_key) when is_binary(recipe_key) do
    {:ok, updated_character, completed_objectives} =
      QuestProgress.update_progress(character, %{type: :craft, target_id: recipe_key})

    events =
      Enum.map(completed_objectives, fn {_quest_id, objective_id} ->
        %{
          type: :quest,
          text: "Quest objective completed — #{format_objective_id(objective_id)}",
          timestamp: DateTime.utc_now()
        }
      end)

    {updated_character, events}
  end

  def check_craft(character, _recipe_key), do: {character, []}

  @doc """
  Called when a player receives an item. Triggers get_item quest objectives.

  ## Parameters

  - `player_context` - Map containing player info and character entity
  - `item_info` - Map with item details including `:item_key`
  """
  def on_item_received(player_context, item_info) do
    item_key = extract_item_key(item_info)

    if item_key do
      character = get_character(player_context)

      if character do
        case QuestProgress.update_progress(character, %{type: :get_item, target_id: item_key}) do
          {:ok, updated_character, completed} when completed != [] ->
            log_completions(:get_item, item_key, completed)
            {:quest_update, updated_character, completed}

          _ ->
            :ok
        end
      else
        :ok
      end
    else
      :ok
    end
  end

  @doc """
  Called when an entity dies. Triggers kill quest objectives.

  ## Parameters

  - `attacker_context` - Map containing attacker info and character entity
  - `death_info` - Map with death details including `:entity_key` and `:killed_by`
  """
  def on_entity_death(attacker_context, death_info) do
    # Only process if the attacker is a player
    entity_key = extract_entity_key(death_info)

    if entity_key do
      character = get_character(attacker_context)

      if character do
        case QuestProgress.update_progress(character, %{
               type: :kill,
               target_id: entity_key,
               count: 1
             }) do
          {:ok, updated_character, completed} when completed != [] ->
            log_completions(:kill, entity_key, completed)
            {:quest_update, updated_character, completed}

          _ ->
            :ok
        end
      else
        :ok
      end
    else
      :ok
    end
  end

  # Private helpers

  defp get_character(%{character: character}), do: character
  defp get_character(_), do: nil

  defp extract_room_key(%{room_key: key}) when is_binary(key), do: key
  defp extract_room_key(%{"room_key" => key}) when is_binary(key), do: key
  defp extract_room_key(_), do: nil

  defp extract_item_key(%{item_key: key}) when is_binary(key), do: key
  defp extract_item_key(%{"item_key" => key}) when is_binary(key), do: key
  defp extract_item_key(%{key: key}) when is_binary(key), do: key
  defp extract_item_key(_), do: nil

  defp extract_entity_key(%{entity_key: key}) when is_binary(key), do: key
  defp extract_entity_key(%{"entity_key" => key}) when is_binary(key), do: key
  defp extract_entity_key(%{key: key}) when is_binary(key), do: key
  defp extract_entity_key(_), do: nil

  defp log_completions(type, target, completed) do
    objectives_str =
      completed
      |> Enum.map(fn {quest_id, obj_id} -> "#{quest_id}/#{obj_id}" end)
      |> Enum.join(", ")

    Logger.debug(
      "Quest.Listeners: #{type} objective(s) completed for target '#{target}': #{objectives_str}"
    )
  end

  defp format_objective_id(objective_id) do
    objective_id
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  @doc """
  Grants system quests (quests with giver: "system") on first room entry.

  This hook is called when a player enters any room. On the first entry,
  it grants all system quests that should auto-activate.

  System quests are quests with `giver: "system"` in their YAML definition.
  These quests don't require talking to an NPC to activate.

  ## Parameters

  - `player_context` - Map containing player info and character entity
  - `room_info` - Map with room details (unused in this function)
  """
  def grant_system_quests_once(player_context, _room_info) do
    character = get_character(player_context)

    if character do
      # Only grant if player has no quests yet (first time)
      active_quests = QuestProgress.get_active_quests(character)
      completed_quests = QuestProgress.get_completed_quests(character)

      if Enum.empty?(active_quests) and Enum.empty?(completed_quests) do
        system_quests = get_system_quests()

        if Enum.any?(system_quests) do
          Logger.info("[Quest] Granting #{length(system_quests)} system quests to player",
            account_id: character.account_id
          )

          updated_character =
            Enum.reduce(system_quests, character, fn quest, acc ->
              case QuestProgress.accept_quest(acc, quest.id) do
                {:ok, new_character} ->
                  Logger.debug("[Quest] Granted system quest #{quest.id}",
                    account_id: acc.account_id,
                    quest_id: quest.id
                  )

                  new_character

                {:error, reason} ->
                  Logger.error(
                    "[Quest] Failed to grant system quest #{quest.id}: #{inspect(reason)}",
                    account_id: acc.account_id,
                    quest_id: quest.id,
                    reason: reason
                  )

                  acc
              end
            end)

          # Return updated state through quest_update
          {:quest_update, updated_character, []}
        else
          :ok
        end
      else
        :ok
      end
    else
      :ok
    end
  end

  # Returns all quest definitions with giver: "system".
  # These quests are auto-granted to players when they first spawn/enter a room.
  defp get_system_quests do
    Content.Quest.all_definitions()
    |> Enum.filter(fn quest ->
      quest.giver == "system" or quest.giver == :system
    end)
  end
end
