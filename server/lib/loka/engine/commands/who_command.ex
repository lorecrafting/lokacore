defmodule Loka.Engine.Commands.WhoCommand do
  @moduledoc """
  Who command to see online players.

  Lists all players currently online in the game.

  ## Usage

      who              # All online players
      who friends      # Friends only (future)
      who zone         # Same zone only (future)

  ## Output Format

      3 players online:
        Alice the Brave [Available]
        Bob [Away]
        Charlie, Defender of Millbrook [Busy]
  """

  use Loka.Engine.Command

  @impl true
  def key, do: "who"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    who [filter] - See who is online.

    Examples:
      who           - Show all online players
      who friends   - Show online friends (coming soon)
      who zone      - Show players in your area (coming soon)

    Players who are hidden will not appear in this list.
    """
  end

  @impl true
  def parse(args, _context) do
    filter =
      case String.trim(args) do
        "" -> :all
        "friends" -> :friends
        "zone" -> :zone
        "area" -> :zone
        other -> {:custom, other}
      end

    {:ok, %{filter: filter}}
  end

  @impl true
  def execute(%{filter: filter}, context) do
    game_state = Map.get(context, :game_state, %{})
    actor = Map.get(context, :actor)

    online_players = get_online_players(filter, actor, game_state)

    output = format_who_list(online_players, filter)

    {:ok, [%{type: :output, text: output, recipient: :actor}]}
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_online_players(:all, actor, _game_state) do
    # Get all online players from the session/presence system
    # Filter out hidden players and the actor themselves
    actor_id = get_actor_id(actor)

    case get_all_online() do
      players when is_list(players) ->
        players
        |> Enum.reject(fn player ->
          player_id = Map.get(player, :id) || Map.get(player, :player_id)
          status = Map.get(player, :status, %{})
          availability = Map.get(status, :availability, :available)

          # Exclude self and hidden players
          player_id == actor_id || availability == :hidden
        end)

      _ ->
        []
    end
  end

  defp get_online_players(:friends, actor, game_state) do
    # Filter to just friends
    friends = get_in(game_state, [:relationships, :friends]) || []

    get_online_players(:all, actor, game_state)
    |> Enum.filter(fn player ->
      player_id = Map.get(player, :id) || Map.get(player, :player_id)
      player_id in friends
    end)
  end

  defp get_online_players(:zone, actor, game_state) do
    # Filter to same zone - placeholder for now
    get_online_players(:all, actor, game_state)
  end

  defp get_online_players({:custom, _search}, actor, game_state) do
    # Search by name - placeholder for now
    get_online_players(:all, actor, game_state)
  end

  defp get_all_online do
    # Try to get from session registry or presence system
    # For now, return empty list - this will be implemented when
    # we have proper session tracking
    try do
      Loka.Session.Registry.get_online_players()
    rescue
      UndefinedFunctionError -> []
    end
  end

  defp format_who_list(players, filter) do
    count = length(players)
    filter_text = filter_description(filter)

    if count == 0 do
      case filter do
        :all -> "No other players are currently online."
        :friends -> "None of your friends are online."
        :zone -> "No other players are in this area."
        _ -> "No players found."
      end
    else
      header = "#{count} player#{if count != 1, do: "s"}#{filter_text} online:\n"

      lines =
        players
        |> Enum.sort_by(&get_player_name/1)
        |> Enum.map(&format_player_line/1)

      header <> Enum.join(lines, "\n")
    end
  end

  defp filter_description(:all), do: ""
  defp filter_description(:friends), do: " (friends)"
  defp filter_description(:zone), do: " (in area)"
  defp filter_description(_), do: ""

  defp format_player_line(player) do
    name = get_player_name(player)
    title = Map.get(player, :title)
    status = Map.get(player, :status, %{})
    availability = Map.get(status, :availability, :available)
    custom_status = Map.get(status, :custom_message)

    name_with_title =
      if title do
        "#{name} #{title}"
      else
        name
      end

    status_indicator = format_status(availability, custom_status)

    "  #{name_with_title}#{status_indicator}"
  end

  defp get_player_name(player) do
    Map.get(player, :name) ||
      Map.get(player, :short_desc) ||
      "Unknown"
  end

  defp get_actor_id(nil), do: nil

  defp get_actor_id(actor) do
    Map.get(actor, :id) || Map.get(actor, :player_id)
  end

  defp format_status(:available, nil), do: ""
  defp format_status(:available, custom), do: " - #{custom}"
  defp format_status(:busy, nil), do: " [Busy]"
  defp format_status(:busy, custom), do: " [Busy - #{custom}]"
  defp format_status(:away, nil), do: " [Away]"
  defp format_status(:away, custom), do: " [Away - #{custom}]"
  defp format_status(:do_not_disturb, _), do: " [DND]"
  defp format_status(_, nil), do: ""
  defp format_status(_, custom), do: " - #{custom}"
end
