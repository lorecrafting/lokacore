defmodule Loka.Framework.Player.GameState do
  @moduledoc """
  Manages player game state for the game framework.

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

  alias Loka.Repo
  alias Loka.Engine.Constants.EquipmentSlots
  alias __MODULE__

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @default_inventory []
  @default_equipment EquipmentSlots.default_equipment()
  @default_quests %{}
  @default_flags %{}
  @default_stats %{str: 10, dex: 10, sta: 10, level: 1, xp: 0, skill_points: 0}
  @default_health %{current: 100, max: 100}
  @default_resources %{
    health: %{current: 100, max: 100},
    mana: %{current: 100, max: 100},
    mv: %{current: 150, max: 150}
  }
  @default_skills %{}
  @default_settings %{
    # Accessibility settings
    reduced_motion: false,
    high_contrast: false,
    font_size: "normal",
    # Combat settings
    auto_combat: false
  }

  schema "player_game_states" do
    field :player_id, :id
    # Character identity fields
    field :character_name, :string
    field :gender, :string
    field :background, :string
    # Game state fields
    field :inventory, Loka.Ecto.Json, default: @default_inventory
    field :equipment, Loka.Ecto.Json, default: @default_equipment
    field :quests, Loka.Ecto.Json, default: @default_quests
    field :flags, Loka.Ecto.Json, default: @default_flags
    field :stats, Loka.Ecto.Json, default: @default_stats
    field :health, Loka.Ecto.Json, default: @default_health
    field :resources, Loka.Ecto.Json, default: @default_resources
    field :skills, Loka.Ecto.Json, default: @default_skills
    field :settings, Loka.Ecto.Json, default: @default_settings
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
      :character_name,
      :gender,
      :background,
      :inventory,
      :equipment,
      :quests,
      :flags,
      :stats,
      :health,
      :resources,
      :skills,
      :settings,
      :current_room_id
    ])
    |> validate_required([:player_id])
    |> unique_constraint(:player_id)
  end

  @doc """
  Creates a changeset for character creation.
  Validates character name, gender, and background.
  Also sets the starting room.
  """
  def character_creation_changeset(state, attrs) do
    state
    |> cast(attrs, [:character_name, :gender, :background])
    |> validate_required([:character_name, :gender, :background])
    |> validate_length(:character_name, min: 2, max: 20)
    |> validate_format(:character_name, ~r/^[A-Za-z]+$/, message: "must contain only letters")
    |> validate_inclusion(:gender, ["he/him", "she/her", "they/them"])
    |> validate_inclusion(:background, ["scholar", "pilgrim", "soldier", "acolyte"])
    |> unsafe_validate_unique(:character_name, Loka.Repo,
      message: "has already been taken by another character"
    )
    |> unique_constraint(:character_name,
      name: :player_game_states_character_name_unique_index,
      message: "has already been taken by another character"
    )
    |> apply_background_bonuses()
    |> set_starting_room()
    |> set_starting_quest()
  end

  defp apply_background_bonuses(changeset) do
    case get_change(changeset, :background) do
      nil ->
        changeset

      background ->
        bonus = background_stat_bonus(background)
        current_stats = get_field(changeset, :stats) || @default_stats
        new_stats = Map.update(current_stats, bonus.stat, 12, &(&1 + 2))
        put_change(changeset, :stats, new_stats)
    end
  end

  defp set_starting_room(changeset) do
    # Only set the starting room if the changeset is valid (has all required fields)
    # and a starting room exists (it may not in tests where the world isn't loaded)
    if changeset.valid? do
      case Loka.Framework.World.Room.get_starting_room_id() do
        nil -> changeset
        starting_room_id -> put_change(changeset, :current_room_id, starting_room_id)
      end
    else
      changeset
    end
  end

  @starting_quest_id "intro_welcome"

  defp set_starting_quest(changeset) do
    # Only set the starting quest if the changeset is valid
    # and quest definitions are loaded (they may not be in tests)
    if changeset.valid? do
      case Loka.Framework.Quest.Definitions.get_quest_definition(@starting_quest_id) do
        nil ->
          changeset

        quest_def ->
          # Initialize objectives with default progress
          objectives =
            quest_def.objectives
            |> Enum.map(fn obj -> {obj.id, %{"completed" => false, "progress" => 0}} end)
            |> Map.new()

          # Build the quest progress structure
          quest_progress = %{
            "objectives" => objectives,
            "accepted_at" => DateTime.utc_now()
          }

          # Add to quests field
          current_quests = get_field(changeset, :quests) || %{}
          active = Map.get(current_quests, "active", %{})
          new_active = Map.put(active, @starting_quest_id, quest_progress)
          new_quests = Map.put(current_quests, "active", new_active)

          put_change(changeset, :quests, new_quests)
      end
    else
      changeset
    end
  end

  @doc """
  Returns the stat bonus for a given background.
  """
  def background_stat_bonus("scholar"),
    do: %{stat: :dex, name: "Dexterity", description: "Precise hands from years of calligraphy"}

  def background_stat_bonus("pilgrim"),
    do: %{stat: :sta, name: "Stamina", description: "Endurance from long journeys"}

  def background_stat_bonus("soldier"),
    do: %{stat: :str, name: "Strength", description: "Trained in martial combat"}

  def background_stat_bonus("acolyte"),
    do: %{stat: :sta, name: "Stamina", description: "Disciplined through meditation"}

  def background_stat_bonus(_), do: %{stat: :sta, name: "Stamina", description: ""}

  @doc """
  Returns all available backgrounds with their descriptions.
  """
  def available_backgrounds do
    [
      %{
        id: "scholar",
        name: "Wandering Scholar",
        description:
          "You spent years studying ancient texts and practicing calligraphy. Your precise hands serve you well.",
        bonus: "+2 Dexterity"
      },
      %{
        id: "pilgrim",
        name: "Mountain Pilgrim",
        description:
          "The long journey to sacred peaks has hardened your body against fatigue and hardship.",
        bonus: "+2 Stamina"
      },
      %{
        id: "soldier",
        name: "Former Soldier",
        description:
          "Years of training with sword and spear have given you strength beyond most.",
        bonus: "+2 Strength"
      },
      %{
        id: "acolyte",
        name: "Temple Acolyte",
        description:
          "Raised in the temple, your body is tempered by years of discipline and meditation.",
        bonus: "+2 Stamina"
      }
    ]
  end

  @doc """
  Checks if a game state has completed character creation.
  """
  def character_created?(%__MODULE__{character_name: name}) when is_binary(name) and name != "",
    do: true

  def character_created?(_), do: false

  @doc """
  Normalizes a game state to ensure health is in resources.

  This migrates old states that have a separate `health` field to the
  unified resources system where health is `resources.health`.

  ## Migration Logic

  - If `resources.health` exists, use it (new format)
  - If `health` exists but `resources.health` doesn't, copy health to resources
  - Updates both atom and string key formats

  ## Examples

      # Old format
      %GameState{health: %{current: 80, max: 100}, resources: %{mana: ...}}

      # After normalization
      %GameState{health: %{current: 80, max: 100}, resources: %{health: %{current: 80, max: 100}, mana: ...}}
  """
  def normalize_state(nil), do: nil

  def normalize_state(%GameState{} = state) do
    current_resources = state.resources || @default_resources
    current_health = state.health || @default_health

    # Check if resources already has health (new format)
    has_health_in_resources =
      Map.has_key?(current_resources, :health) or Map.has_key?(current_resources, "health")

    if has_health_in_resources do
      # Already normalized, just return
      state
    else
      # Migrate: copy health into resources
      # Normalize health to atom keys for consistency
      normalized_health = %{
        current: current_health["current"] || current_health[:current] || 100,
        max: current_health["max"] || current_health[:max] || 100
      }

      new_resources = Map.put(current_resources, :health, normalized_health)
      %{state | resources: new_resources}
    end
  end

  @doc """
  Gets health from the unified resources system.

  Returns the health map from `resources.health`, falling back to `health` field
  for backwards compatibility.
  """
  def get_health(%GameState{} = state) do
    resources = state.resources || @default_resources
    health_from_resources = resources[:health] || resources["health"]

    cond do
      health_from_resources -> health_from_resources
      state.health -> state.health
      true -> @default_health
    end
  end

  @doc """
  Updates health in the unified resources system.

  Updates both `resources.health` and the legacy `health` field for
  backwards compatibility with existing code and database records.

  ## Examples

      {:ok, state} = GameState.set_health(state, %{current: 80, max: 100})
  """
  def set_health(%GameState{} = state, new_health) when is_map(new_health) do
    current_resources = state.resources || @default_resources

    # Normalize to atom keys
    normalized_health = %{
      current: new_health["current"] || new_health[:current] || 100,
      max: new_health["max"] || new_health[:max] || 100
    }

    new_resources = Map.put(current_resources, :health, normalized_health)

    # Update both resources.health and health field for backwards compat
    update_state(state, %{
      resources: new_resources,
      health: normalized_health
    })
  end

  @doc """
  Calculates the maximum resources based on player stats.
  Returns updated resources with correct max values.

  Note: Health is now part of resources, not a separate field.
  """
  def calculate_max_resources(game_state) do
    stats = game_state.stats || @default_stats
    level = stats["level"] || stats[:level] || 1
    sta = stats["sta"] || stats[:sta] || 10
    dex = stats["dex"] || stats[:dex] || 10

    # Calculate max values based on stats
    max_health = 100 + sta * 10 + (level - 1) * 15
    max_mana = 50 + sta * 2 + level * 10
    max_mv = 100 + sta * 5 + dex * 2

    current_resources = game_state.resources || @default_resources

    # Get current health from resources (new) or health field (legacy)
    current_health =
      current_resources[:health] || current_resources["health"] ||
        game_state.health || @default_health

    %{
      resources: %{
        health: %{
          current:
            min(current_health["current"] || current_health[:current] || max_health, max_health),
          max: max_health
        },
        mana: %{
          current:
            min(
              get_in(current_resources, [:mana, :current]) ||
                get_in(current_resources, ["mana", "current"]) || max_mana,
              max_mana
            ),
          max: max_mana
        },
        mv: %{
          current:
            min(
              get_in(current_resources, [:mv, :current]) ||
                get_in(current_resources, ["mv", "current"]) || max_mv,
              max_mv
            ),
          max: max_mv
        }
      }
    }
  end

  @doc """
  Gets the equipment slot mappings for LegendMUD-style slots.
  """
  defdelegate equipment_slots, to: EquipmentSlots, as: :slot_metadata

  @doc """
  Gets the game state for a player.

  Returns `nil` if no state exists yet.

  ## Examples

      iex> get_state(player_id)
      %GameState{...}

      iex> get_state(unknown_id)
      nil
  """
  def get_state(player_id) do
    player_id
    |> (fn id -> from(s in GameState, where: s.player_id == ^id) end).()
    |> Repo.one()
    |> normalize_state()
  end

  @doc """
  Gets the game state for a player, creating a default one if it doesn't exist.

  ## Examples

      iex> get_or_create_state(player_id)
      {:ok, %GameState{...}}
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
      {:ok, %GameState{}}

      iex> create_state(player_id) # duplicate
      {:error, %Ecto.Changeset{}}
  """
  def create_state(player_id) do
    %GameState{}
    |> changeset(%{player_id: player_id})
    |> Repo.insert()
  end

  @doc """
  Updates a player's game state.

  Can accept either a `GameState` struct or a `player_id`.
  When given a player_id, creates a default state if one doesn't exist.

  ## Examples

      iex> update_state(state, %{inventory: ["sword_01"]})
      {:ok, %GameState{}}

      iex> update_state(player_id, %{health: %{current: 50, max: 100}})
      {:ok, %GameState{}}
  """
  def update_state(state_or_player_id, attrs)

  def update_state(%GameState{} = state, attrs) do
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

  Can accept either a `GameState` struct or a `player_id`.
  """
  def delete_state(state_or_player_id)

  def delete_state(%GameState{} = state) do
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
      from s in GameState,
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

  @doc """
  Gets all players in a room with their account info in a single query.

  Returns a list of maps with %{id: player_id, name: display_name}.
  Optionally excludes a specific player_id.

  This avoids the N+1 query pattern by doing a JOIN instead of
  separate queries for each player.

  ## Examples

      iex> get_players_in_room_with_info(room_id)
      [%{id: "uuid1", name: "Alice"}, %{id: "uuid2", name: "Bob"}]

      iex> get_players_in_room_with_info(room_id, exclude: my_player_id)
      [%{id: "uuid1", name: "Alice"}]
  """
  def get_players_in_room_with_info(room_id, opts \\ []) do
    exclude_player_id = Keyword.get(opts, :exclude)

    query =
      from gs in GameState,
        join: p in "players",
        on: gs.player_id == p.id,
        where: gs.current_room_id == ^room_id,
        select: %{
          id: p.id,
          email: p.email,
          character_name: gs.character_name
        }

    query =
      if exclude_player_id do
        from [gs, p] in query, where: gs.player_id != ^exclude_player_id
      else
        query
      end

    query
    |> Repo.all()
    |> Enum.map(fn player ->
      name =
        if player.character_name && player.character_name != "" do
          String.capitalize(player.character_name)
        else
          player.email
          |> String.split("@")
          |> List.first()
          |> String.capitalize()
        end

      %{id: player.id, name: name}
    end)
  end
end
