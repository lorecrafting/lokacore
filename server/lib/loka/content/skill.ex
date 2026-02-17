defmodule Loka.Content.Skill do
  @moduledoc """
  Skill definition - OOC Entity.

  Skills define character progression paths with categories,
  prerequisites, and experience formulas.
  """

  alias Loka.Engine.{Entity, Entities}

  # =============================================================================
  # Queries
  # =============================================================================

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Entities.find_one(key: key, type: :skill)
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, skill} -> skill
      {:error, :not_found} -> raise "Skill not found: #{key}"
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :skill, is_prototype: true)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :skill, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @spec by_category(String.t()) :: [Entity.t()]
  def by_category(category) when is_binary(category) do
    all_published()
    |> Enum.filter(fn skill ->
      cat = get_data(skill, "category")
      cat == category
    end)
  end

  @spec by_tag(String.t()) :: [Entity.t()]
  def by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :skill, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  # =============================================================================
  # Accessors
  # =============================================================================

  def category(%Entity{type: :skill} = skill),
    do: get_data(skill, "category", "general")

  def max_level(%Entity{type: :skill} = skill),
    do: get_data(skill, "max_level", 100)

  def prerequisites(%Entity{type: :skill} = skill),
    do: get_data(skill, "prerequisites", [])

  def trainers(%Entity{type: :skill} = skill),
    do: get_data(skill, "trainers", [])

  def tags(%Entity{type: :skill} = skill),
    do: get_data(skill, "tags", [])

  def xp_per_use(%Entity{type: :skill} = skill),
    do: get_data(skill, "xp_per_use", 1)

  def xp_per_level(%Entity{type: :skill} = skill),
    do: get_data(skill, "xp_per_level", 100)

  def point_cost_formula(%Entity{type: :skill} = skill),
    do: get_data(skill, "point_cost_formula", "level")

  # =============================================================================
  # Calculations
  # =============================================================================

  @doc """
  Calculates XP needed for next level.
  """
  @spec xp_for_level(Entity.t(), non_neg_integer()) :: non_neg_integer()
  def xp_for_level(%Entity{type: :skill} = skill, level) do
    base = xp_per_level(skill)
    base * level
  end

  @doc """
  Calculates skill point cost for a given level.
  """
  @spec point_cost(Entity.t(), non_neg_integer()) :: non_neg_integer()
  def point_cost(%Entity{type: :skill} = skill, level) do
    formula = point_cost_formula(skill)

    case formula do
      "level" -> level
      "level_squared" -> level * level
      _ -> level
    end
  end

  @doc """
  Calculates total points spent on a skill at a given level.
  """
  @spec total_points_spent(Entity.t(), non_neg_integer()) :: non_neg_integer()
  def total_points_spent(%Entity{type: :skill}, 0), do: 0

  def total_points_spent(%Entity{type: :skill} = skill, level) when level > 0 do
    Enum.reduce(1..level, 0, fn lvl, acc ->
      acc + point_cost(skill, lvl)
    end)
  end

  @doc """
  Checks if prerequisites are met.

  Prerequisites are maps with %{"skill" => key, "level" => n}.
  """
  @spec prerequisites_met?(Entity.t(), map()) :: boolean()
  def prerequisites_met?(%Entity{type: :skill} = skill, player_skills)
      when is_map(player_skills) do
    prereqs = prerequisites(skill)

    Enum.all?(prereqs, fn prereq ->
      skill_key = prereq["skill"] || Map.get(prereq, :skill, "")
      required_level = prereq["level"] || Map.get(prereq, :level, 1)
      player_level = Map.get(player_skills, skill_key, 0)
      player_level >= required_level
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_data(%Entity{} = entity, field, default \\ nil) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
