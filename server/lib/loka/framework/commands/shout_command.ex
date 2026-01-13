defmodule Loka.Framework.Commands.ShoutCommand do
  @moduledoc """
  Shout command for adjacent room communication.

  Broadcasts a message to the current room and all directly connected
  neighboring rooms. Players in adjacent rooms hear the shout with
  directional context.

  ## Usage

      shout Help! Bandits attacking!
      > You shout, "Help! Bandits attacking!"

  ## Range

  - Current room: Full message with speaker visible
  - Adjacent rooms: Heard as "You hear shouting from the [direction]..."

  ## Message Format

  In current room:
      Alice shouts, "Help! Bandits attacking!"

  In adjacent room:
      You hear shouting from the south: "Help! Bandits attacking!"

  ## Rate Limiting

  Shout has a 10-second cooldown to prevent spam. Attempting to shout
  too quickly results in:
      "You need to catch your breath before shouting again."

  ## See Also

  - `yell` - Zone-wide communication (30-second cooldown)
  - `say` - Room-only communication
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  # Cooldown in seconds
  @cooldown_seconds 10

  @impl true
  def key, do: "shout"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    shout <message> - Shout to your room and adjacent areas.

    Your shout is heard in your current room and all directly
    connected neighboring rooms.

    Examples:
      shout Help! I'm under attack!
      shout Is anyone there?

    In your room, others see: Alice shouts, "Help!"
    In adjacent rooms: You hear shouting from the south: "Help!"

    Note: There is a #{@cooldown_seconds}-second cooldown between shouts.
    """
  end

  @impl true
  def parse(args, context) do
    message = String.trim(args)

    cond do
      message == "" ->
        {:error, "Shout what?"}

      on_cooldown?(context) ->
        {:error, "You need to catch your breath before shouting again."}

      true ->
        {:ok, %{message: message}}
    end
  end

  @impl true
  def execute(%{message: message}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)
    room_id = get_room_id(location)

    if room_id do
      msg =
        ScopedMessage.new(:adjacent, message, actor,
          location: room_id,
          message_type: :shout
        )

      MessageRouter.route(msg)

      {:ok,
       [
         %{
           type: :shout,
           text: ScopedMessage.format_for_sender(msg),
           recipient: :actor
         },
         %{
           type: :state_update,
           updates: %{
             social: %{
               last_shout_at: DateTime.utc_now()
             }
           }
         }
       ]}
    else
      {:error, "You cannot shout here."}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp on_cooldown?(context) do
    game_state = Map.get(context, :game_state, %{})

    last_shout_at =
      game_state
      |> Map.get(:social, %{})
      |> Map.get(:last_shout_at)

    case last_shout_at do
      nil ->
        false

      timestamp when is_binary(timestamp) ->
        case DateTime.from_iso8601(timestamp) do
          {:ok, dt, _} ->
            seconds_since = DateTime.diff(DateTime.utc_now(), dt, :second)
            seconds_since < @cooldown_seconds

          _ ->
            false
        end

      %DateTime{} = dt ->
        seconds_since = DateTime.diff(DateTime.utc_now(), dt, :second)
        seconds_since < @cooldown_seconds

      _ ->
        false
    end
  end

  defp get_room_id(nil), do: nil
  defp get_room_id(%{id: id}), do: id
  defp get_room_id(room_id) when is_binary(room_id), do: room_id
  defp get_room_id(_), do: nil
end
