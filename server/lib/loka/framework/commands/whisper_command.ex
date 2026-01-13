defmodule Loka.Framework.Commands.WhisperCommand do
  @moduledoc """
  Whisper command for private room-local communication.

  Unlike `tell`, whisper only works on players in the same room.
  Others in the room see that you're whispering, but not the content.

  ## Usage

      whisper Alice Meet me at the back door
      wh Bob The password is "moonlight"

  ## Output

  - Sender sees: `You whisper to Alice, "Meet me at the back door"`
  - Target sees: `Bob whispers to you, "Meet me at the back door"`
  - Room sees: `Bob whispers something to Alice.`

  ## Difference from Tell

  - **tell** - Works anywhere, target can be in any room, no one else knows
  - **whisper** - Only same room, others see you whispering (but not content)
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "whisper"

  @impl true
  def aliases, do: ["wh"]

  @impl true
  def help do
    """
    whisper <player> <message> - Whisper privately to someone in the room.

    Examples:
      whisper Alice Meet me at the back door
      wh Bob The password is "moonlight"

    Only the target hears the full message. Others in the room see that
    you're whispering, but not what you said.

    Use 'tell' to message someone in a different room.
    """
  end

  @impl true
  def parse(args, _context) do
    args = String.trim(args)

    case String.split(args, " ", parts: 2) do
      [_target, ""] ->
        {:error, "Whisper what?"}

      [target, message] ->
        {:ok, %{target_name: target, message: message}}

      [_target] ->
        {:error, "Whisper what?"}

      [] ->
        {:error, "Whisper to whom?"}
    end
  end

  @impl true
  def execute(%{target_name: target_name, message: message}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)
    room_id = get_room_id(location)

    case find_in_room(target_name, room_id, context) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)
        target_display_name = Map.get(target, :name, target_name)

        msg =
          ScopedMessage.new(:room, message, actor,
            to: target_id,
            to_name: target_display_name,
            location: room_id,
            message_type: :whisper
          )

        # Route the message - MessageRouter handles whisper specially
        MessageRouter.route(msg)

        # Return the formatted message for the actor
        {:ok,
         [
           %{
             type: :whisper,
             text: ScopedMessage.format_for_sender(msg),
             recipient: :actor
           }
         ]}

      {:error, :not_found} ->
        {:error, "You don't see '#{target_name}' here."}

      {:error, :self} ->
        {:error, "Talking to yourself again?"}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_room_id(nil), do: nil
  defp get_room_id(%{id: id}), do: id
  defp get_room_id(room_id) when is_binary(room_id), do: room_id
  defp get_room_id(_), do: nil

  defp find_in_room(target_name, _room_id, context) do
    actor = Map.get(context, :actor)
    actor_name = Map.get(actor, :name, "")

    # Check if trying to whisper to self
    if String.downcase(target_name) == String.downcase(actor_name) do
      {:error, :self}
    else
      # Search for the target among online players in the same room
      target_name_lower = String.downcase(target_name)

      # Get online players and filter by name match
      result =
        Loka.Session.Registry.get_online_players()
        |> Enum.find(fn player ->
          player_name = Map.get(player, :name, "")
          String.downcase(player_name) == target_name_lower
        end)

      case result do
        nil -> {:error, :not_found}
        player -> {:ok, player}
      end
    end
  rescue
    _ -> {:error, :not_found}
  end
end
