defmodule Loka.Framework.Commands.PoseCommand do
  @moduledoc """
  Pose command for persistent character description in rooms.

  Allows players to set a custom description that appears when others
  view the room, providing a more immersive representation of what
  their character is doing.

  ## Usage

      pose sits cross-legged, eyes closed in meditation
      > You are now: sits cross-legged, eyes closed in meditation.

      pose                        # Clear pose
      pose clear                  # Clear pose

  ## Room Display

  When others look at the room, they see:

      The Great Hall
      Torches flicker on the stone walls...

      Alice sits cross-legged, eyes closed in meditation.
      Bob leans against the wall, watching the door.
      Carol is here.

  Players without a pose show the default "is here."

  ## Auto-Clear Triggers

  Pose automatically clears when:
  - Moving to another room
  - Entering combat
  - Performing certain actions (attack, get, drop, give)

  ## Validation

  - Maximum 200 characters
  - No newlines allowed
  - Should be written in third-person (starts with a verb)
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @max_length 200

  @impl true
  def key, do: "pose"

  @impl true
  def aliases, do: ["@"]

  @impl true
  def help do
    """
    pose [description] - Set a persistent pose visible in the room.

    Your pose replaces the default "is here" message with a custom
    description of what your character is doing.

    Examples:
      pose sits by the fire, reading a worn book
      pose leans against the doorframe, arms crossed
      pose                   - Clear your current pose
      pose clear             - Clear your current pose
      @ stretches lazily     - Shortcut using @ alias

    Tips:
      - Write in third person (verb first): "sits" not "I am sitting"
      - Keep it under #{@max_length} characters
      - Your pose clears automatically when you move or enter combat

    Room display example:
      > Alice sits by the fire, reading a worn book.
      > Bob is here.
    """
  end

  @impl true
  def parse(args, _context) do
    pose = String.trim(args)

    cond do
      # No args or "clear" - clear pose
      pose == "" or pose == "clear" ->
        {:ok, %{action: :clear}}

      # Validate length
      String.length(pose) > @max_length ->
        {:error,
         "Pose is too long (max #{@max_length} characters). Current: #{String.length(pose)}"}

      # Check for newlines
      String.contains?(pose, "\n") ->
        {:error, "Pose cannot contain newlines."}

      # Valid pose
      true ->
        {:ok, %{action: :set, pose: pose}}
    end
  end

  @impl true
  def execute(%{action: :clear}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)
    room_id = get_room_id(location)

    events = [
      %{
        type: :info,
        text: "You relax from your pose.",
        recipient: :actor
      },
      %{
        type: :state_update,
        updates: %{
          social: %{
            pose: nil
          }
        }
      }
    ]

    # Broadcast pose clear to room
    if room_id do
      name = get_actor_name(actor)

      msg =
        ScopedMessage.new(:room, "#{name} relaxes from their pose.", actor,
          location: room_id,
          message_type: :emote
        )

      MessageRouter.route(msg)
    end

    {:ok, events}
  end

  def execute(%{action: :set, pose: pose}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)
    room_id = get_room_id(location)
    name = get_actor_name(actor)

    events = [
      %{
        type: :info,
        text: "You are now: #{pose}",
        recipient: :actor
      },
      %{
        type: :state_update,
        updates: %{
          social: %{
            pose: %{
              text: pose,
              set_at: DateTime.utc_now()
            }
          }
        }
      }
    ]

    # Broadcast new pose to room
    if room_id do
      msg =
        ScopedMessage.new(:room, "#{name} #{pose}.", actor,
          location: room_id,
          message_type: :emote
        )

      MessageRouter.route(msg)
    end

    {:ok, events}
  end

  # =============================================================================
  # Public API for other modules
  # =============================================================================

  @doc """
  Formats a player's room presence with their pose.

  ## Examples

      iex> PoseCommand.format_room_presence("Alice", "sits by the fire")
      "Alice sits by the fire."

      iex> PoseCommand.format_room_presence("Bob", nil)
      "Bob is here."
  """
  def format_room_presence(name, nil), do: "#{name} is here."
  def format_room_presence(name, ""), do: "#{name} is here."
  def format_room_presence(name, pose), do: "#{name} #{pose}."

  @doc """
  Gets the pose text from game state.

  ## Examples

      iex> PoseCommand.get_pose(%{social: %{pose: %{text: "sits reading"}}})
      "sits reading"

      iex> PoseCommand.get_pose(%{})
      nil
  """
  def get_pose(game_state) do
    game_state
    |> Map.get(:social, %{})
    |> Map.get(:pose, %{})
    |> case do
      %{text: text} when is_binary(text) and text != "" -> text
      _ -> nil
    end
  end

  @doc """
  Clears pose and returns the update map for state updates.

  Used when pose should be auto-cleared (movement, combat, etc.)
  """
  def clear_pose_update do
    %{
      social: %{
        pose: nil
      }
    }
  end

  @doc """
  Returns the list of action types that should clear pose.
  """
  def auto_clear_triggers do
    [:move, :attack, :get, :drop, :give, :enter_combat, :death]
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_room_id(nil), do: nil
  defp get_room_id(%{id: id}), do: id
  defp get_room_id(room_id) when is_binary(room_id), do: room_id
  defp get_room_id(_), do: nil

  defp get_actor_name(nil), do: "Someone"

  defp get_actor_name(actor) when is_map(actor) do
    Map.get(actor, :short_desc) ||
      Map.get(actor, :character_name) ||
      Map.get(actor, :name) ||
      "Someone"
  end

  defp get_actor_name(_), do: "Someone"
end
