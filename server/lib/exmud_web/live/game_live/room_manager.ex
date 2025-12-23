defmodule ExmudWeb.GameLive.RoomManager do
  @moduledoc """
  Room loading and navigation handlers for GameLive.

  Handles:
  - Loading player's current room
  - Room navigation (movement between rooms)
  - Entity activation (on-demand process management)
  - Other players in room
  """

  alias Exmud.Framework.Player.GameState, as: PlayerGameState
  alias Exmud.Framework.World.RoomLoader
  alias Exmud.Engine.{EntityRegistry, EntityServer, Hooks, WorldLoader}
  alias Exmud.Accounts

  @doc """
  Loads the player's current room, falling back to starting room if needed.
  Returns {room, updated_game_state}.
  """
  def load_player_room(game_state) do
    case try_load_room(game_state.current_room_id) do
      {:ok, room} ->
        game_state = ensure_room_assigned(game_state, room.id)
        activate_room_entity(room.id)
        {room, game_state}

      {:error, :not_found} ->
        starting_room_id = RoomLoader.get_starting_room_id() || WorldLoader.get_starting_room_id()

        case try_load_room(starting_room_id) do
          {:ok, room} ->
            game_state = force_room_assignment(game_state, room.id)
            activate_room_entity(room.id)
            {room, game_state}

          {:error, :not_found} ->
            {RoomLoader.empty_room(), game_state}
        end
    end
  end

  @doc """
  Handles navigation to a new room via an exit.
  Returns {:ok, socket} or {:error, socket} with appropriate events.
  """
  def handle_navigate(socket, direction, exit) do
    room = socket.assigns.room
    game_state = socket.assigns.game_state
    player = socket.assigns.current_scope.player
    player_name = player_display_name(player)

    case exit do
      nil ->
        {:noreply, socket}

      %{destination_id: nil} ->
        event = %{
          text: "The path #{direction} seems to lead nowhere...",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{compass_open: false})
         |> update_events([event])}

      %{destination_id: destination_id} ->
        player_context = %{
          player_id: player.id,
          player_name: player_name,
          type: :player
        }

        case Hooks.run_until_halt(:at_before_move, [
               player_context,
               %{destination_id: destination_id, direction: direction}
             ]) do
          {:halt, reason} ->
            event = %{
              text: "You can't go that way: #{reason}",
              timestamp: DateTime.utc_now()
            }

            {:noreply,
             socket
             |> update_ui(%{compass_open: false})
             |> update_events([event])}

          :ok ->
            do_navigation(socket, room, destination_id, direction, player, player_name, player_context, game_state)
        end
    end
  end

  @doc """
  Loads other players in a room (excluding self).
  """
  def load_other_players(nil, _player_id), do: []

  def load_other_players(room_id, player_id) do
    room_id
    |> PlayerGameState.get_players_in_room(exclude: player_id)
    |> Enum.map(fn pid ->
      case Accounts.get_player(pid) do
        nil -> nil
        player -> %{id: player.id, name: player_display_name(player)}
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  @doc """
  Activates a room entity via EntityRegistry (on-demand process management).
  """
  def activate_room_entity(nil), do: :ok

  def activate_room_entity(room_id) do
    case EntityRegistry.get_or_start(room_id) do
      {:ok, pid} ->
        EntityServer.touch(pid)
        :ok

      {:error, _reason} ->
        :ok
    end
  end

  @doc """
  Touches an entity to keep its EntityServer alive.
  """
  def touch_entity(nil), do: :ok

  def touch_entity(entity_id) do
    case EntityRegistry.lookup(entity_id) do
      {:ok, pid} ->
        EntityServer.touch(pid)
        :ok

      :not_found ->
        case EntityRegistry.get_or_start(entity_id) do
          {:ok, pid} ->
            EntityServer.touch(pid)
            :ok

          {:error, _reason} ->
            :ok
        end
    end
  end

  @doc """
  Extracts display name from player (uses email username).
  """
  def player_display_name(%{email: email}) when is_binary(email) do
    email
    |> String.split("@")
    |> List.first()
    |> String.capitalize()
  end

  def player_display_name(_), do: "Someone"

  # Private helpers

  defp try_load_room(nil), do: {:error, :not_found}
  defp try_load_room(room_id), do: RoomLoader.load_room_for_display(room_id)

  defp force_room_assignment(game_state, room_id) do
    case PlayerGameState.update_state(game_state, %{current_room_id: room_id}) do
      {:ok, updated} -> updated
      _ -> game_state
    end
  end

  defp ensure_room_assigned(game_state, room_id) do
    if is_nil(game_state.current_room_id) and not is_nil(room_id) do
      case PlayerGameState.update_state(game_state, %{current_room_id: room_id}) do
        {:ok, updated} -> updated
        _ -> game_state
      end
    else
      game_state
    end
  end

  defp do_navigation(socket, room, destination_id, direction, player, player_name, player_context, game_state) do
    import Phoenix.Component, only: [assign: 3]

    # Run leave_room hook
    Hooks.run(:at_leave_room, [player_context, %{room_id: room.id, direction: direction}])

    # Broadcast leave to old room before unsubscribing
    if room.id do
      Phoenix.PubSub.broadcast(
        Exmud.PubSub,
        "room:#{room.id}",
        {:player_left, player.id, player_name, direction}
      )

      Phoenix.PubSub.unsubscribe(Exmud.PubSub, "room:#{room.id}")
    end

    # Update player's current room
    {:ok, new_game_state} =
      PlayerGameState.update_state(game_state, %{current_room_id: destination_id})

    # Load new room
    case RoomLoader.load_room_for_display(destination_id) do
      {:ok, new_room} ->
        activate_room_entity(new_room.id)

        # Run enter_room hook
        Hooks.run(:at_enter_room, [player_context, %{room_id: new_room.id}])

        # Subscribe to new room events
        Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{new_room.id}")

        # Broadcast enter to new room
        Phoenix.PubSub.broadcast(
          Exmud.PubSub,
          "room:#{new_room.id}",
          {:player_entered, player.id, player_name}
        )

        # Load other players in new room
        other_players = load_other_players(new_room.id, player.id)

        event = %{
          text: "You head #{direction} to #{new_room.title}.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> assign(:room, new_room)
         |> assign(:game_state, new_game_state)
         |> assign(:other_players, other_players)
         |> update_ui(%{compass_open: false, context_entity: nil})
         |> assign(:events, [event])}

      {:error, :not_found} ->
        event = %{
          text: "Something went wrong... the path #{direction} leads to nowhere.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{compass_open: false})
         |> update_events([event])}
    end
  end

  # UI helper - delegates to socket update
  defp update_ui(socket, updates) do
    Phoenix.Component.update(socket, :ui, fn ui -> Map.merge(ui, updates) end)
  end

  defp update_events(socket, new_events) do
    Phoenix.Component.update(socket, :events, fn events -> events ++ new_events end)
  end
end
