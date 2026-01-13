defmodule Loka.Framework.Social.Party do
  @moduledoc """
  Represents a temporary player group (party).

  Parties allow players to form groups for:
  - Party chat
  - Group content (future: shared XP, loot distribution)
  - Coordination during gameplay

  ## Party Structure

  Each party has:
  - A leader who can invite/kick/promote
  - Members (up to 6 total including leader)
  - Creation timestamp

  ## Usage

      # Create party struct
      party = Party.new(leader_id)

      # Add member
      {:ok, party} = Party.add_member(party, player_id)

      # Remove member
      {:ok, party} = Party.remove_member(party, player_id)
  """

  @max_size 6

  @type t :: %__MODULE__{
          id: String.t(),
          leader: String.t(),
          members: MapSet.t(String.t()),
          invites: MapSet.t(String.t()),
          created_at: DateTime.t()
        }

  defstruct [
    :id,
    :leader,
    members: MapSet.new(),
    invites: MapSet.new(),
    created_at: nil
  ]

  @doc """
  Creates a new party with the given leader.
  """
  def new(leader_id) do
    %__MODULE__{
      id: generate_id(),
      leader: leader_id,
      members: MapSet.new([leader_id]),
      invites: MapSet.new(),
      created_at: DateTime.utc_now()
    }
  end

  @doc """
  Returns the maximum party size.
  """
  def max_size, do: @max_size

  @doc """
  Checks if the party is full.
  """
  def full?(%__MODULE__{members: members}) do
    MapSet.size(members) >= @max_size
  end

  @doc """
  Checks if a player is the party leader.
  """
  def leader?(%__MODULE__{leader: leader}, player_id) do
    leader == player_id
  end

  @doc """
  Checks if a player is a member of the party.
  """
  def member?(%__MODULE__{members: members}, player_id) do
    MapSet.member?(members, player_id)
  end

  @doc """
  Checks if a player has a pending invite to this party.
  """
  def invited?(%__MODULE__{invites: invites}, player_id) do
    MapSet.member?(invites, player_id)
  end

  @doc """
  Returns the list of member IDs.
  """
  def member_list(%__MODULE__{members: members}) do
    MapSet.to_list(members)
  end

  @doc """
  Returns the member count.
  """
  def size(%__MODULE__{members: members}) do
    MapSet.size(members)
  end

  @doc """
  Invites a player to the party.
  """
  def invite(%__MODULE__{} = party, player_id) do
    cond do
      full?(party) ->
        {:error, :party_full}

      member?(party, player_id) ->
        {:error, :already_member}

      invited?(party, player_id) ->
        {:error, :already_invited}

      true ->
        {:ok, %{party | invites: MapSet.put(party.invites, player_id)}}
    end
  end

  @doc """
  Cancels a pending invite.
  """
  def cancel_invite(%__MODULE__{} = party, player_id) do
    {:ok, %{party | invites: MapSet.delete(party.invites, player_id)}}
  end

  @doc """
  Adds a member to the party (typically after accepting invite).
  """
  def add_member(%__MODULE__{} = party, player_id) do
    cond do
      full?(party) ->
        {:error, :party_full}

      member?(party, player_id) ->
        {:error, :already_member}

      true ->
        party =
          party
          |> Map.update!(:members, &MapSet.put(&1, player_id))
          |> Map.update!(:invites, &MapSet.delete(&1, player_id))

        {:ok, party}
    end
  end

  @doc """
  Removes a member from the party.

  Returns `{:ok, party}` if member removed, or `{:disband}` if party should
  be disbanded (leader left and no one to promote, or last member left).
  """
  def remove_member(%__MODULE__{} = party, player_id) do
    cond do
      not member?(party, player_id) ->
        {:error, :not_member}

      size(party) == 1 ->
        {:disband}

      leader?(party, player_id) ->
        # Leader leaving - promote next member
        remaining = MapSet.delete(party.members, player_id)
        new_leader = remaining |> MapSet.to_list() |> List.first()

        party = %{party | members: remaining, leader: new_leader}
        {:ok, party, {:promoted, new_leader}}

      true ->
        party = %{party | members: MapSet.delete(party.members, player_id)}
        {:ok, party}
    end
  end

  @doc """
  Promotes a member to party leader.
  """
  def promote(%__MODULE__{} = party, player_id, by_player_id) do
    cond do
      not leader?(party, by_player_id) ->
        {:error, :not_leader}

      not member?(party, player_id) ->
        {:error, :not_member}

      player_id == by_player_id ->
        {:error, :already_leader}

      true ->
        {:ok, %{party | leader: player_id}}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp generate_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end
end
