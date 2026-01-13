defmodule Loka.Framework.Social.PartyManager do
  @moduledoc """
  GenServer managing player parties.

  Holds all active parties in memory and handles:
  - Party creation/disbanding
  - Invites (send/accept/decline)
  - Membership (join/leave/kick)
  - Leadership (promote)

  ## Usage

      # Create a party
      {:ok, party} = PartyManager.create(leader_id)

      # Invite a player
      :ok = PartyManager.invite(party_id, target_id, inviter_id)

      # Accept invite
      :ok = PartyManager.accept(player_id)

      # Leave party
      :ok = PartyManager.leave(player_id)

  ## Integration

  Works with ScopedMessage/MessageRouter for party chat.
  """

  use GenServer
  require Logger

  alias Loka.Framework.Social.Party

  @name __MODULE__
  @invite_timeout_ms 60_000

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the PartyManager.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: @name)
  end

  @doc """
  Creates a new party with the given player as leader.
  """
  def create(leader_id) do
    GenServer.call(@name, {:create, leader_id})
  end

  @doc """
  Gets a player's current party.
  """
  def get_party(player_id) do
    GenServer.call(@name, {:get_party, player_id})
  end

  @doc """
  Invites a player to the invoker's party.
  """
  def invite(target_id, inviter_id) do
    GenServer.call(@name, {:invite, target_id, inviter_id})
  end

  @doc """
  Accepts a pending party invite.
  """
  def accept(player_id) do
    GenServer.call(@name, {:accept, player_id})
  end

  @doc """
  Declines a pending party invite.
  """
  def decline(player_id) do
    GenServer.call(@name, {:decline, player_id})
  end

  @doc """
  Leaves the current party.
  """
  def leave(player_id) do
    GenServer.call(@name, {:leave, player_id})
  end

  @doc """
  Kicks a player from the party (leader only).
  """
  def kick(target_id, leader_id) do
    GenServer.call(@name, {:kick, target_id, leader_id})
  end

  @doc """
  Promotes a member to party leader.
  """
  def promote(target_id, leader_id) do
    GenServer.call(@name, {:promote, target_id, leader_id})
  end

  @doc """
  Disbands the party (leader only).
  """
  def disband(leader_id) do
    GenServer.call(@name, {:disband, leader_id})
  end

  @doc """
  Gets members of a party by party ID.
  """
  def get_members(party_id) do
    GenServer.call(@name, {:get_members, party_id})
  end

  @doc """
  Gets the party ID for a player.
  """
  def get_party_id(player_id) do
    GenServer.call(@name, {:get_party_id, player_id})
  end

  @doc """
  Checks if a player has a pending invite.
  """
  def has_pending_invite?(player_id) do
    GenServer.call(@name, {:has_pending_invite, player_id})
  end

  # =============================================================================
  # Server Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    Logger.info("[PartyManager] Starting")

    state = %{
      # party_id => Party struct
      parties: %{},
      # player_id => party_id (for quick lookup)
      player_parties: %{},
      # player_id => {party_id, expires_at} (pending invites)
      invites: %{}
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:create, leader_id}, _from, state) do
    # Check if player already in a party
    if Map.has_key?(state.player_parties, leader_id) do
      {:reply, {:error, :already_in_party}, state}
    else
      party = Party.new(leader_id)

      new_state =
        state
        |> put_in([:parties, party.id], party)
        |> put_in([:player_parties, leader_id], party.id)

      {:reply, {:ok, party}, new_state}
    end
  end

  def handle_call({:get_party, player_id}, _from, state) do
    case Map.get(state.player_parties, player_id) do
      nil ->
        {:reply, {:error, :not_in_party}, state}

      party_id ->
        party = Map.get(state.parties, party_id)
        {:reply, {:ok, party}, state}
    end
  end

  def handle_call({:get_party_id, player_id}, _from, state) do
    {:reply, Map.get(state.player_parties, player_id), state}
  end

  def handle_call({:invite, target_id, inviter_id}, _from, state) do
    with {:ok, party_id} <- get_player_party(state, inviter_id),
         party <- Map.get(state.parties, party_id),
         true <- Party.leader?(party, inviter_id) || {:error, :not_leader},
         nil <- Map.get(state.player_parties, target_id) || {:error, :target_in_party},
         {:ok, updated_party} <- Party.invite(party, target_id) do
      expires_at = System.system_time(:millisecond) + @invite_timeout_ms

      new_state =
        state
        |> put_in([:parties, party_id], updated_party)
        |> put_in([:invites, target_id], {party_id, expires_at})

      {:reply, :ok, new_state}
    else
      {:error, reason} -> {:reply, {:error, reason}, state}
      false -> {:reply, {:error, :not_leader}, state}
    end
  end

  def handle_call({:accept, player_id}, _from, state) do
    case Map.get(state.invites, player_id) do
      nil ->
        {:reply, {:error, :no_invite}, state}

      {party_id, expires_at} ->
        if System.system_time(:millisecond) > expires_at do
          # Invite expired
          new_state = remove_invite(state, player_id)
          {:reply, {:error, :invite_expired}, new_state}
        else
          party = Map.get(state.parties, party_id)

          if party do
            case Party.add_member(party, player_id) do
              {:ok, updated_party} ->
                new_state =
                  state
                  |> put_in([:parties, party_id], updated_party)
                  |> put_in([:player_parties, player_id], party_id)
                  |> remove_invite(player_id)

                {:reply, {:ok, updated_party}, new_state}

              {:error, reason} ->
                {:reply, {:error, reason}, state}
            end
          else
            # Party disbanded
            new_state = remove_invite(state, player_id)
            {:reply, {:error, :party_disbanded}, new_state}
          end
        end
    end
  end

  def handle_call({:decline, player_id}, _from, state) do
    case Map.get(state.invites, player_id) do
      nil ->
        {:reply, {:error, :no_invite}, state}

      {party_id, _expires_at} ->
        party = Map.get(state.parties, party_id)
        new_state = remove_invite(state, player_id)

        if party do
          {:ok, updated_party} = Party.cancel_invite(party, player_id)
          new_state = put_in(new_state, [:parties, party_id], updated_party)
          {:reply, :ok, new_state}
        else
          {:reply, :ok, new_state}
        end
    end
  end

  def handle_call({:leave, player_id}, _from, state) do
    case Map.get(state.player_parties, player_id) do
      nil ->
        {:reply, {:error, :not_in_party}, state}

      party_id ->
        party = Map.get(state.parties, party_id)
        handle_member_removal(state, party, party_id, player_id)
    end
  end

  def handle_call({:kick, target_id, leader_id}, _from, state) do
    with {:ok, party_id} <- get_player_party(state, leader_id),
         party <- Map.get(state.parties, party_id),
         true <- Party.leader?(party, leader_id) || {:error, :not_leader},
         true <- target_id != leader_id || {:error, :cannot_kick_self},
         true <- Party.member?(party, target_id) || {:error, :not_member} do
      handle_member_removal(state, party, party_id, target_id)
    else
      {:error, reason} -> {:reply, {:error, reason}, state}
      false -> {:reply, {:error, :invalid_operation}, state}
    end
  end

  def handle_call({:promote, target_id, leader_id}, _from, state) do
    with {:ok, party_id} <- get_player_party(state, leader_id),
         party <- Map.get(state.parties, party_id),
         {:ok, updated_party} <- Party.promote(party, target_id, leader_id) do
      new_state = put_in(state, [:parties, party_id], updated_party)
      {:reply, {:ok, updated_party}, new_state}
    else
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  def handle_call({:disband, leader_id}, _from, state) do
    case Map.get(state.player_parties, leader_id) do
      nil ->
        {:reply, {:error, :not_in_party}, state}

      party_id ->
        party = Map.get(state.parties, party_id)

        if Party.leader?(party, leader_id) do
          members = Party.member_list(party)
          new_state = disband_party(state, party_id, members)
          {:reply, {:ok, members}, new_state}
        else
          {:reply, {:error, :not_leader}, state}
        end
    end
  end

  def handle_call({:get_members, party_id}, _from, state) do
    case Map.get(state.parties, party_id) do
      nil -> {:reply, {:error, :party_not_found}, state}
      party -> {:reply, {:ok, Party.member_list(party)}, state}
    end
  end

  def handle_call({:has_pending_invite, player_id}, _from, state) do
    has_invite = Map.has_key?(state.invites, player_id)
    {:reply, has_invite, state}
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_player_party(state, player_id) do
    case Map.get(state.player_parties, player_id) do
      nil -> {:error, :not_in_party}
      party_id -> {:ok, party_id}
    end
  end

  defp handle_member_removal(state, party, party_id, player_id) do
    case Party.remove_member(party, player_id) do
      {:disband} ->
        members = Party.member_list(party)
        new_state = disband_party(state, party_id, members)
        {:reply, {:ok, :disbanded}, new_state}

      {:ok, updated_party, {:promoted, new_leader}} ->
        new_state =
          state
          |> put_in([:parties, party_id], updated_party)
          |> Map.update!(:player_parties, &Map.delete(&1, player_id))

        {:reply, {:ok, :left, {:promoted, new_leader}}, new_state}

      {:ok, updated_party} ->
        new_state =
          state
          |> put_in([:parties, party_id], updated_party)
          |> Map.update!(:player_parties, &Map.delete(&1, player_id))

        {:reply, {:ok, :left}, new_state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  defp disband_party(state, party_id, members) do
    state
    |> Map.update!(:parties, &Map.delete(&1, party_id))
    |> Map.update!(:player_parties, fn pp ->
      Enum.reduce(members, pp, fn member_id, acc ->
        Map.delete(acc, member_id)
      end)
    end)
  end

  defp remove_invite(state, player_id) do
    Map.update!(state, :invites, &Map.delete(&1, player_id))
  end
end
