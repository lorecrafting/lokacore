defmodule Loka.Framework.Commands.BlockCommand do
  @moduledoc """
  Block management command.

  Allows players to block others from communicating with them.

  ## Usage

      block Alice              # Block a player
      unblock Alice            # Unblock a player
      block list               # Show blocked players

  ## Effects of Blocking

  - Blocked players cannot send you tells
  - Blocked players' emotes targeting you are hidden
  - Blocked players are hidden from your who list
  - You are hidden from blocked players' who lists
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.Relationships

  @impl true
  def key, do: "block"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    block <player> - Block a player from contacting you.
    block list     - Show your block list.

    Blocked players cannot:
    - Send you tells
    - Target you with emotes
    - See you in the who list
    """
  end

  @impl true
  def parse(args, _context) do
    target = String.trim(args)

    case target do
      "" -> {:error, "Block whom? (or use 'block list' to see blocked players)"}
      "list" -> {:ok, %{action: :list}}
      name -> {:ok, %{action: :block, target: name}}
    end
  end

  @impl true
  def execute(%{action: :list}, context) do
    game_state = Map.get(context, :game_state, %{})
    blocked = Relationships.get_blocked(game_state)

    output = format_block_list(blocked)
    {:ok, [%{type: :output, text: output, recipient: :actor}]}
  end

  def execute(%{action: :block, target: target_name}, context) do
    game_state = Map.get(context, :game_state, %{})

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case Relationships.block(game_state, target_id) do
          {:ok, updated_state} ->
            {:ok,
             [
               %{
                 type: :output,
                 text: "#{target_name} has been blocked. They can no longer contact you.",
                 recipient: :actor
               },
               %{type: :state_update, updates: %{relationships: get_relationships(updated_state)}}
             ]}

          {:error, :already_blocked} ->
            {:error, "#{target_name} is already blocked."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' not found."}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp format_block_list([]) do
    "Your block list is empty."
  end

  defp format_block_list(blocked_ids) do
    names =
      blocked_ids
      |> Enum.map(&get_player_name/1)
      |> Enum.sort()

    header = "Blocked players (#{length(blocked_ids)}):\n"
    lines = Enum.map(names, &"  #{&1}")

    header <> Enum.join(lines, "\n")
  end

  defp get_player_name(player_id) do
    case find_player_by_id(player_id) do
      {:ok, player} -> Map.get(player, :name, "Unknown")
      _ -> "Unknown"
    end
  end

  defp find_player_by_name(name) do
    try do
      Loka.Engine.EntityRegistry.find_player_by_name(name)
    rescue
      UndefinedFunctionError -> {:error, :not_found}
    end
  end

  defp find_player_by_id(player_id) do
    try do
      Loka.Engine.EntityRegistry.get_player(player_id)
    rescue
      UndefinedFunctionError -> {:error, :not_found}
    end
  end

  defp get_relationships(%{stats: stats}) do
    Map.get(stats, :relationships, %{})
  end

  defp get_relationships(_), do: %{}
end
