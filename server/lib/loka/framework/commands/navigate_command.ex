defmodule Loka.Framework.Commands.NavigateCommand do
  @moduledoc """
  Command for navigating between rooms.

  Handles player movement through exits, checking hooks and locks.

  ## Usage

      # Parse and execute navigation
      {:ok, parsed} = NavigateCommand.parse("north", context)
      {:ok, events} = NavigateCommand.execute(parsed, context)

  ## Context Requirements

  The context must include:
  - `:actor` - Map with :player_id, :player_name
  - `:location` - Current room with :exits list
  - `:game_state` - Player game state
  """

  use Loka.Engine.Command

  alias Loka.Engine.Hooks

  # Framework commands intentionally depend on Framework modules.
  # Engine provides the Command behavior; Framework provides implementations.
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.World.RoomLoader

  @directions ~w(north south east west up down n s e w u d)
  @direction_aliases %{
    "n" => "north",
    "s" => "south",
    "e" => "east",
    "w" => "west",
    "u" => "up",
    "d" => "down"
  }

  @impl true
  def key, do: "go"

  @impl true
  def aliases, do: @directions

  @impl true
  def required_context, do: [:actor, :location, :game_state]

  @impl true
  def help do
    "Move in a direction. Use compass directions (north, south, east, west) or shortcuts (n, s, e, w)."
  end

  @impl true
  def parse(args, context) do
    direction = normalize_direction(String.trim(args))
    room = Map.get(context, :location)

    cond do
      direction == "" ->
        {:error, "Go where?"}

      room == nil ->
        {:error, "You are nowhere."}

      true ->
        exit = Enum.find(room.exits || [], fn e -> e.direction == direction end)
        {:ok, %{direction: direction, exit: exit}}
    end
  end

  @impl true
  def execute(%{exit: nil, direction: direction}, _context) do
    event = %{
      type: :system,
      text: "You can't go #{direction}.",
      timestamp: DateTime.utc_now()
    }

    {:ok, [event]}
  end

  def execute(%{exit: %{destination_id: nil}, direction: direction}, _context) do
    event = %{
      type: :system,
      text: "The path #{direction} seems to lead nowhere...",
      timestamp: DateTime.utc_now()
    }

    {:ok, [event]}
  end

  def execute(%{exit: exit, direction: direction}, context) do
    actor = context.actor
    destination_id = exit.destination_id

    player_context = %{
      player_id: actor.player_id,
      player_name: actor.player_name,
      type: :player
    }

    # Run before_move hooks
    case Hooks.run_until_halt(:at_before_move, [
           player_context,
           %{destination_id: destination_id, direction: direction}
         ]) do
      {:halt, reason} ->
        event = %{
          type: :system,
          text: "You can't go that way: #{reason}",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}

      :ok ->
        do_move(context, destination_id, direction, player_context)
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp normalize_direction(dir) do
    Map.get(@direction_aliases, dir, dir)
  end

  defp do_move(context, destination_id, direction, player_context) do
    game_state = context.game_state
    current_room = context.location

    case load_destination_room(destination_id) do
      {:ok, new_room} ->
        # Update player's room
        {:ok, updated_game_state} =
          PlayerGameState.update_state(game_state, %{current_room_id: destination_id})

        # Fire enter_room hook - Framework's QuestListeners will handle quest progress
        room_key = new_room.key || new_room.id

        Hooks.run(:at_enter_room, [
          Map.put(player_context, :game_state, updated_game_state),
          %{room_id: new_room.id, room_key: room_key}
        ])

        # Run after_move hooks
        Hooks.run(:at_after_move, [player_context, %{room: new_room, direction: direction}])

        # Build events
        movement_event = %{
          type: :movement,
          data: %{
            from_room_id: current_room.id,
            to_room_id: new_room.id,
            direction: direction,
            new_room: new_room,
            updated_game_state: updated_game_state
          },
          text: build_arrival_text(new_room, direction),
          timestamp: DateTime.utc_now()
        }

        {:ok, [movement_event]}

      {:error, :not_found} ->
        event = %{
          type: :system,
          text: "That exit leads nowhere.",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}
    end
  end

  defp load_destination_room(room_id) do
    case RoomLoader.load_room_for_display(room_id) do
      {:ok, room} -> {:ok, room}
      {:error, _} -> {:error, :not_found}
    end
  end

  defp build_arrival_text(room, direction) do
    "You head #{direction}.\n\n#{room.title}"
  end
end
