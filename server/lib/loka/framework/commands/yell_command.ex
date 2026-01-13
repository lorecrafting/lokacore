defmodule Loka.Framework.Commands.YellCommand do
  @moduledoc """
  Yell command for area-wide communication.

  Broadcasts a message to the current room and all directly connected
  neighboring rooms with a longer cooldown than shout. Yelling carries
  further and is more attention-grabbing.

  ## Usage

      yell The dragon approaches from the north!
      > You yell, "The dragon approaches from the north!"

  ## Range

  - Current room: Full message with speaker visible
  - Adjacent rooms: Heard as "From the [direction], someone yells..."

  ## Message Format

  In current room:
      Alice yells, "The dragon approaches!"

  In adjacent room:
      From the south, someone yells: "The dragon approaches!"

  ## Rate Limiting

  Yell has a 30-second cooldown to prevent spam (longer than shout).
  Attempting to yell too quickly results in:
      "Your throat is too hoarse to yell again so soon."

  ## Difference from Shout

  | Command | Cooldown | Format in Adjacent Rooms |
  |---------|----------|-------------------------|
  | shout | 10s | "You hear shouting from..." |
  | yell | 30s | "From the [dir], someone yells..." |

  ## See Also

  - `shout` - Adjacent room communication (10-second cooldown)
  - `say` - Room-only communication
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  # Cooldown in seconds (longer than shout)
  @cooldown_seconds 30

  @impl true
  def key, do: "yell"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    yell <message> - Yell to your room and surrounding areas.

    Your yell carries to your current room and all directly
    connected neighboring rooms. Yelling has a longer cooldown
    than shouting but sounds more urgent.

    Examples:
      yell The gates are breached!
      yell Rally to me!

    In your room, others see: Alice yells, "The gates are breached!"
    In adjacent rooms: From the south, someone yells: "The gates are breached!"

    Note: There is a #{@cooldown_seconds}-second cooldown between yells.
    """
  end

  @impl true
  def parse(args, context) do
    message = String.trim(args)

    cond do
      message == "" ->
        {:error, "Yell what?"}

      on_cooldown?(context) ->
        {:error, "Your throat is too hoarse to yell again so soon."}

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
          message_type: :yell
        )

      MessageRouter.route(msg)

      {:ok,
       [
         %{
           type: :yell,
           text: ScopedMessage.format_for_sender(msg),
           recipient: :actor
         },
         %{
           type: :state_update,
           updates: %{
             social: %{
               last_yell_at: DateTime.utc_now()
             }
           }
         }
       ]}
    else
      {:error, "You cannot yell here."}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp on_cooldown?(context) do
    game_state = Map.get(context, :game_state, %{})

    last_yell_at =
      game_state
      |> Map.get(:social, %{})
      |> Map.get(:last_yell_at)

    case last_yell_at do
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
