defmodule Loka.Framework.Progression do
  @moduledoc """
  Handles player progression: XP, levels, and skill points.

  Uses the Balance config for all progression values, allowing game tuning
  without code changes. See `priv/config/balance.yml` for values.

  ## Level Formula
  XP required for level N = xp_base * N^xp_exponent
  Default: 100 * N^1.8

  - Level 1 → 2: ~348 XP
  - Level 2 → 3: ~582 XP
  - Level 3 → 4: ~859 XP
  - Level 9 → 10: ~4786 XP
  - etc.

  The 1.8 exponent provides a gentler curve than quadratic (2.0),
  making late-game progression more achievable.

  ## Skill Points
  Players earn skill_points_per_level (default: 3) skill points per level up.
  Skill points are spent at Skill Trainer NPCs to learn new skills.

  ## Skills
  Skills are stored in player stats and provide combat bonuses.
  """

  alias Loka.Config.Balance
  alias Loka.Engine.Entity

  # Fallback defaults if Balance config not loaded
  @default_xp_base 100
  @default_xp_exponent 1.8
  @default_skill_points_per_level 3
  @default_hp_per_level 10

  @doc """
  Calculates the XP required to reach a specific level from level 1.

  Uses xp_base and xp_exponent from Balance config.
  """
  def xp_for_level(level) when level <= 1, do: 0

  def xp_for_level(level) do
    xp_base = Balance.get(:progression, :xp_base, default: @default_xp_base)
    xp_exponent = Balance.get(:progression, :xp_exponent, default: @default_xp_exponent)
    trunc(xp_base * :math.pow(level, xp_exponent))
  end

  @doc """
  Calculates XP needed for the next level up.
  """
  def xp_to_next_level(current_level) do
    xp_for_level(current_level + 1)
  end

  @doc """
  Calculates the player's level based on total XP.
  """
  def level_for_xp(total_xp) do
    # Binary search for the level
    find_level(total_xp, 1, 100)
  end

  defp find_level(_xp, min, max) when min >= max, do: min

  defp find_level(xp, min, max) do
    mid = div(min + max + 1, 2)
    required = xp_for_level(mid)

    if xp >= required do
      find_level(xp, mid, max)
    else
      find_level(xp, min, mid - 1)
    end
  end

  @doc """
  Awards XP to a player and handles level ups.

  Returns {:ok, updated_entity, level_up_info} where level_up_info is:
  - nil if no level up
  - %{new_level: N, skill_points_gained: M} if leveled up
  """
  def award_xp(%Entity{} = entity, xp_amount) do
    stats = Entity.get_component(entity, "stats") || %{}

    current_xp = get_stat(stats, "xp", 0)
    current_level = get_stat(stats, "level", 1)
    current_skill_points = get_stat(stats, "skill_points", 0)

    new_xp = current_xp + xp_amount
    new_level = level_for_xp(new_xp)

    if new_level > current_level do
      # Level up! Use Balance config for progression values
      levels_gained = new_level - current_level

      skill_points_per_level =
        Balance.get(:progression, :skill_points_per_level,
          default: @default_skill_points_per_level
        )

      skill_points_gained = levels_gained * skill_points_per_level

      new_stats =
        stats
        |> Map.put("xp", new_xp)
        |> Map.put("level", new_level)
        |> Map.put("skill_points", current_skill_points + skill_points_gained)

      # Also increase max health on level up (from Balance config)
      hp_per_level = Balance.get(:progression, :hp_per_level, default: @default_hp_per_level)
      resources = Entity.get_component(entity, "resources") || %{}
      health = resources["health"] || %{"current" => 100, "max" => 100}
      max_hp = health["max"] || 100
      current_hp = health["current"] || max_hp
      new_max_hp = max_hp + levels_gained * hp_per_level
      # Heal on level up
      new_current_hp = current_hp + levels_gained * hp_per_level

      new_health = %{"current" => new_current_hp, "max" => new_max_hp}
      new_resources = Map.put(resources, "health", new_health)

      updated_entity =
        entity
        |> Entity.add_component("stats", new_stats)
        |> Entity.add_component("resources", new_resources)

      level_up_info = %{
        new_level: new_level,
        skill_points_gained: skill_points_gained,
        old_level: current_level
      }

      {:ok, updated_entity, level_up_info}
    else
      # No level up, just add XP
      new_stats = Map.put(stats, "xp", new_xp)
      updated_entity = Entity.add_component(entity, "stats", new_stats)

      {:ok, updated_entity, nil}
    end
  end

  @doc """
  Gets a player's current progression stats.
  """
  def get_progression_stats(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}

    level = get_stat(stats, "level", 1)
    xp = get_stat(stats, "xp", 0)
    skill_points = get_stat(stats, "skill_points", 0)
    learned_skills = get_stat(stats, "skills", [])

    xp_for_current = xp_for_level(level)
    xp_for_next = xp_for_level(level + 1)
    xp_into_level = xp - xp_for_current
    xp_needed = xp_for_next - xp_for_current

    %{
      level: level,
      total_xp: xp,
      xp_into_level: xp_into_level,
      xp_needed_for_next: xp_needed,
      xp_progress_percent:
        if(xp_needed > 0, do: trunc(xp_into_level / xp_needed * 100), else: 100),
      skill_points: skill_points,
      learned_skills: learned_skills
    }
  end

  @doc """
  Checks if player has enough skill points to learn a skill.
  """
  def can_learn_skill?(%Entity{} = entity, skill_cost) do
    stats = Entity.get_component(entity, "stats") || %{}
    skill_points = get_stat(stats, "skill_points", 0)
    skill_points >= skill_cost
  end

  @doc """
  Learns a skill, consuming skill points.

  Returns {:ok, updated_state} or {:error, reason}
  """
  def learn_skill(%Entity{} = entity, skill_id, skill_cost) do
    stats = Entity.get_component(entity, "stats") || %{}
    skill_points = get_stat(stats, "skill_points", 0)
    learned_skills = get_stat(stats, "skills", [])

    cond do
      skill_id in learned_skills ->
        {:error, :already_learned}

      skill_points < skill_cost ->
        {:error, :not_enough_skill_points}

      true ->
        new_stats =
          stats
          |> Map.put("skill_points", skill_points - skill_cost)
          |> Map.put("skills", learned_skills ++ [skill_id])

        {:ok, Entity.add_component(entity, "stats", new_stats)}
    end
  end

  @doc """
  Checks if player has learned a specific skill.
  """
  def has_skill?(%Entity{} = entity, skill_id) do
    stats = Entity.get_component(entity, "stats") || %{}
    learned_skills = get_stat(stats, "skills", [])
    skill_id in learned_skills
  end

  @doc """
  Gets the current progression configuration from Balance.

  Returns a map with all progression config values.
  """
  def get_config do
    %{
      xp_base: Balance.get(:progression, :xp_base, default: @default_xp_base),
      xp_exponent: Balance.get(:progression, :xp_exponent, default: @default_xp_exponent),
      skill_points_per_level:
        Balance.get(:progression, :skill_points_per_level,
          default: @default_skill_points_per_level
        ),
      hp_per_level: Balance.get(:progression, :hp_per_level, default: @default_hp_per_level),
      max_level: Balance.get(:progression, :max_level, default: 50)
    }
  end

  # Helper to get stat with fallback for string/atom keys
  # Uses safe atom lookup to prevent atom exhaustion
  defp get_stat(map, key, default) when is_binary(key) do
    case Loka.Utils.MapHelpers.safe_to_existing_atom(key) do
      nil -> Map.get(map, key, default)
      atom_key -> Loka.Utils.MapHelpers.get_any(map, [key, atom_key], default)
    end
  end
end
