defmodule Exmud.Framework.Skills.Skill do
  @moduledoc """
  LegendMUD-style skill system with skill trees and proficiencies.

  Skills represent learned abilities that improve with use and training.
  Unlike class-based systems, players can learn any skill but are limited
  by total skill points (like LegendMUD's 100-point cap).

  ## Skill Structure

      %Skill{
        key: "swordsmanship",
        name: "Swordsmanship",
        category: "combat",
        max_level: 100,
        description: "Proficiency with bladed weapons.",
        prerequisites: [%{skill: "basic_combat", level: 10}],
        unlocks: ["parry", "riposte", "blade_dance"],
        trainers: ["weapons_master", "veteran_soldier"],
        practice_actions: ["attack_with_sword", "spar"],
        xp_per_use: 1,
        xp_per_level: 100
      }

  ## Skill Categories

  - `combat` - Fighting skills
  - `magic` - Spellcasting schools
  - `crafting` - Creation skills
  - `gathering` - Resource collection
  - `social` - Interaction abilities
  - `knowledge` - Lore and languages
  - `survival` - Outdoor skills

  ## LegendMUD Style

  In LegendMUD, players have 100 total skill points to distribute.
  Higher skill levels cost more points. This creates meaningful choices
  between being a specialist or generalist.
  """

  alias Exmud.Utils.MapHelpers

  @type prerequisite :: %{skill: String.t(), level: non_neg_integer()}

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          category: String.t(),
          max_level: pos_integer(),
          description: String.t(),
          prerequisites: [prerequisite()],
          unlocks: [String.t()],
          trainers: [String.t()],
          practice_actions: [String.t()],
          xp_per_use: non_neg_integer(),
          xp_per_level: non_neg_integer(),
          point_cost_formula: String.t(),
          tags: [String.t()]
        }

  defstruct [
    :key,
    :name,
    category: "general",
    max_level: 100,
    description: "",
    prerequisites: [],
    unlocks: [],
    trainers: [],
    practice_actions: [],
    xp_per_use: 1,
    xp_per_level: 100,
    point_cost_formula: "level",
    tags: []
  ]

  @valid_categories ["combat", "magic", "crafting", "gathering", "social", "knowledge", "survival", "general"]

  @doc """
  Creates a Skill struct from a map (typically loaded from YAML).
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, "key"),
         {:ok, name} <- require_field(data, "name") do
      skill = %__MODULE__{
        key: key,
        name: name,
        category: MapHelpers.get_flexible(data, :category, "general"),
        max_level: MapHelpers.get_flexible(data, :max_level, 100),
        description: MapHelpers.get_flexible(data, :description, ""),
        prerequisites: parse_prerequisites(data),
        unlocks: MapHelpers.get_flexible(data, :unlocks, []),
        trainers: MapHelpers.get_flexible(data, :trainers, []),
        practice_actions: MapHelpers.get_flexible(data, :practice_actions, []),
        xp_per_use: MapHelpers.get_flexible(data, :xp_per_use, 1),
        xp_per_level: MapHelpers.get_flexible(data, :xp_per_level, 100),
        point_cost_formula: MapHelpers.get_flexible(data, :point_cost_formula, "level"),
        tags: MapHelpers.get_flexible(data, :tags, [])
      }

      {:ok, skill}
    end
  end

  defp require_field(data, field) do
    value = MapHelpers.get_flexible(data, String.to_atom(field), nil)

    if value do
      {:ok, value}
    else
      {:error, {:missing_field, field}}
    end
  end

  defp parse_prerequisites(data) do
    prereqs = MapHelpers.get_flexible(data, :prerequisites, [])

    Enum.map(prereqs, fn prereq ->
      %{
        skill: MapHelpers.get_flexible(prereq, :skill, ""),
        level: MapHelpers.get_flexible(prereq, :level, 1)
      }
    end)
  end

  @doc """
  Calculates XP needed for next level.
  """
  def xp_for_level(%__MODULE__{xp_per_level: base}, level) do
    # Progressive XP curve: each level costs more
    base * level
  end

  @doc """
  Calculates skill point cost for a given level.

  LegendMUD uses a point system where higher levels cost more points.
  """
  def point_cost(%__MODULE__{point_cost_formula: formula}, level) do
    # Simple linear formula; could be extended
    case formula do
      "level" -> level
      "level_squared" -> level * level
      _ -> level
    end
  end

  @doc """
  Calculates total points spent on a skill at a given level.
  """
  def total_points_spent(%__MODULE__{} = skill, level) when level > 0 do
    Enum.reduce(1..level, 0, fn lvl, acc ->
      acc + point_cost(skill, lvl)
    end)
  end

  def total_points_spent(%__MODULE__{}, 0), do: 0

  @doc """
  Checks if prerequisites are met.
  """
  def prerequisites_met?(%__MODULE__{prerequisites: prereqs}, player_skills) do
    Enum.all?(prereqs, fn %{skill: skill_key, level: required_level} ->
      player_level = Map.get(player_skills, skill_key, 0)
      player_level >= required_level
    end)
  end

  @doc """
  Returns valid skill categories.
  """
  def valid_categories, do: @valid_categories
end
