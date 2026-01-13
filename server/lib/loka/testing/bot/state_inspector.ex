defmodule Loka.Testing.Bot.StateInspector do
  @moduledoc """
  Provides direct access to internal server state for debugging and assertions.

  While ChannelBot executes actions through channels (testing the real code path),
  StateInspector allows reading internal state for:
  - Rich assertions (verify exact server state, not just client-visible data)
  - Debugging (when tests fail, see full internal state)
  - State drift detection (compare client view vs server truth)

  ## Usage

      # Get full game state
      game_state = StateInspector.inspect_game_state(player_id)

      # Assert quest completed
      assert StateInspector.quest_completed?(player_id, "first_quest")

      # Get detailed quest progress
      progress = StateInspector.inspect_quest_progress(player_id, "main_quest")

      # Verify client matches server
      :ok = StateInspector.assert_client_matches_server(bot_state, player_id)

  ## Why This Exists

  Channel events only show what the server chooses to serialize to clients.
  Internal state may contain:
  - Hidden quest flags
  - Exact numeric values (vs "low"/"high" labels)
  - Internal timers and cooldowns
  - Debug information

  When a test fails, having access to internal state makes debugging much faster.
  """

  alias Loka.Framework.Player.GameState
  alias Loka.Engine.{Entities, EntityRegistry}
  alias Loka.Framework.World.RoomLoader

  # =============================================================================
  # State Inspection
  # =============================================================================

  @doc """
  Gets the full GameState for a player.

  Returns the actual server-side GameState struct.
  """
  def inspect_game_state(player_id) do
    case GameState.get_state(player_id) do
      %GameState{} = state -> {:ok, state}
      nil -> {:error, :not_found}
    end
  rescue
    # Handle invalid player_id types (e.g., string instead of integer)
    Ecto.Query.CastError -> {:error, :invalid_id}
  end

  @doc """
  Gets an entity by ID.

  Returns the full entity including all components.
  """
  def inspect_entity(entity_id) do
    case Entities.get_entity(entity_id) do
      nil -> {:error, :not_found}
      entity -> {:ok, entity}
    end
  end

  @doc """
  Inspects a room and its contents.

  Returns the room entity with all entities, items, and exits.
  """
  def inspect_room(room_id) do
    case RoomLoader.load_room_for_display(room_id) do
      {:ok, room} -> {:ok, room}
      error -> error
    end
  end

  @doc """
  Gets a player's inventory items with full details.

  Returns list of item entities (not just IDs).
  """
  def inspect_inventory(player_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        item_ids = game_state.inventory || []

        items =
          Enum.map(item_ids, fn item_id ->
            case inspect_entity(item_id) do
              {:ok, entity} -> entity
              _ -> %{id: item_id, error: :not_found}
            end
          end)

        {:ok, items}

      error ->
        error
    end
  end

  @doc """
  Gets detailed quest progress for a specific quest.

  Returns the full quest state including:
  - Current objective
  - Progress on each objective
  - Any quest-specific flags
  """
  def inspect_quest_progress(player_id, quest_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        quests = game_state.quests || %{}

        # Check active quests
        active = Map.get(quests, :active, []) ++ Map.get(quests, "active", [])
        completed = Map.get(quests, :completed, []) ++ Map.get(quests, "completed", [])

        # Get detailed progress if available
        progress = Map.get(quests, quest_id) || Map.get(quests, "progress", %{})[quest_id]

        {:ok,
         %{
           quest_id: quest_id,
           status: quest_status(quest_id, active, completed),
           progress: progress,
           raw_quests: quests
         }}

      error ->
        error
    end
  end

  defp quest_status(quest_id, active, completed) do
    cond do
      quest_id in completed -> :completed
      quest_id in active -> :active
      true -> :not_started
    end
  end

  @doc """
  Gets all entity IDs in a room from the EntityRegistry.

  Useful for checking if entities spawned correctly.
  """
  def inspect_room_entities(room_id) do
    case EntityRegistry.get_room_occupants(room_id) do
      entities when is_list(entities) -> {:ok, entities}
      _ -> {:ok, []}
    end
  end

  # =============================================================================
  # Assertion Helpers
  # =============================================================================

  @doc """
  Asserts that a quest is completed.

  Raises on failure with detailed error message.
  """
  def assert_quest_completed(player_id, quest_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        completed = get_completed_quests(game_state)

        if quest_id in completed do
          :ok
        else
          active = get_active_quests(game_state)

          raise """
          Quest not completed!
          Quest ID: #{quest_id}
          Status: #{if quest_id in active, do: "active", else: "not started"}

          Completed quests: #{inspect(completed)}
          Active quests: #{inspect(active)}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that a quest is active.
  """
  def assert_quest_active(player_id, quest_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        active = get_active_quests(game_state)

        if quest_id in active do
          :ok
        else
          completed = get_completed_quests(game_state)

          raise """
          Quest not active!
          Quest ID: #{quest_id}
          Status: #{if quest_id in completed, do: "completed", else: "not started"}

          Active quests: #{inspect(active)}
          Completed quests: #{inspect(completed)}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that a player has an item (by item key pattern).
  """
  def assert_has_item(player_id, item_key) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        inventory = game_state.inventory || []
        has_item = Enum.any?(inventory, &String.contains?(&1, item_key))

        if has_item do
          :ok
        else
          raise """
          Item not found in inventory!
          Looking for: #{item_key}

          Inventory: #{inspect(inventory)}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that a player is in a specific room.
  """
  def assert_in_room(player_id, expected_room_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        actual_room = game_state.current_room_id

        if actual_room == expected_room_id do
          :ok
        else
          raise """
          Player not in expected room!
          Expected: #{expected_room_id}
          Actual: #{actual_room}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that health is above a threshold (percentage).
  """
  def assert_health_above(player_id, threshold_percent) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        health = game_state.health || %{current: 100, max: 100}
        current = health.current || health["current"] || 100
        max = health.max || health["max"] || 100

        percent = if max > 0, do: current / max * 100, else: 100

        if percent >= threshold_percent do
          :ok
        else
          raise """
          Health below threshold!
          Expected: >= #{threshold_percent}%
          Actual: #{Float.round(percent, 1)}% (#{current}/#{max})
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that a flag is set on the player.
  """
  def assert_flag_set(player_id, flag_name) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        flags = game_state.flags || %{}
        flag_value = Map.get(flags, flag_name) || Map.get(flags, to_string(flag_name))

        if flag_value do
          :ok
        else
          raise """
          Flag not set!
          Flag: #{flag_name}

          Current flags: #{inspect(flags)}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that a flag is NOT set on the player.
  """
  def assert_flag_not_set(player_id, flag_name) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        flags = game_state.flags || %{}
        flag_value = Map.get(flags, flag_name) || Map.get(flags, to_string(flag_name))

        if is_nil(flag_value) or flag_value == false do
          :ok
        else
          raise """
          Flag unexpectedly set!
          Flag: #{flag_name}
          Value: #{inspect(flag_value)}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Asserts that a stat meets a minimum value.
  """
  def assert_stat_at_least(player_id, stat_name, min_value) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        stats = game_state.stats || %{}
        stat_value = Map.get(stats, stat_name) || Map.get(stats, to_string(stat_name)) || 0

        if stat_value >= min_value do
          :ok
        else
          raise """
          Stat below minimum!
          Stat: #{stat_name}
          Expected: >= #{min_value}
          Actual: #{stat_value}

          All stats: #{inspect(stats)}
          """
        end

      {:error, reason} ->
        raise "Failed to get game state: #{inspect(reason)}"
    end
  end

  @doc """
  Compares bot's client state with server state.

  Returns `:ok` if they match, or `{:drift, differences}` with details.
  Useful for catching serialization bugs.
  """
  def check_state_drift(bot_state, player_id) do
    case inspect_game_state(player_id) do
      {:ok, server_state} ->
        differences = []

        # Compare room
        differences =
          if bot_room_id(bot_state) != server_state.current_room_id do
            [{:room, bot_room_id(bot_state), server_state.current_room_id} | differences]
          else
            differences
          end

        # Compare inventory count
        bot_inv_count = length(bot_state.inventory || [])
        server_inv_count = length(server_state.inventory || [])

        differences =
          if bot_inv_count != server_inv_count do
            [{:inventory_count, bot_inv_count, server_inv_count} | differences]
          else
            differences
          end

        # Compare health
        bot_health = bot_state.health || %{}
        server_health = server_state.health || %{}
        bot_current = bot_health["current"] || bot_health[:current]
        server_current = server_health.current || server_health["current"]

        differences =
          if bot_current != server_current do
            [{:health_current, bot_current, server_current} | differences]
          else
            differences
          end

        if Enum.empty?(differences) do
          :ok
        else
          {:drift, differences}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Asserts that client state matches server state.

  Raises with detailed drift information on mismatch.
  """
  def assert_client_matches_server(bot_state, player_id) do
    case check_state_drift(bot_state, player_id) do
      :ok ->
        :ok

      {:drift, differences} ->
        drift_details =
          Enum.map_join(differences, "\n", fn {field, bot_val, server_val} ->
            "  #{field}: bot=#{inspect(bot_val)}, server=#{inspect(server_val)}"
          end)

        raise """
        Client state drift detected!

        Differences:
        #{drift_details}
        """

      {:error, reason} ->
        raise "Failed to check state drift: #{inspect(reason)}"
    end
  end

  # =============================================================================
  # Query Helpers
  # =============================================================================

  @doc """
  Checks if a quest is completed (non-raising version).
  """
  def quest_completed?(player_id, quest_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} -> quest_id in get_completed_quests(game_state)
      _ -> false
    end
  end

  @doc """
  Checks if a quest is active (non-raising version).
  """
  def quest_active?(player_id, quest_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} -> quest_id in get_active_quests(game_state)
      _ -> false
    end
  end

  @doc """
  Checks if player has an item (non-raising version).
  """
  def has_item?(player_id, item_key) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        inventory = game_state.inventory || []
        Enum.any?(inventory, &String.contains?(&1, item_key))

      _ ->
        false
    end
  end

  @doc """
  Gets player's current room ID.
  """
  def current_room(player_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} -> game_state.current_room_id
      _ -> nil
    end
  end

  @doc """
  Gets player's current health percentage.
  """
  def health_percent(player_id) do
    case inspect_game_state(player_id) do
      {:ok, game_state} ->
        health = game_state.health || %{current: 100, max: 100}
        current = Map.get(health, :current) || Map.get(health, "current") || 100
        max = Map.get(health, :max) || Map.get(health, "max") || 100
        if max > 0, do: current / max * 100, else: 100

      _ ->
        100
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_completed_quests(game_state) do
    quests = game_state.quests || %{}

    (Map.get(quests, :completed, []) ++ Map.get(quests, "completed", []))
    |> List.flatten()
    |> Enum.uniq()
  end

  defp get_active_quests(game_state) do
    quests = game_state.quests || %{}

    (Map.get(quests, :active, []) ++ Map.get(quests, "active", []))
    |> List.flatten()
    |> Enum.uniq()
  end

  defp bot_room_id(bot_state) do
    room = bot_state.room

    cond do
      is_nil(room) -> nil
      is_map(room) -> room["id"] || room[:id]
      true -> nil
    end
  end
end
