defmodule Loka.Framework.Commands.UnblockCommand do
  @moduledoc """
  Unblock command to remove players from your block list.

  ## Usage

      unblock Alice            # Remove Alice from block list
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.Relationships

  @impl true
  def key, do: "unblock"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    unblock <player> - Remove a player from your block list.

    After unblocking, they will be able to send you tells and emotes again.
    """
  end

  @impl true
  def parse(args, _context) do
    target = String.trim(args)

    if target == "" do
      {:error, "Unblock whom?"}
    else
      {:ok, %{target: target}}
    end
  end

  @impl true
  def execute(%{target: target_name}, context) do
    game_state = Map.get(context, :game_state, %{})

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case Relationships.unblock(game_state, target_id) do
          {:ok, updated_state} ->
            {:ok,
             [
               %{
                 type: :output,
                 text: "#{target_name} has been unblocked.",
                 recipient: :actor
               },
               %{type: :state_update, updates: %{relationships: get_relationships(updated_state)}}
             ]}

          {:error, :not_blocked} ->
            {:error, "#{target_name} is not on your block list."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' not found."}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp find_player_by_name(name) do
    try do
      Loka.Engine.EntityRegistry.find_player_by_name(name)
    rescue
      UndefinedFunctionError -> {:error, :not_found}
    end
  end

  defp get_relationships(%{stats: stats}) do
    Map.get(stats, :relationships, %{})
  end

  defp get_relationships(_), do: %{}
end
