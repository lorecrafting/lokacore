defmodule Loka.Framework.Commands.SayCommand do
  @moduledoc """
  Say command for room-local communication.

  Broadcasts a message to everyone in the current room.

  ## Usage

      say Hello everyone!
      ' Hello everyone!      (shortcut using apostrophe alias)

  ## Output

  - Sender sees: `You say, "Hello everyone!"`
  - Others in room see: `Alice says, "Hello everyone!"`

  ## Integration

  Uses the ScopedMessage primitive with `:room` scope for routing.
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "say"

  @impl true
  def aliases, do: ["'"]

  @impl true
  def required_context, do: [:actor, :location]

  @impl true
  def help do
    """
    say <message> - Speak to everyone in the room.

    Examples:
      say Hello, everyone!
      ' Greetings, travelers!

    Everyone in your current location will hear what you say.
    """
  end

  @impl true
  def parse(args, _context) do
    message = String.trim(args)

    if message == "" do
      {:error, "Say what?"}
    else
      {:ok, %{message: message}}
    end
  end

  @impl true
  def execute(%{message: message}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)
    room_id = get_room_id(location)

    msg =
      ScopedMessage.new(:room, message, actor,
        location: room_id,
        message_type: :say
      )

    MessageRouter.route(msg)

    # Return the formatted message for the actor as an event
    {:ok,
     [
       %{
         type: :say,
         text: ScopedMessage.format_for_sender(msg),
         recipient: :actor
       }
     ]}
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_room_id(nil), do: nil
  defp get_room_id(%{id: id}), do: id
  defp get_room_id(room_id) when is_binary(room_id), do: room_id
  defp get_room_id(_), do: nil
end
