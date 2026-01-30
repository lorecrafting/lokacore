defmodule Loka.Framework.Skills.BinarySkill do
  @moduledoc """
  Binary skill system - skills are learned or not learned (no levels).

  ## Design Philosophy

  - **Binary:** You either know a skill or you don't
  - **Point Cost:** Skills cost 1-3 skill points to learn
  - **50 Total Points:** One point per level, 50 at max level
  - **Stat-Based Effectiveness:** Your stats determine how well skills perform
  - **Trainers:** Skills are learned from NPCs in the world

  ## Skill Structure

      %BinarySkill{
        key: "kick",
        name: "Kick",
        category: :combat_melee,
        cost: 1,
        stat: :str,
        prerequisites: ["basic_combat"],
        trainers: ["combat_instructor"],
        description: "A basic kick attack that can interrupt spellcasting.",
        lag: 2,
        cooldown: 0,
        mv_cost: 10,
        mana_cost: 0
      }

  ## Skill Categories

  - `:combat_melee` - Melee fighting skills (14 skills, 20 pts to master)
  - `:combat_ranged` - Ranged weapon skills (8 skills, 13 pts to master)
  - `:combat_defense` - Defensive skills (7 skills, 10 pts to master)
  - `:stealth` - Sneaking, hiding, theft (10 skills, 16 pts to master)
  - `:survival` - Outdoor skills (8 skills, 8 pts to master)
  - `:crafting` - Creation skills (8 skills, 13 pts to master)
  - `:social` - Interaction skills (4 skills, 4 pts to master)

  ## Example Usage

      alias Loka.Framework.Skills.BinarySkill

      # Load from YAML
      {:ok, skill} = BinarySkill.from_map(yaml_data)

      # Check prerequisites
      BinarySkill.prerequisites_met?(skill, learned_skills)

      # Get effectiveness based on stats
      BinarySkill.effectiveness(skill, player_stats)
  """

  alias Loka.Utils.MapHelpers

  @type category ::
          :combat_melee
          | :combat_ranged
          | :combat_defense
          | :stealth
          | :survival
          | :crafting
          | :social
          | :magic

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          category: category(),
          cost: 1..3,
          stat: atom(),
          prerequisites: [String.t()],
          trainers: [String.t()],
          description: String.t(),
          lag: non_neg_integer(),
          cooldown: non_neg_integer(),
          mv_cost: non_neg_integer(),
          mana_cost: non_neg_integer(),
          effect: String.t() | nil,
          tags: [String.t()]
        }

  defstruct [
    :key,
    :name,
    category: :combat_melee,
    cost: 1,
    stat: :str,
    prerequisites: [],
    trainers: [],
    description: "",
    lag: 1,
    cooldown: 0,
    mv_cost: 0,
    mana_cost: 0,
    effect: nil,
    tags: []
  ]

  @valid_categories [
    :combat_melee,
    :combat_ranged,
    :combat_defense,
    :magic_offense,
    :magic_defense,
    :magic_utility,
    :stealth,
    :movement,
    :survival,
    :crafting,
    :social
  ]

  @valid_stats [:str, :dex, :con, :int, :per, :spi]

  # =============================================================================
  # Struct Creation
  # =============================================================================

  @doc """
  Creates a BinarySkill from a map (typically loaded from YAML).
  """
  @spec from_map(map()) :: {:ok, t()} | {:error, term()}
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, :key),
         {:ok, name} <- require_field(data, :name) do
      skill = %__MODULE__{
        key: key,
        name: name,
        category: parse_category(data),
        cost: parse_cost(data),
        stat: parse_stat(data),
        prerequisites: MapHelpers.get_flexible(data, :prerequisites, []),
        trainers: MapHelpers.get_flexible(data, :trainers, []),
        description: MapHelpers.get_flexible(data, :description, ""),
        lag: MapHelpers.get_flexible(data, :lag, 1),
        cooldown: MapHelpers.get_flexible(data, :cooldown, 0),
        mv_cost: MapHelpers.get_flexible(data, :mv_cost, 0),
        mana_cost: MapHelpers.get_flexible(data, :mana_cost, 0),
        effect: MapHelpers.get_flexible(data, :effect, nil),
        tags: MapHelpers.get_flexible(data, :tags, [])
      }

      {:ok, skill}
    end
  end

  defp require_field(data, field) do
    value = MapHelpers.get_flexible(data, field, nil)

    if value do
      {:ok, value}
    else
      {:error, {:missing_field, field}}
    end
  end

  defp parse_category(data) do
    category = MapHelpers.get_flexible(data, :category, "combat_melee")

    parsed =
      cond do
        is_atom(category) -> category
        is_binary(category) -> String.to_atom(category)
        true -> :combat_melee
      end

    if parsed in @valid_categories, do: parsed, else: :combat_melee
  end

  defp parse_cost(data) do
    cost = MapHelpers.get_flexible(data, :cost, 1)
    min(3, max(1, cost))
  end

  defp parse_stat(data) do
    stat = MapHelpers.get_flexible(data, :stat, "str")

    parsed =
      cond do
        is_atom(stat) -> stat
        is_binary(stat) -> String.to_atom(stat)
        true -> :str
      end

    if parsed in @valid_stats, do: parsed, else: :str
  end

  # =============================================================================
  # Prerequisites
  # =============================================================================

  @doc """
  Checks if prerequisites are met.

  Prerequisites are other skill keys that must be learned first.
  """
  @spec prerequisites_met?(t(), [String.t()] | MapSet.t()) :: boolean()
  def prerequisites_met?(%__MODULE__{prerequisites: prereqs}, learned_skills) do
    learned_set =
      case learned_skills do
        %MapSet{} -> learned_skills
        list when is_list(list) -> MapSet.new(list)
        map when is_map(map) -> MapSet.new(Map.keys(map))
      end

    Enum.all?(prereqs, fn prereq -> MapSet.member?(learned_set, prereq) end)
  end

  # =============================================================================
  # Effectiveness
  # =============================================================================

  @doc """
  Calculates skill effectiveness based on the governing stat.

  Higher stats = more effective skill use.

  Returns a multiplier (1.0 = base, higher = better).
  """
  @spec effectiveness(t(), map()) :: float()
  def effectiveness(%__MODULE__{stat: stat}, player_stats) do
    stat_value = Map.get(player_stats, stat) || Map.get(player_stats, to_string(stat), 10)
    # Base effectiveness at stat 10, scales from there
    # Stat 10 = 1.0x, Stat 50 = 1.4x, Stat 100 = 1.9x
    1.0 + (stat_value - 10) / 100.0
  end

  @doc """
  Returns the base damage/healing/effect value for a skill, scaled by stat.

  This is a simple linear formula: stat / 3.
  """
  @spec stat_bonus(t(), map()) :: non_neg_integer()
  def stat_bonus(%__MODULE__{stat: stat}, player_stats) do
    stat_value = Map.get(player_stats, stat) || Map.get(player_stats, to_string(stat), 0)
    div(stat_value, 3)
  end

  # =============================================================================
  # Cost Validation
  # =============================================================================

  @doc """
  Checks if player can afford to learn this skill.
  """
  @spec can_afford?(t(), non_neg_integer()) :: boolean()
  def can_afford?(%__MODULE__{cost: cost}, available_points) do
    available_points >= cost
  end

  # =============================================================================
  # Combat Checks
  # =============================================================================

  @doc """
  Checks if player has enough MV to use this skill.
  """
  @spec has_mv?(t(), non_neg_integer()) :: boolean()
  def has_mv?(%__MODULE__{mv_cost: cost}, current_mv) do
    current_mv >= cost
  end

  @doc """
  Checks if player has enough Mana to use this skill.
  """
  @spec has_mana?(t(), non_neg_integer()) :: boolean()
  def has_mana?(%__MODULE__{mana_cost: cost}, current_mana) do
    current_mana >= cost
  end

  # =============================================================================
  # Display
  # =============================================================================

  @doc """
  Returns human-readable category name.
  """
  @spec category_name(category()) :: String.t()
  def category_name(:combat_melee), do: "Combat - Melee"
  def category_name(:combat_ranged), do: "Combat - Ranged"
  def category_name(:combat_defense), do: "Combat - Defense"
  def category_name(:magic_offense), do: "Magic - Offense"
  def category_name(:magic_defense), do: "Magic - Defense"
  def category_name(:magic_utility), do: "Magic - Utility"
  def category_name(:stealth), do: "Stealth"
  def category_name(:movement), do: "Movement"
  def category_name(:survival), do: "Survival"
  def category_name(:crafting), do: "Crafting"
  def category_name(:social), do: "Social"
  def category_name(_), do: "Unknown"

  @doc """
  Returns valid categories.
  """
  @spec valid_categories() :: [category()]
  def valid_categories, do: @valid_categories

  @doc """
  Returns valid stats.
  """
  @spec valid_stats() :: [atom()]
  def valid_stats, do: @valid_stats
end
