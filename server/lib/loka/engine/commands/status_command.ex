defmodule Loka.Engine.Commands.StatusCommand do
  @moduledoc """
  Status command for player availability indication.

  Allows players to set their availability status which affects
  how they appear in the who list and whether they receive tells.

  ## Status Values

  | Status | Who List | Tells | Description |
  |--------|----------|-------|-------------|
  | available | Visible | ✓ | Default, open to interaction |
  | busy | Visible [Busy] | ✓ (warning) | Auto-set during combat |
  | away | Visible [Away] | ✓ (auto-reply) | AFK, manual set |
  | dnd | Visible [DND] | ✗ blocked | Do not disturb |
  | hidden | Not visible | ✓ | Invisible on who list |

  ## Usage

      status                    # Show current status
      status available          # Set to available
      status busy               # Set to busy
      status away               # Set to away
      status dnd                # Do not disturb
      status hidden             # Hide from who list
      status "Training hard"    # Set custom message

  ## Custom Messages

  Any status can have an optional custom message that appears in the who list:
      Alice [Away] - Training in the dojo
  """

  use Loka.Engine.Command

  @statuses [:available, :busy, :away, :dnd, :hidden]
  @status_aliases %{
    "available" => :available,
    "avail" => :available,
    "busy" => :busy,
    "away" => :away,
    "afk" => :away,
    "dnd" => :dnd,
    "donotdisturb" => :dnd,
    "hidden" => :hidden,
    "invisible" => :hidden,
    "hide" => :hidden
  }

  @impl true
  def key, do: "status"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    status [setting] [message] - View or set your availability status.

    Settings:
      available  - Open to interaction (default)
      busy       - Currently occupied, warns senders
      away       - AFK, auto-replies to tells
      dnd        - Do not disturb, blocks tells
      hidden     - Invisible on who list

    Examples:
      status                   - Show your current status
      status away              - Set status to away
      status dnd               - Set do not disturb
      status "Training hard"   - Set a custom status message

    Your status appears next to your name in the who list.
    """
  end

  @impl true
  def parse(args, _context) do
    args = String.trim(args)

    cond do
      # No args - show current status
      args == "" ->
        {:ok, %{action: :show}}

      # Quoted custom message
      String.starts_with?(args, "\"") ->
        message = String.trim(args, "\"")
        {:ok, %{action: :set_message, message: message}}

      # Status keyword
      true ->
        case parse_status(args) do
          {:ok, status} ->
            {:ok, %{action: :set, status: status}}

          {:error, _} ->
            # Treat as custom message without quotes
            {:ok, %{action: :set_message, message: args}}
        end
    end
  end

  @impl true
  def execute(%{action: :show}, context) do
    game_state = Map.get(context, :game_state, %{})
    status_data = get_status_data(game_state)

    availability = Map.get(status_data, :availability, :available)
    custom_message = Map.get(status_data, :custom_message)

    status_text = format_status_display(availability, custom_message)

    {:ok,
     [
       %{
         type: :info,
         text: status_text,
         recipient: :actor
       }
     ]}
  end

  def execute(%{action: :set, status: status}, _context) do
    status_label = status_label(status)

    {:ok,
     [
       %{
         type: :info,
         text: "Your status is now set to #{status_label}.",
         recipient: :actor
       },
       %{
         type: :state_update,
         updates: %{
           social: %{
             status: %{
               availability: status,
               updated_at: DateTime.utc_now()
             }
           }
         }
       }
     ]}
  end

  def execute(%{action: :set_message, message: message}, _context) do
    {:ok,
     [
       %{
         type: :info,
         text: "Your status message is now: \"#{message}\"",
         recipient: :actor
       },
       %{
         type: :state_update,
         updates: %{
           social: %{
             status: %{
               custom_message: message,
               updated_at: DateTime.utc_now()
             }
           }
         }
       }
     ]}
  end

  # =============================================================================
  # Public API for other modules
  # =============================================================================

  @doc """
  Returns the list of valid status values.
  """
  def valid_statuses, do: @statuses

  @doc """
  Checks if a player can receive tells based on their status.
  """
  def can_receive_tells?(:dnd), do: false
  def can_receive_tells?(_status), do: true

  @doc """
  Checks if a player should be visible in the who list.
  """
  def visible_in_who?(:hidden), do: false
  def visible_in_who?(_status), do: true

  @doc """
  Gets status display for who list.
  """
  def format_for_who(status, custom_message \\ nil)
  def format_for_who(:available, nil), do: ""
  def format_for_who(:available, msg), do: " - #{msg}"
  def format_for_who(:busy, nil), do: " [Busy]"
  def format_for_who(:busy, msg), do: " [Busy] - #{msg}"
  def format_for_who(:away, nil), do: " [Away]"
  def format_for_who(:away, msg), do: " [Away] - #{msg}"
  def format_for_who(:dnd, nil), do: " [DND]"
  def format_for_who(:dnd, msg), do: " [DND] - #{msg}"
  def format_for_who(:hidden, _), do: ""
  def format_for_who(_, _), do: ""

  # =============================================================================
  # Private
  # =============================================================================

  defp parse_status(input) do
    key = input |> String.downcase() |> String.replace(" ", "")

    case Map.get(@status_aliases, key) do
      nil -> {:error, :invalid_status}
      status -> {:ok, status}
    end
  end

  defp get_status_data(game_state) do
    game_state
    |> Map.get(:social, %{})
    |> Map.get(:status, %{})
  end

  defp format_status_display(availability, custom_message) do
    label = status_label(availability)
    description = status_description(availability)

    base = "Your status: #{label} - #{description}"

    if custom_message do
      base <> "\nCustom message: \"#{custom_message}\""
    else
      base
    end
  end

  defp status_label(:available), do: "Available"
  defp status_label(:busy), do: "Busy"
  defp status_label(:away), do: "Away"
  defp status_label(:dnd), do: "Do Not Disturb"
  defp status_label(:hidden), do: "Hidden"
  defp status_label(_), do: "Unknown"

  defp status_description(:available), do: "You are open to interaction."
  defp status_description(:busy), do: "Others will see you're busy when messaging."
  defp status_description(:away), do: "Others will receive an auto-reply."
  defp status_description(:dnd), do: "Tells are blocked."
  defp status_description(:hidden), do: "You don't appear in the who list."
  defp status_description(_), do: ""
end
