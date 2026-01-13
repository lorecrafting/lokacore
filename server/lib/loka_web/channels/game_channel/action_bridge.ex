defmodule LokaWeb.Channels.GameChannel.ActionBridge do
  @moduledoc """
  Bridges Loka.Game.Actions with GameChannel transport.

  This module handles:
  - Building Context from socket
  - Applying Result state changes to socket
  - Dispatching Result events to clients and PubSub

  ## Usage

      case ActionBridge.execute(socket, :navigate, %{direction: "north"}) do
        {:ok, socket} -> {:reply, :ok, socket}
        {:error, reason, socket} -> {:reply, :ok, socket}
      end
  """

  alias Phoenix.Socket
  alias Loka.Game.Actions
  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Channel.Validator
  alias Loka.Session
  alias LokaWeb.Channels.GameChannel.Serializers
  alias LokaWeb.Channels.RoomHelpers

  # Enable validation in dev/test, optional in prod for performance
  @validate_events Mix.env() in [:dev, :test]

  @doc """
  Execute a game action and handle the result.

  Returns `{:ok, socket}` or `{:error, reason, socket}`.
  """
  @spec execute(Socket.t(), atom(), map()) :: {:ok, Socket.t()} | {:error, String.t(), Socket.t()}
  def execute(socket, action, params) do
    ctx = build_context(socket)

    case Actions.execute(action, params, ctx) do
      {:ok, result} ->
        socket = apply_result(socket, result)
        {:ok, socket}

      {:error, reason} ->
        validated_push(socket, "event", %{text: reason})
        {:error, reason, socket}
    end
  end

  @doc """
  Build an Actions.Context from a socket.
  """
  @spec build_context(Socket.t()) :: Context.t()
  def build_context(socket) do
    player = socket.assigns.player
    game_state = socket.assigns.game_state

    %Context{
      player_id: player.id,
      player_name: player_display_name(player, game_state),
      game_state: game_state,
      room: socket.assigns.room,
      combat: socket.assigns[:combat],
      dialogue: socket.assigns[:dialogue_state],
      container: socket.assigns[:open_container],
      bardo: socket.assigns[:bardo]
    }
  end

  @doc """
  Apply a Result to the socket.

  Updates socket assigns with state changes and dispatches all events.
  """
  @spec apply_result(Socket.t(), Result.t()) :: Socket.t()
  def apply_result(socket, result) do
    socket
    |> apply_state_changes(result.state)
    |> dispatch_events(result.events)
  end

  # =============================================================================
  # State Changes
  # =============================================================================

  defp apply_state_changes(socket, state) do
    require Logger

    Logger.info(
      "[ACTION_BRIDGE] apply_state_changes: keys=#{inspect(Map.keys(state))}, has_game_state?=#{Map.has_key?(state, :game_state)}"
    )

    socket
    |> maybe_assign(:game_state, state[:game_state])
    |> maybe_assign(:room, state[:room])
    |> maybe_assign(:combat, state[:combat])
    |> maybe_assign(:dialogue_state, state[:dialogue])
    |> maybe_assign(:open_container, state[:container])
    |> maybe_assign_bardo(state[:bardo])
    |> maybe_handle_room_change(state[:room], socket.assigns[:room])
  end

  # Bardo needs special handling - nil means clear the bardo state
  defp maybe_assign_bardo(socket, nil) when is_map_key(socket.assigns, :bardo) do
    Phoenix.Socket.assign(socket, :bardo, nil)
  end

  defp maybe_assign_bardo(socket, nil), do: socket
  defp maybe_assign_bardo(socket, bardo), do: Phoenix.Socket.assign(socket, :bardo, bardo)

  defp maybe_assign(socket, _key, nil), do: socket

  defp maybe_assign(socket, :game_state, value) do
    # Only update the socket assigns - quest events are dispatched via dispatch_event
    # Do NOT broadcast game_state here as it would overwrite the full client state
    Phoenix.Socket.assign(socket, :game_state, value)
  end

  defp maybe_assign(socket, key, value), do: Phoenix.Socket.assign(socket, key, value)

  defp maybe_handle_room_change(socket, nil, _old_room), do: socket

  defp maybe_handle_room_change(socket, new_room, old_room) when new_room.id == old_room.id,
    do: socket

  defp maybe_handle_room_change(socket, new_room, old_room) do
    player_id = socket.assigns.player.id

    # Unsubscribe from old room, subscribe to new
    if old_room do
      Phoenix.PubSub.unsubscribe(Loka.PubSub, "room:#{old_room.id}")
    end

    Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{new_room.id}")

    # Update session
    Session.update_room(player_id, new_room.id)

    # Clear seen ambient messages for the new room (fresh visit)
    Phoenix.Socket.assign(socket, :seen_ambient, MapSet.new())
  end

  # =============================================================================
  # Event Dispatching
  # =============================================================================

  defp dispatch_events(socket, events) do
    Enum.reduce(events, socket, &dispatch_event/2)
  end

  # Text event
  defp dispatch_event({:event, text}, socket) do
    validated_push(socket, "event", %{text: text})
    socket
  end

  # Room changed (navigation)
  defp dispatch_event({:room_changed, data}, socket) do
    player_id = socket.assigns.player.id
    game_state = socket.assigns.game_state
    other_players = RoomHelpers.load_other_players(data.room.id, player_id)
    visual_state = Serializers.serialize_visual_state(room: data.room, player: game_state)
    sound_state = Serializers.serialize_sound_state(room: data.room, player: game_state)

    validated_push(socket, "room_update", %{
      room: data.room,
      atmosphere: data.atmosphere,
      visual_state: visual_state,
      sound_state: sound_state,
      other_players: Serializers.serialize_players(other_players)
    })

    socket
  end

  # Room update (entities changed in current room)
  defp dispatch_event({:room_update, data}, socket) do
    player_id = socket.assigns.player.id
    game_state = socket.assigns.game_state
    other_players = RoomHelpers.load_other_players(data.room.id, player_id)
    visual_state = Serializers.serialize_visual_state(room: data.room, player: game_state)
    sound_state = Serializers.serialize_sound_state(room: data.room, player: game_state)

    validated_push(socket, "room_update", %{
      room: data.room,
      atmosphere: data.atmosphere,
      visual_state: visual_state,
      sound_state: sound_state,
      other_players: Serializers.serialize_players(other_players)
    })

    socket
  end

  # Inventory update
  defp dispatch_event({:inventory_update, data}, socket) do
    validated_push(socket, "inventory_update", data)
    socket
  end

  # Equipment update
  defp dispatch_event({:equipment_update, data}, socket) do
    validated_push(socket, "equipment_update", data)
    socket
  end

  # Stats update
  defp dispatch_event({:stats_update, data}, socket) do
    validated_push(socket, "stats_update", data)
    socket
  end

  # Entity context (click response)
  defp dispatch_event({:entity_context, data}, socket) do
    validated_push(socket, "entity_context", %{entity: data})
    socket
  end

  # Game initialized
  defp dispatch_event({:game_initialized, data}, socket) do
    validated_push(socket, "game_state", data)
    socket
  end

  # Combat events
  defp dispatch_event({:combat_start, data}, socket) do
    validated_push(socket, "combat_start", data)
    socket
  end

  defp dispatch_event({:combat_update, data}, socket) do
    validated_push(socket, "combat_update", data)
    socket
  end

  defp dispatch_event({:combat_end, data}, socket) do
    validated_push(socket, "combat_end", data)
    socket
  end

  # Dialogue events
  defp dispatch_event({:dialogue_start, data}, socket) do
    validated_push(socket, "dialogue_start", data)
    socket
  end

  defp dispatch_event({:dialogue_update, data}, socket) do
    validated_push(socket, "dialogue_update", data)
    socket
  end

  defp dispatch_event({:dialogue_end, data}, socket) do
    validated_push(socket, "dialogue_end", data)
    socket
  end

  # Shop events
  defp dispatch_event({:shop_open, data}, socket) do
    validated_push(socket, "shop_open", data)
    socket
  end

  defp dispatch_event({:shop_close, data}, socket) do
    validated_push(socket, "shop_close", data)
    socket
  end

  # Container events
  defp dispatch_event({:container_open, data}, socket) do
    validated_push(socket, "container_open", data)
    socket
  end

  defp dispatch_event({:container_update, data}, socket) do
    validated_push(socket, "container_update", data)
    socket
  end

  defp dispatch_event({:container_close, data}, socket) do
    validated_push(socket, "container_close", data)
    socket
  end

  # Quest events
  defp dispatch_event({:quest_accepted, data}, socket) do
    validated_push(socket, "quest_accepted", data)
    socket
  end

  defp dispatch_event({:quest_completed, data}, socket) do
    validated_push(socket, "quest_completed", data)
    socket
  end

  defp dispatch_event({:quest_progress, data}, socket) do
    validated_push(socket, "quest_progress", data)
    socket
  end

  # Bardo (death) events
  defp dispatch_event({:enter_bardo, killer_name}, socket) when is_binary(killer_name) do
    # Legacy: Dispatch to channel to handle bardo sequence
    send(self(), {:enter_bardo, killer_name})
    socket
  end

  defp dispatch_event({:bardo_enter, data}, socket) do
    validated_push(socket, "bardo_enter", data)
    socket
  end

  defp dispatch_event({:bardo_exit, data}, socket) do
    validated_push(socket, "bardo_exit", data)
    socket
  end

  defp dispatch_event({:bardo_subscribe_room, room_id}, socket) do
    Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room_id}")
    socket
  end

  defp dispatch_event({:bardo_unsubscribe_room, room_id}, socket) do
    Phoenix.PubSub.unsubscribe(Loka.PubSub, "room:#{room_id}")
    socket
  end

  # Resources update
  defp dispatch_event({:resources_update, data}, socket) do
    validated_push(socket, "resources_update", data)
    socket
  end

  # PubSub broadcasts
  defp dispatch_event({:broadcast_room, room_id, message}, socket) do
    Phoenix.PubSub.broadcast(Loka.PubSub, "room:#{room_id}", message)
    socket
  end

  defp dispatch_event({:broadcast_player, player_id, message}, socket) do
    Phoenix.PubSub.broadcast(Loka.PubSub, "player:#{player_id}", message)
    socket
  end

  # Timer events
  defp dispatch_event({:schedule_timer, name, ms}, socket) do
    Process.send_after(self(), name, ms)
    socket
  end

  defp dispatch_event({:cancel_timer, _name}, socket) do
    # Timer cancellation would need to track timer refs
    # For now, the timer will fire but be a no-op if combat is nil
    socket
  end

  # Fallback for unknown events
  defp dispatch_event(event, socket) do
    require Logger
    Logger.warning("ActionBridge: Unknown event #{inspect(event)}")
    socket
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp player_display_name(player, game_state) do
    game_state.character_name || player.name || player.email
  end

  # Validated push - validates payload before sending in dev/test
  defp validated_push(socket, event_name, payload) do
    if @validate_events do
      context = %{player_id: socket.assigns[:player] && socket.assigns.player.id}

      case Validator.validate_and_log(:server, event_name, payload, context) do
        :ok ->
          validated_push(socket, event_name, payload)

        {:error, reason} ->
          require Logger

          Logger.error(
            "[ActionBridge] Validation failed for #{event_name}: #{reason}",
            payload: inspect(payload, limit: 500)
          )

          # In dev, raise to catch issues early
          if Mix.env() == :dev do
            raise "Channel event validation failed: #{event_name} - #{reason}"
          end

          # In test, still push but log the error
          validated_push(socket, event_name, payload)
      end
    else
      # In prod, skip validation for performance
      validated_push(socket, event_name, payload)
    end
  end
end
