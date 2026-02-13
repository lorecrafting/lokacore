defmodule Loka.Content.Skill do
  @moduledoc """
  Skill definition - OOC TypedObject.

  Skills define character progression paths with categories,
  prerequisites, and experience formulas. Covers both leveled
  skills (with max_level/xp_per_level) and binary skills
  (with cost, learned or not).
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  # =============================================================================
  # Queries
  # =============================================================================

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :skill) do
      {:ok, entity} -> Entity.to_typed_object(entity)
      error -> error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, skill} -> skill
      {:error, :not_found} -> raise "Skill not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :skill, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :skill, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Returns all binary skills (skills with a "cost" field, no leveling).
  """
  @spec all_binary() :: [TypedObject.t()]
  def all_binary do
    all_published()
    |> Enum.filter(&binary?/1)
  end

  @spec by_category(String.t()) :: [TypedObject.t()]
  def by_category(category) when is_binary(category) do
    all_published()
    |> Enum.filter(fn skill ->
      cat = TypedObject.get_data(skill, "category")
      cat == category
    end)
  end

  @spec by_tag(String.t()) :: [TypedObject.t()]
  def by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :skill, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Returns all binary skills taught by a specific trainer.
  """
  @spec by_trainer(String.t()) :: [TypedObject.t()]
  def by_trainer(trainer_key) when is_binary(trainer_key) do
    all_binary()
    |> Enum.filter(fn skill ->
      trainer_key in trainers(skill)
    end)
  end

  # =============================================================================
  # Accessors (shared)
  # =============================================================================

  def category(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "category", "general")

  def max_level(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "max_level", 100)

  def prerequisites(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "prerequisites", [])

  def trainers(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "trainers", [])

  def tags(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "tags", [])

  # =============================================================================
  # Leveled Skill Accessors
  # =============================================================================

  def xp_per_use(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "xp_per_use", 1)

  def xp_per_level(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "xp_per_level", 100)

  def point_cost_formula(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "point_cost_formula", "level")

  # =============================================================================
  # Binary Skill Accessors
  # =============================================================================

  @doc """
  Returns the point cost to learn a binary skill (1-3).
  """
  def cost(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "cost", 1)

  @doc """
  Returns the governing stat for a binary skill (as atom).
  """
  def stat(%TypedObject{type: :skill} = skill) do
    raw = TypedObject.get_data(skill, "stat", "str")

    cond do
      is_atom(raw) -> raw
      is_binary(raw) -> String.to_atom(raw)
      true -> :str
    end
  end

  def lag(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "lag", 1)

  def cooldown(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "cooldown", 0)

  def mv_cost(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "mv_cost", 0)

  def mana_cost(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "mana_cost", 0)

  def effect(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "effect", nil)

  # =============================================================================
  # Classification
  # =============================================================================

  @doc """
  Returns true if a skill is binary (has a "cost" field, no leveling).
  """
  @spec binary?(TypedObject.t()) :: boolean()
  def binary?(%TypedObject{type: :skill} = skill) do
    TypedObject.get_data(skill, "cost") != nil
  end

  # =============================================================================
  # Leveled Skill Calculations
  # =============================================================================

  @doc """
  Calculates XP needed for next level (leveled skills).
  """
  @spec xp_for_level(TypedObject.t(), non_neg_integer()) :: non_neg_integer()
  def xp_for_level(%TypedObject{type: :skill} = skill, level) do
    base = xp_per_level(skill)
    base * level
  end

  @doc """
  Calculates skill point cost for a given level (leveled skills).
  """
  @spec point_cost(TypedObject.t(), non_neg_integer()) :: non_neg_integer()
  def point_cost(%TypedObject{type: :skill} = skill, level) do
    formula = point_cost_formula(skill)

    case formula do
      "level" -> level
      "level_squared" -> level * level
      _ -> level
    end
  end

  @doc """
  Calculates total points spent on a leveled skill at a given level.
  """
  @spec total_points_spent(TypedObject.t(), non_neg_integer()) :: non_neg_integer()
  def total_points_spent(%TypedObject{type: :skill}, 0), do: 0

  def total_points_spent(%TypedObject{type: :skill} = skill, level) when level > 0 do
    Enum.reduce(1..level, 0, fn lvl, acc ->
      acc + point_cost(skill, lvl)
    end)
  end

  @doc """
  Checks if prerequisites are met for a leveled skill.

  Leveled skill prerequisites are maps with %{"skill" => key, "level" => n}.
  """
  @spec prerequisites_met?(TypedObject.t(), map()) :: boolean()
  def prerequisites_met?(%TypedObject{type: :skill} = skill, player_skills)
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
  # Binary Skill Calculations
  # =============================================================================

  @doc """
  Checks if prerequisites are met for a binary skill.

  Binary skill prerequisites are a list of skill key strings.
  """
  @spec binary_prerequisites_met?(TypedObject.t(), MapSet.t() | [String.t()]) :: boolean()
  def binary_prerequisites_met?(%TypedObject{type: :skill} = skill, learned_skills) do
    learned_set =
      case learned_skills do
        %MapSet{} -> learned_skills
        list when is_list(list) -> MapSet.new(list)
        map when is_map(map) -> MapSet.new(Map.keys(map))
      end

    prereqs = prerequisites(skill)

    Enum.all?(prereqs, fn prereq ->
      MapSet.member?(learned_set, prereq)
    end)
  end

  @doc """
  Calculates skill effectiveness based on the governing stat.
  Returns a multiplier (1.0 = base at stat 10).
  """
  @spec effectiveness(TypedObject.t(), map()) :: float()
  def effectiveness(%TypedObject{type: :skill} = skill, player_stats) do
    stat_key = stat(skill)
    stat_value = Map.get(player_stats, stat_key) || Map.get(player_stats, to_string(stat_key), 10)
    1.0 + (stat_value - 10) / 100.0
  end

  @doc """
  Returns the stat bonus for a binary skill (stat / 3).
  """
  @spec stat_bonus(TypedObject.t(), map()) :: non_neg_integer()
  def stat_bonus(%TypedObject{type: :skill} = skill, player_stats) do
    stat_key = stat(skill)
    stat_value = Map.get(player_stats, stat_key) || Map.get(player_stats, to_string(stat_key), 0)
    div(stat_value, 3)
  end

  @doc """
  Checks if player has enough MV to use a binary skill.
  """
  @spec has_mv?(TypedObject.t(), non_neg_integer()) :: boolean()
  def has_mv?(%TypedObject{type: :skill} = skill, current_mv) do
    current_mv >= mv_cost(skill)
  end

  @doc """
  Checks if player has enough Mana to use a binary skill.
  """
  @spec has_mana?(TypedObject.t(), non_neg_integer()) :: boolean()
  def has_mana?(%TypedObject{type: :skill} = skill, current_mana) do
    current_mana >= mana_cost(skill)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp to_typed_objects(entities) do
    entities
    |> Enum.flat_map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, typed_object} -> [typed_object]
        {:error, _} -> []
      end
    end)
  end
end
