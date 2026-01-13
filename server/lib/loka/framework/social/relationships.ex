defmodule Loka.Framework.Social.Relationships do
  @moduledoc """
  Manages player relationships: friends, blocks, and trust levels.

  Relationships are stored in the player's game state and persisted with their save.

  ## Data Model

      %{
        relationships: %{
          friends: ["player_123", "player_456"],
          friend_requests_in: ["player_789"],    # Incoming requests
          friend_requests_out: ["player_012"],   # Outgoing requests
          blocked: ["player_999"]
        }
      }

  ## Friendship Rules

  - Friendships are mutual - both players must accept
  - Adding a friend sends a request
  - Accepting a request creates mutual friendship
  - Removing a friend removes from both players' lists

  ## Block Effects

  - Blocked players cannot send you tells
  - Blocked players' emotes targeting you are hidden
  - Blocked players are hidden from your who list
  - You are hidden from blocked players' who lists
  """

  alias Loka.Framework.Player.GameState
  alias Loka.Utils.MapHelpers

  # =============================================================================
  # Friend Management
  # =============================================================================

  @doc """
  Gets the list of friend player IDs.
  """
  def get_friends(%GameState{} = game_state) do
    get_relationship_list(game_state, :friends)
  end

  @doc """
  Gets incoming friend requests.
  """
  def get_friend_requests_in(%GameState{} = game_state) do
    get_relationship_list(game_state, :friend_requests_in)
  end

  @doc """
  Gets outgoing friend requests.
  """
  def get_friend_requests_out(%GameState{} = game_state) do
    get_relationship_list(game_state, :friend_requests_out)
  end

  @doc """
  Checks if a player is a friend.
  """
  def is_friend?(%GameState{} = game_state, player_id) do
    player_id in get_friends(game_state)
  end

  @doc """
  Sends a friend request to another player.

  Returns `{:ok, updated_state}` or `{:error, reason}`.
  """
  def send_friend_request(%GameState{} = game_state, target_id) do
    cond do
      is_friend?(game_state, target_id) ->
        {:error, :already_friends}

      target_id in get_friend_requests_out(game_state) ->
        {:error, :already_requested}

      is_blocked?(game_state, target_id) ->
        {:error, :blocked}

      true ->
        updated = add_to_relationship_list(game_state, :friend_requests_out, target_id)
        {:ok, updated}
    end
  end

  @doc """
  Receives a friend request from another player.

  Called when another player sends us a request.
  """
  def receive_friend_request(%GameState{} = game_state, from_id) do
    if is_blocked?(game_state, from_id) do
      {:error, :blocked}
    else
      # If we already sent them a request, auto-accept
      if from_id in get_friend_requests_out(game_state) do
        accept_friend_request(game_state, from_id)
      else
        updated = add_to_relationship_list(game_state, :friend_requests_in, from_id)
        {:ok, updated}
      end
    end
  end

  @doc """
  Accepts a friend request.

  Adds the player to friends and removes from requests.
  """
  def accept_friend_request(%GameState{} = game_state, from_id) do
    if from_id in get_friend_requests_in(game_state) ||
         from_id in get_friend_requests_out(game_state) do
      updated =
        game_state
        |> add_to_relationship_list(:friends, from_id)
        |> remove_from_relationship_list(:friend_requests_in, from_id)
        |> remove_from_relationship_list(:friend_requests_out, from_id)

      {:ok, updated}
    else
      {:error, :no_request}
    end
  end

  @doc """
  Declines a friend request.
  """
  def decline_friend_request(%GameState{} = game_state, from_id) do
    updated = remove_from_relationship_list(game_state, :friend_requests_in, from_id)
    {:ok, updated}
  end

  @doc """
  Removes a friend.
  """
  def remove_friend(%GameState{} = game_state, friend_id) do
    if is_friend?(game_state, friend_id) do
      updated = remove_from_relationship_list(game_state, :friends, friend_id)
      {:ok, updated}
    else
      {:error, :not_friends}
    end
  end

  # =============================================================================
  # Block Management
  # =============================================================================

  @doc """
  Gets the list of blocked player IDs.
  """
  def get_blocked(%GameState{} = game_state) do
    get_relationship_list(game_state, :blocked)
  end

  @doc """
  Checks if a player is blocked.
  """
  def is_blocked?(%GameState{} = game_state, player_id) do
    player_id in get_blocked(game_state)
  end

  @doc """
  Blocks a player.

  Also removes them from friends if they were friends.
  """
  def block(%GameState{} = game_state, player_id) do
    if is_blocked?(game_state, player_id) do
      {:error, :already_blocked}
    else
      updated =
        game_state
        |> add_to_relationship_list(:blocked, player_id)
        |> remove_from_relationship_list(:friends, player_id)
        |> remove_from_relationship_list(:friend_requests_in, player_id)
        |> remove_from_relationship_list(:friend_requests_out, player_id)

      {:ok, updated}
    end
  end

  @doc """
  Unblocks a player.
  """
  def unblock(%GameState{} = game_state, player_id) do
    if is_blocked?(game_state, player_id) do
      updated = remove_from_relationship_list(game_state, :blocked, player_id)
      {:ok, updated}
    else
      {:error, :not_blocked}
    end
  end

  # =============================================================================
  # Filtering Helpers
  # =============================================================================

  @doc """
  Checks if a player should be hidden from the who list.

  Returns true if either player has blocked the other.
  """
  def should_hide_from_who?(%GameState{} = my_state, their_id, their_blocked_list) do
    is_blocked?(my_state, their_id) || my_state.player_id in their_blocked_list
  end

  @doc """
  Checks if a player can send tells to another.

  Returns true if the sender is not blocked by the recipient.
  """
  def can_send_tell?(%GameState{} = recipient_state, sender_id) do
    not is_blocked?(recipient_state, sender_id)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_relationships(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :relationships, %{
      friends: [],
      friend_requests_in: [],
      friend_requests_out: [],
      blocked: []
    })
  end

  defp put_relationships(%GameState{stats: stats} = game_state, relationships) do
    %{game_state | stats: Map.put(stats, :relationships, relationships)}
  end

  defp get_relationship_list(game_state, key) do
    relationships = get_relationships(game_state)
    Map.get(relationships, key, [])
  end

  defp add_to_relationship_list(game_state, key, player_id) do
    relationships = get_relationships(game_state)
    current_list = Map.get(relationships, key, [])

    if player_id in current_list do
      game_state
    else
      updated_list = [player_id | current_list]
      updated_relationships = Map.put(relationships, key, updated_list)
      put_relationships(game_state, updated_relationships)
    end
  end

  defp remove_from_relationship_list(game_state, key, player_id) do
    relationships = get_relationships(game_state)
    current_list = Map.get(relationships, key, [])
    updated_list = List.delete(current_list, player_id)
    updated_relationships = Map.put(relationships, key, updated_list)
    put_relationships(game_state, updated_relationships)
  end
end
