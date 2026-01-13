defmodule Loka.Framework.Commands.FriendCommand do
  @moduledoc """
  Friend management command.

  Allows players to manage their friends list.

  ## Usage

      friend list                    # Show friends and their online status
      friend add Alice               # Send friend request
      friend accept Bob              # Accept friend request
      friend decline Charlie         # Decline friend request
      friend remove Dave             # Remove from friends
      friend requests                # Show pending requests
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.Relationships

  @impl true
  def key, do: "friend"

  @impl true
  def aliases, do: ["friends"]

  @impl true
  def help do
    """
    friend <action> [player] - Manage your friends list.

    Actions:
      friend list              - Show your friends and their status
      friend add <player>      - Send a friend request
      friend accept <player>   - Accept a pending request
      friend decline <player>  - Decline a pending request
      friend remove <player>   - Remove someone from your friends
      friend requests          - Show pending friend requests
    """
  end

  @impl true
  def parse(args, _context) do
    parts = args |> String.trim() |> String.split(" ", parts: 2)

    case parts do
      ["list"] ->
        {:ok, %{action: :list}}

      ["requests"] ->
        {:ok, %{action: :requests}}

      ["add", target] ->
        {:ok, %{action: :add, target: String.trim(target)}}

      ["accept", target] ->
        {:ok, %{action: :accept, target: String.trim(target)}}

      ["decline", target] ->
        {:ok, %{action: :decline, target: String.trim(target)}}

      ["remove", target] ->
        {:ok, %{action: :remove, target: String.trim(target)}}

      [""] ->
        {:ok, %{action: :list}}

      [] ->
        {:ok, %{action: :list}}

      [action] when action in ["add", "accept", "decline", "remove"] ->
        {:error, "#{action} whom?"}

      _ ->
        {:error, "Unknown action. Try: list, add, accept, decline, remove, requests"}
    end
  end

  @impl true
  def execute(%{action: :list}, context) do
    game_state = Map.get(context, :game_state, %{})
    friends = Relationships.get_friends(game_state)

    output = format_friends_list(friends)
    {:ok, [%{type: :output, text: output, recipient: :actor}]}
  end

  def execute(%{action: :requests}, context) do
    game_state = Map.get(context, :game_state, %{})
    incoming = Relationships.get_friend_requests_in(game_state)
    outgoing = Relationships.get_friend_requests_out(game_state)

    output = format_requests(incoming, outgoing)
    {:ok, [%{type: :output, text: output, recipient: :actor}]}
  end

  def execute(%{action: :add, target: target_name}, context) do
    game_state = Map.get(context, :game_state, %{})

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case Relationships.send_friend_request(game_state, target_id) do
          {:ok, updated_state} ->
            # Notify the target player about the friend request
            {:ok,
             [
               %{
                 type: :output,
                 text: "Friend request sent to #{target_name}.",
                 recipient: :actor
               },
               %{
                 type: :state_update,
                 updates: %{relationships: get_relationships(updated_state)}
               },
               %{
                 type: :notify_player,
                 player_id: target_id,
                 message: "#{get_actor_name(context)} has sent you a friend request."
               }
             ]}

          {:error, :already_friends} ->
            {:error, "You are already friends with #{target_name}."}

          {:error, :already_requested} ->
            {:error, "You have already sent a friend request to #{target_name}."}

          {:error, :blocked} ->
            {:error, "You cannot send a friend request to that player."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' not found."}
    end
  end

  def execute(%{action: :accept, target: target_name}, context) do
    game_state = Map.get(context, :game_state, %{})

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case Relationships.accept_friend_request(game_state, target_id) do
          {:ok, updated_state} ->
            {:ok,
             [
               %{
                 type: :output,
                 text: "You are now friends with #{target_name}!",
                 recipient: :actor
               },
               %{
                 type: :state_update,
                 updates: %{relationships: get_relationships(updated_state)}
               },
               %{
                 type: :notify_player,
                 player_id: target_id,
                 message: "#{get_actor_name(context)} has accepted your friend request!"
               }
             ]}

          {:error, :no_request} ->
            {:error, "You don't have a friend request from #{target_name}."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' not found."}
    end
  end

  def execute(%{action: :decline, target: target_name}, context) do
    game_state = Map.get(context, :game_state, %{})

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)
        {:ok, updated_state} = Relationships.decline_friend_request(game_state, target_id)

        {:ok,
         [
           %{
             type: :output,
             text: "Friend request from #{target_name} declined.",
             recipient: :actor
           },
           %{type: :state_update, updates: %{relationships: get_relationships(updated_state)}}
         ]}

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' not found."}
    end
  end

  def execute(%{action: :remove, target: target_name}, context) do
    game_state = Map.get(context, :game_state, %{})

    case find_player_by_name(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)

        case Relationships.remove_friend(game_state, target_id) do
          {:ok, updated_state} ->
            {:ok,
             [
               %{type: :output, text: "#{target_name} removed from friends.", recipient: :actor},
               %{type: :state_update, updates: %{relationships: get_relationships(updated_state)}}
             ]}

          {:error, :not_friends} ->
            {:error, "#{target_name} is not on your friends list."}
        end

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' not found."}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp format_friends_list([]) do
    "Your friends list is empty."
  end

  defp format_friends_list(friend_ids) do
    friends_info = Enum.map(friend_ids, &get_friend_info/1)

    online = Enum.filter(friends_info, & &1.online)
    offline = Enum.reject(friends_info, & &1.online)

    lines = []

    lines =
      if Enum.any?(online) do
        online_lines = Enum.map(online, &"  #{&1.name} [Online]")
        lines ++ ["Online (#{length(online)}):"] ++ online_lines
      else
        lines
      end

    lines =
      if Enum.any?(offline) do
        offline_lines = Enum.map(offline, &"  #{&1.name}")
        lines ++ ["Offline (#{length(offline)}):"] ++ offline_lines
      else
        lines
      end

    if Enum.empty?(lines) do
      "Your friends list is empty."
    else
      "Friends (#{length(friend_ids)}):\n" <> Enum.join(lines, "\n")
    end
  end

  defp format_requests([], []) do
    "You have no pending friend requests."
  end

  defp format_requests(incoming, outgoing) do
    lines = []

    lines =
      if Enum.any?(incoming) do
        in_names = Enum.map(incoming, &get_player_name/1)
        lines ++ ["Incoming requests:"] ++ Enum.map(in_names, &"  #{&1}")
      else
        lines
      end

    lines =
      if Enum.any?(outgoing) do
        out_names = Enum.map(outgoing, &get_player_name/1)
        lines ++ ["Pending sent requests:"] ++ Enum.map(out_names, &"  #{&1}")
      else
        lines
      end

    Enum.join(lines, "\n")
  end

  defp get_friend_info(player_id) do
    case find_player_by_id(player_id) do
      {:ok, player} ->
        %{
          name: Map.get(player, :name, "Unknown"),
          online: is_online?(player_id)
        }

      _ ->
        %{name: "Unknown", online: false}
    end
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

  defp is_online?(player_id) do
    Loka.Session.Registry.online?(player_id)
  end

  defp get_actor_name(context) do
    actor = Map.get(context, :actor, %{})
    Map.get(actor, :name, "Someone")
  end

  defp get_relationships(%{stats: stats}) do
    Map.get(stats, :relationships, %{})
  end

  defp get_relationships(_), do: %{}
end
