defmodule Loka.Framework.Spark.SparkState do
  @moduledoc """
  Ecto schema for Spark companion state.

  Each player has one Spark that bonds with them during character creation.
  The Spark grows with the player, revealing its personality and eventually
  its name as the bond deepens.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias Loka.Repo
  alias Loka.Accounts.Player

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Personality traits available for selection
  @valid_traits ~w(curious contemplative warm earnest ancient)

  # Visual forms (mote is default, others unlocked)
  @valid_forms ~w(mote flame geometric aurora constellation)

  # Bond levels in progression order
  @bond_levels ~w(stranger acquaintance companion friend bonded)

  # Awakening stages
  @awakening_stages ~w(dormant stirring aware awakened)

  # Verbosity settings
  @verbosity_levels ~w(quiet normal verbose)

  schema "spark_states" do
    belongs_to :player, Player

    # Bond progression
    field :bond_level, :string, default: "stranger"
    field :bond_points, :integer, default: 0

    # Awakening (story progression)
    field :awakening_stage, :string, default: "dormant"

    # Personality (set at character creation - exactly 2 traits)
    field :personality_traits, {:array, :string}, default: []

    # Visual form
    field :visual_form, :string, default: "mote"
    field :unlocked_forms, {:array, :string}, default: ["mote"]

    # Name (revealed through bond progression)
    field :revealed_name, :string

    # Preferences
    field :verbosity, :string, default: "normal"
    field :last_hint_at, :utc_datetime
    field :suppressed_hints, {:array, :string}, default: []

    # Unlocked lore/memories (keys to content)
    field :unlocked_memories, {:array, :string}, default: []

    # Session tracking
    field :last_seen_at, :utc_datetime

    timestamps()
  end

  # Accessors for valid options
  def valid_traits, do: @valid_traits
  def valid_forms, do: @valid_forms
  def bond_levels, do: @bond_levels
  def awakening_stages, do: @awakening_stages

  @doc """
  Creates a new Spark for a player during character creation.
  Requires exactly 2 personality traits to be selected.
  """
  def create_changeset(attrs) do
    %__MODULE__{}
    |> cast(attrs, [:player_id, :personality_traits])
    |> validate_required([:player_id, :personality_traits])
    |> validate_traits()
    |> unique_constraint(:player_id)
  end

  @doc """
  Updates Spark state (bond points, preferences, etc.)
  """
  def update_changeset(spark, attrs) do
    spark
    |> cast(attrs, [
      :bond_level,
      :bond_points,
      :awakening_stage,
      :visual_form,
      :unlocked_forms,
      :revealed_name,
      :verbosity,
      :last_hint_at,
      :suppressed_hints,
      :unlocked_memories,
      :last_seen_at
    ])
    |> validate_inclusion(:bond_level, @bond_levels)
    |> validate_inclusion(:awakening_stage, @awakening_stages)
    |> validate_inclusion(:visual_form, @valid_forms)
    |> validate_inclusion(:verbosity, @verbosity_levels)
    |> validate_visual_form_unlocked()
  end

  # Validate exactly 2 valid traits
  defp validate_traits(changeset) do
    changeset
    |> validate_length(:personality_traits, is: 2, message: "must select exactly 2 traits")
    |> validate_change(:personality_traits, fn :personality_traits, traits ->
      invalid = Enum.reject(traits, &(&1 in @valid_traits))

      if invalid == [] do
        []
      else
        [personality_traits: "invalid traits: #{Enum.join(invalid, ", ")}"]
      end
    end)
  end

  # Validate that selected visual form is unlocked
  defp validate_visual_form_unlocked(changeset) do
    case {get_field(changeset, :visual_form), get_field(changeset, :unlocked_forms)} do
      {form, unlocked} when is_binary(form) and is_list(unlocked) ->
        if form in unlocked do
          changeset
        else
          add_error(changeset, :visual_form, "form not unlocked yet")
        end

      _ ->
        changeset
    end
  end

  # ============================================================================
  # Queries
  # ============================================================================

  @doc "Get Spark by player_id"
  def get_by_player(player_id) do
    __MODULE__
    |> where([s], s.player_id == ^player_id)
    |> Repo.one()
  end

  @doc "Get Spark by player_id, raises if not found"
  def get_by_player!(player_id) do
    __MODULE__
    |> where([s], s.player_id == ^player_id)
    |> Repo.one!()
  end

  # ============================================================================
  # Bond Progression
  # ============================================================================

  @doc """
  Points required for each bond level.
  """
  def bond_thresholds do
    %{
      "stranger" => 0,
      "acquaintance" => 50,
      "companion" => 150,
      "friend" => 350,
      "bonded" => 700
    }
  end

  @doc """
  Calculate bond level from points.
  """
  def bond_level_for_points(points) do
    thresholds = bond_thresholds()

    @bond_levels
    |> Enum.reverse()
    |> Enum.find("stranger", fn level ->
      points >= Map.get(thresholds, level, 0)
    end)
  end

  @doc """
  Progress to next bond level (percentage 0-100).
  """
  def bond_progress(spark) do
    thresholds = bond_thresholds()
    current_threshold = Map.get(thresholds, spark.bond_level, 0)
    current_idx = Enum.find_index(@bond_levels, &(&1 == spark.bond_level))

    next_level = Enum.at(@bond_levels, current_idx + 1)

    if next_level do
      next_threshold = Map.get(thresholds, next_level, current_threshold)
      range = next_threshold - current_threshold
      progress = spark.bond_points - current_threshold

      if range > 0 do
        min(100, round(progress / range * 100))
      else
        100
      end
    else
      100
    end
  end

  # ============================================================================
  # Personality Helpers
  # ============================================================================

  @doc "Check if Spark has a specific trait"
  def has_trait?(spark, trait) when is_binary(trait) do
    trait in (spark.personality_traits || [])
  end

  def has_trait?(spark, trait) when is_atom(trait) do
    has_trait?(spark, Atom.to_string(trait))
  end

  @doc "Get trait descriptions for UI"
  def trait_descriptions do
    %{
      "curious" => "Asks questions, interested in everything",
      "contemplative" => "Thoughtful, measured responses",
      "warm" => "Gentle wit, encouraging, never mean",
      "earnest" => "Sincere, occasionally naive",
      "ancient" => "Hints at vast experience, occasional gravity"
    }
  end
end
