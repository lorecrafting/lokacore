defmodule Exmud.DemoGame.PlayerGameState do
  @moduledoc """
  Manages player game state for the demo game.

  This schema stores all player-specific game data including inventory,
  equipment, quest progress, flags, stats, and health. Each player has
  exactly one game state record.

  ## Schema Fields

  - `player_id` - References the player account
  - `inventory` - List of item IDs the player is carrying
  - `equipment` - Map of equipped items by slot (weapon, armor, accessory)
  - `quests` - Map of quest progress keyed by quest_id
  - `flags` - Map of boolean/value flags for game state tracking
  - `stats` - Player stats (str, dex, sta, level, xp)
  - `health` - Current and max health values
  - `current_room_id` - The room entity the player is currently in
  """

  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias Exmud.Repo
  alias __MODULE__

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @default_inventory []
  @default_equipment %{weapon: nil, armor: nil, accessory: nil}
  @default_quests %{}
  @default_flags %{}
  @default_stats %{str: 10, dex: 10, sta: 10, level: 1, xp: 0}
  @default_health %{current: 100, max: 100}

  schema "player_game_states" do
    field :player_id, :id
    field :inventory, Exmud.Ecto.Json, default: @default_inventory
    field :equipment, Exmud.Ecto.Json, default: @default_equipment
    field :quests, Exmud.Ecto.Json, default: @default_quests
    field :flags, Exmud.Ecto.Json, default: @default_flags
    field :stats, Exmud.Ecto.Json, default: @default_stats
    field :health, Exmud.Ecto.Json, default: @default_health
    field :current_room_id, :binary_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Creates a changeset for a player game state.
  """
  def changeset(state, attrs) do
    state
    |> cast(attrs, [
      :player_id,
      :inventory,
      :equipment,
      :quests,
      :flags,
      :stats,
      :health,
      :current_room_id
    ])
    |> validate_required([:player_id])
    |> unique_constraint(:player_id)
  end

  @doc """
  Gets the game state for a player.

  Returns `nil` if no state exists yet.

  ## Examples

      iex> get_state(player_id)
      %PlayerGameState{...}

      iex> get_state(unknown_id)
      nil
  """
  def get_state(player_id) do
    Repo.one(from s in PlayerGameState, where: s.player_id == ^player_id)
  end

  @doc """
  Gets the game state for a player, creating a default one if it doesn't exist.

  ## Examples

      iex> get_or_create_state(player_id)
      {:ok, %PlayerGameState{...}}
  """
  def get_or_create_state(player_id) do
    case get_state(player_id) do
      nil -> create_state(player_id)
      state -> {:ok, state}
    end
  end

  @doc """
  Creates a new game state for a player with default values.

  ## Examples

      iex> create_state(player_id)
      {:ok, %PlayerGameState{}}

      iex> create_state(player_id) # duplicate
      {:error, %Ecto.Changeset{}}
  """
  def create_state(player_id) do
    %PlayerGameState{}
    |> changeset(%{player_id: player_id})
    |> Repo.insert()
  end

  @doc """
  Updates a player's game state.

  Can accept either a `PlayerGameState` struct or a `player_id`.
  When given a player_id, creates a default state if one doesn't exist.

  ## Examples

      iex> update_state(state, %{inventory: ["sword_01"]})
      {:ok, %PlayerGameState{}}

      iex> update_state(player_id, %{health: %{current: 50, max: 100}})
      {:ok, %PlayerGameState{}}
  """
  def update_state(state_or_player_id, attrs)

  def update_state(%PlayerGameState{} = state, attrs) do
    state
    |> changeset(attrs)
    |> Repo.update()
  end

  def update_state(player_id, attrs) when is_integer(player_id) or is_binary(player_id) do
    case get_or_create_state(player_id) do
      {:ok, state} -> update_state(state, attrs)
      error -> error
    end
  end

  @doc """
  Deletes a player's game state.

  Can accept either a `PlayerGameState` struct or a `player_id`.
  """
  def delete_state(state_or_player_id)

  def delete_state(%PlayerGameState{} = state) do
    Repo.delete(state)
  end

  def delete_state(player_id) do
    case get_state(player_id) do
      nil -> {:error, :not_found}
      state -> delete_state(state)
    end
  end

  @doc """
  Gets all players currently in a specific room.

  Returns a list of player_ids for players whose current_room_id matches.
  Optionally excludes a specific player_id (useful for excluding yourself).

  ## Examples

      iex> get_players_in_room(room_id)
      [player_id1, player_id2, ...]

      iex> get_players_in_room(room_id, exclude: my_player_id)
      [player_id1, player_id2, ...]
  """
  def get_players_in_room(room_id, opts \\ []) do
    exclude_player_id = Keyword.get(opts, :exclude)

    query =
      from s in PlayerGameState,
        where: s.current_room_id == ^room_id,
        select: s.player_id

    query =
      if exclude_player_id do
        from s in query, where: s.player_id != ^exclude_player_id
      else
        query
      end

    Repo.all(query)
  end
end
