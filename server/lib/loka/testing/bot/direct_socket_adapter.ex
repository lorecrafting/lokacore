defmodule Loka.Testing.Bot.DirectSocketAdapter do
  @moduledoc """
  **DEPRECATED**: Use `Loka.Testing.Bot.ChannelBot` instead for integration tests.

  This adapter bypasses the channel layer and calls Actions directly, providing only
  60% production parity. It doesn't test serialization, channel events, or the full
  WebSocket stack that real clients use.

  ## When NOT to Use This

  - ❌ Storyline/integration tests → Use ChannelBot
  - ❌ Testing channel behavior → Use ChannelBot
  - ❌ Testing what clients receive → Use ChannelBot

  ## Migration

  ```elixir
  # OLD (this adapter - 60% production parity)
  {:ok, adapter} = DirectSocketAdapter.start_link(player: player)
  DirectSocketAdapter.push(adapter, "navigate", %{direction: "north"})

  # NEW (ChannelBot - 95% production parity)
  use Loka.ChannelCase
  {:ok, bot} = ChannelBot.start_link(socket: socket, strategy: MyStrategy)
  ```

  ---

  Direct adapter for bot testing that uses Loka.Game.Actions directly.

  This adapter allows bots to execute actions in dev/prod environments without
  requiring Phoenix.ChannelTest (which only works in ExUnit tests) or real
  WebSocket connections.

  ## Architecture

  Instead of going through Phoenix channels, this adapter:
  1. Uses Loka.Game.Actions directly for action execution
  2. Collects events in a list instead of pushing via Phoenix.Channel
  3. Returns events to the bot for processing

  This tests the core game logic (Actions layer) which is what matters most.

  ## Usage

      {:ok, adapter} = DirectSocketAdapter.start_link(player)
      {:ok, game_state} = DirectSocketAdapter.join(adapter)
      :ok = DirectSocketAdapter.push(adapter, "navigate", %{"direction" => "north"})
      events = DirectSocketAdapter.receive_events(adapter)
  """

  use GenServer
  require Logger

  alias Loka.Game.Actions
  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Engine.{Entity, Entities}
  alias Loka.Framework.World.RoomLoader

  defstruct [
    :player,
    :game_state,
    :character,
    :room,
    :combat,
    :dialogue,
    :container,
    :events
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(player, _endpoint \\ nil) do
    GenServer.start_link(__MODULE__, player)
  end

  @doc """
  Joins the game. Returns {:ok, initial_state} on success.
  """
  def join(adapter, _topic \\ "game:lobby", _payload \\ %{}) do
    GenServer.call(adapter, :join, 10_000)
  end

  @doc """
  Pushes a message/action to the game.
  """
  def push(adapter, event, payload) do
    GenServer.call(adapter, {:push, event, payload}, 5_000)
  end

  @doc """
  Receives any pending events (clears the event buffer).
  """
  def receive_events(adapter) do
    GenServer.call(adapter, :receive_events)
  end

  @doc """
  Gets the current game state.
  """
  def get_state(adapter) do
    GenServer.call(adapter, :get_state)
  end

  @doc """
  Stops the adapter.
  """
  def stop(adapter) do
    GenServer.stop(adapter, :normal)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(player) do
    state = %__MODULE__{
      player: player,
      events: []
    }

    {:ok, state}
  end

  @impl true
  def handle_call(:join, _from, state) do
    case initialize_game(state.player) do
      {:ok, game_state, character, room} ->
        new_state = %{
          state
          | game_state: game_state,
            character: character,
            room: room
        }

        # Build initial state reply
        reply = build_initial_state(new_state)
        {:reply, {:ok, reply}, new_state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_call({:push, event, payload}, _from, state) do
    case execute_action(event, payload, state) do
      {:ok, new_state, events} ->
        # Add events to buffer
        new_state = %{new_state | events: events ++ new_state.events}
        {:reply, :ok, new_state}

      {:error, reason} ->
        # Add error event
        error_event = %{type: :push, event: "event", payload: %{text: reason}}
        new_state = %{state | events: [error_event | state.events]}
        {:reply, {:error, reason}, new_state}
    end
  end

  @impl true
  def handle_call(:receive_events, _from, state) do
    events =
      state.events
      |> Enum.reverse()
      |> Enum.map(fn
        %{type: _} = e -> e
        {type, data} -> %{type: :push, event: to_string(type), payload: data}
        other -> %{type: :push, event: "unknown", payload: %{data: other}}
      end)

    {:reply, events, %{state | events: []}}
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def terminate(_reason, _state) do
    :ok
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp initialize_game(player) do
    # Find or create character entity (player state lives in entity components)
    character = find_or_create_character_entity(player)

    # Grant system quests using the character entity
    character = grant_system_quests_if_first_time(character)

    # Get starting room from character's location or default
    room_id = character.location_id || RoomLoader.get_starting_room_id()

    # Build a game_state-compatible map from entity components
    components = character.components || %{}

    game_state = %{
      id: character.id,
      player_id: player.id,
      inventory: Map.get(components, "inventory", %{}) |> Map.get("items", []),
      equipment: Map.get(components, "equipment", %{}),
      quests: Map.get(components, "quest_progress", %{}),
      flags: Map.get(components, "flags", %{}),
      stats: Map.get(components, "stats", %{}),
      health: Map.get(components, "resources", %{"current" => 100, "max" => 100}),
      current_room_id: room_id
    }

    # Load the current room
    case RoomLoader.load_room_for_display(room_id) do
      {:ok, room} -> {:ok, game_state, character, room}
      error -> error
    end
  end

  defp find_or_create_character_entity(player) do
    case Entities.find_one(account_id: player.id) do
      {:ok, entity} ->
        entity

      {:error, :not_found} ->
        name = player.name || "Bot#{player.id}"

        character_name =
          name
          |> String.replace(~r/[^A-Za-z]/, "")
          |> String.slice(0, 20)
          |> case do
            "" -> "Traveler"
            sanitized -> sanitized
          end

        {:ok, schema} =
          Entities.create_entity(%{
            type: "character",
            key: "player_#{player.id}",
            short_desc: character_name,
            account_id: player.id,
            location_id: RoomLoader.get_starting_room_id(),
            components: %{
              "quest_progress" => %{},
              "stats" => %{},
              "resources" => %{"current" => 100, "max" => 100}
            }
          })

        Entities.to_entity(schema)
    end
  end

  # Grant system quests if this is the bot's first time (no quests yet)
  # This replicates what the Quest.Listeners.grant_system_quests_once hook does for real players
  defp grant_system_quests_if_first_time(%Entity{} = character) do
    alias Loka.Framework.Quest.Progress

    active_quests = Progress.get_active_quests(character)
    completed_quests = Progress.get_completed_quests(character)

    if Enum.empty?(active_quests) and Enum.empty?(completed_quests) do
      # Get all system quests
      system_quests =
        Loka.Content.Quest.all_definitions()
        |> Enum.filter(fn quest ->
          quest.giver == "system" or quest.giver == :system
        end)

      if Enum.any?(system_quests) do
        Logger.info("[Bot] Granting #{length(system_quests)} system quests",
          account_id: character.account_id
        )

        # Grant each system quest
        Enum.reduce(system_quests, character, fn quest, entity ->
          case Progress.accept_quest(entity, quest.id) do
            {:ok, updated_entity} ->
              Logger.debug("[Bot] Granted system quest #{quest.id}",
                account_id: entity.account_id,
                quest_id: quest.id
              )

              updated_entity

            {:error, reason} ->
              Logger.error(
                "[Bot] Failed to grant system quest #{quest.id}: #{inspect(reason)}",
                account_id: entity.account_id,
                quest_id: quest.id,
                reason: reason
              )

              entity
          end
        end)
      else
        character
      end
    else
      character
    end
  end

  defp build_initial_state(state) do
    # Hardening: Validate that bot has system quests (fail-fast on initialization issues)
    validate_system_quests_granted(state.character)

    # Read quest data from character entity (V2 stores quests in components)
    quest_progress = Entity.get_component(state.character, "quest_progress") || %{}

    gs = state.game_state

    %{
      room: state.room,
      inventory: gs[:inventory] || [],
      equipped: gs[:equipment] || %{},
      stats: gs[:stats] || %{},
      health: gs[:health] || %{current: 100, max: 100},
      quests: quest_progress,
      game_state: gs
    }
  end

  # Hardening: Validate that system quests were granted successfully
  # Logs a warning if system quests exist but weren't granted to the bot
  defp validate_system_quests_granted(%Entity{} = character) do
    alias Loka.Framework.Quest.Progress

    system_quests =
      Loka.Content.Quest.all_definitions()
      |> Enum.filter(fn quest ->
        quest.giver == "system" or quest.giver == :system
      end)

    if Enum.any?(system_quests) do
      active_quest_ids = Progress.get_active_quests(character) |> Enum.map(& &1.id)

      missing_quests =
        system_quests
        |> Enum.reject(fn quest -> quest.id in active_quest_ids end)

      if Enum.any?(missing_quests) do
        Logger.warning(
          "[Bot] System quest validation failed! Bot missing system quests: #{inspect(Enum.map(missing_quests, & &1.id))}",
          account_id: character.account_id,
          missing_quest_ids: Enum.map(missing_quests, & &1.id)
        )
      end
    end

    :ok
  end

  defp execute_action(event, payload, state) do
    {action, params} = translate_event(event, payload, state)

    ctx = build_context(state)

    case Actions.execute(action, params, ctx) do
      {:ok, result} ->
        {new_state, events} = apply_result(state, result)
        {:ok, new_state, events}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp translate_event("navigate", %{"direction" => direction}, _state) do
    {:navigate, %{direction: direction}}
  end

  defp translate_event("action", %{"action" => "talk", "entity_id" => entity_id}, _state) do
    {:talk, %{entity_id: entity_id}}
  end

  defp translate_event("action", %{"action" => "attack", "entity_id" => entity_id}, state) do
    entity = find_entity_in_room(state.room, entity_id)
    {:attack, %{entity_id: entity_id, entity: entity}}
  end

  defp translate_event("action", %{"action" => "get", "entity_id" => entity_id}, _state) do
    {:get_item, %{entity_id: entity_id}}
  end

  defp translate_event("dialogue_select", %{"choice_index" => choice_index}, _state) do
    {:dialogue_choice, %{choice_index: choice_index}}
  end

  defp translate_event("combat_action", %{"action" => "flee"}, _state) do
    {:flee, %{}}
  end

  defp translate_event("inventory", %{"action" => "equip", "item_id" => item_id}, _state) do
    {:equip_item, %{item_id: item_id}}
  end

  defp translate_event("inventory", %{"action" => "unequip", "slot" => slot}, _state) do
    {:unequip_item, %{slot: slot}}
  end

  defp translate_event("inventory", %{"action" => "drop", "item_id" => item_id}, _state) do
    {:drop_item, %{item_id: item_id}}
  end

  defp translate_event("use_item", %{"item_id" => item_id}, _state) do
    {:use_item, %{item_id: item_id}}
  end

  defp translate_event("gather", %{"node_type" => node_type}, _state) do
    {:gather, %{node_type: node_type}}
  end

  defp translate_event("craft", %{"recipe_key" => recipe_key, "tool_id" => tool_id}, _state) do
    {:craft, %{recipe_key: recipe_key, tool_id: tool_id}}
  end

  defp translate_event(event, payload, _state) do
    Logger.warning("DirectSocketAdapter: Unknown event #{event} with payload #{inspect(payload)}")
    {:noop, %{}}
  end

  defp build_context(state) do
    %Context{
      player_id: state.player.id,
      player_name: state.player.name || state.player.email,
      character: state.character,
      room: state.room,
      combat: state.combat,
      dialogue: state.dialogue,
      container: state.container
    }
  end

  defp apply_result(state, %Result{} = result) do
    # Apply state changes
    new_state =
      state
      |> maybe_update(:character, result.state[:character])
      |> maybe_update(:room, result.state[:room])
      |> maybe_update(:combat, result.state[:combat])
      |> maybe_update(:dialogue, result.state[:dialogue])
      |> maybe_update(:container, result.state[:container])

    # Convert events to adapter format
    events = Enum.map(result.events, &convert_event/1)

    {new_state, events}
  end

  defp maybe_update(state, _key, nil), do: state
  defp maybe_update(state, key, value), do: Map.put(state, key, value)

  defp convert_event({:event, text}) do
    %{type: :push, event: "event", payload: %{text: text}}
  end

  defp convert_event({:room_changed, data}) do
    %{type: :push, event: "room_update", payload: %{room: data.room, atmosphere: data.atmosphere}}
  end

  defp convert_event({:room_update, data}) do
    %{type: :push, event: "room_update", payload: %{room: data.room, atmosphere: data.atmosphere}}
  end

  defp convert_event({:inventory_update, data}) do
    %{type: :push, event: "inventory_update", payload: data}
  end

  defp convert_event({:equipment_update, data}) do
    %{type: :push, event: "equipment_update", payload: data}
  end

  defp convert_event({:stats_update, data}) do
    %{type: :push, event: "stats_update", payload: data}
  end

  defp convert_event({:combat_start, data}) do
    %{type: :push, event: "combat_start", payload: data}
  end

  defp convert_event({:combat_update, data}) do
    %{type: :push, event: "combat_update", payload: data}
  end

  defp convert_event({:combat_end, data}) do
    %{type: :push, event: "combat_end", payload: data}
  end

  defp convert_event({:dialogue_start, data}) do
    %{type: :push, event: "dialogue_start", payload: data}
  end

  defp convert_event({:dialogue_update, data}) do
    %{type: :push, event: "dialogue_update", payload: data}
  end

  defp convert_event({:dialogue_end, data}) do
    %{type: :push, event: "dialogue_end", payload: data}
  end

  defp convert_event({:quest_accepted, data}) do
    %{type: :push, event: "quest_accepted", payload: data}
  end

  defp convert_event({:quest_completed, data}) do
    %{type: :push, event: "quest_completed", payload: data}
  end

  defp convert_event({type, data}) when is_atom(type) do
    %{type: :push, event: to_string(type), payload: data}
  end

  defp convert_event(other) do
    %{type: :push, event: "unknown", payload: %{raw: inspect(other)}}
  end

  defp find_entity_in_room(nil, _id), do: nil

  defp find_entity_in_room(room, entity_id) when is_map(room) do
    entities = room.entities || room["entities"] || []
    Enum.find(entities, fn e -> (e.id || e["id"]) == entity_id end)
  end
end
