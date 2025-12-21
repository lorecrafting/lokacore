defmodule Exmud.DemoGame.Systems.Progression do
  @moduledoc """
  Handles player progression: XP, levels, and skill points.

  ## Level Formula
  XP required for level N = 100 * N * N
  - Level 1 → 2: 400 XP
  - Level 2 → 3: 900 XP
  - Level 3 → 4: 1600 XP
  - etc.

  ## Skill Points
  Players earn 3 skill points per level up.
  Skill points are spent at Skill Trainer NPCs to learn new skills.

  ## Skills
  Skills are stored in player stats and provide combat bonuses.
  """

  alias Exmud.DemoGame.PlayerGameState

  @skill_points_per_level 3

  @doc """
  Calculates the XP required to reach a specific level from level 1.
  """
  def xp_for_level(level) when level <= 1, do: 0
  def xp_for_level(level), do: 100 * level * level

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

  Returns {:ok, updated_game_state, level_up_info} where level_up_info is:
  - nil if no level up
  - %{new_level: N, skill_points_gained: M} if leveled up
  """
  def award_xp(%PlayerGameState{} = game_state, xp_amount) do
    stats = game_state.stats || %{}

    current_xp = get_stat(stats, "xp", 0)
    current_level = get_stat(stats, "level", 1)
    current_skill_points = get_stat(stats, "skill_points", 0)

    new_xp = current_xp + xp_amount
    new_level = level_for_xp(new_xp)

    if new_level > current_level do
      # Level up!
      levels_gained = new_level - current_level
      skill_points_gained = levels_gained * @skill_points_per_level

      new_stats =
        stats
        |> Map.put("xp", new_xp)
        |> Map.put("level", new_level)
        |> Map.put("skill_points", current_skill_points + skill_points_gained)

      # Also increase max health on level up (+10 per level)
      health = game_state.health || %{"current" => 100, "max" => 100}
      max_hp = get_stat(health, "max", 100)
      current_hp = get_stat(health, "current", max_hp)
      new_max_hp = max_hp + levels_gained * 10
      # Heal on level up
      new_current_hp = current_hp + levels_gained * 10

      new_health =
        health
        |> Map.put("max", new_max_hp)
        |> Map.put("current", new_current_hp)

      {:ok, updated_state} =
        PlayerGameState.update_state(game_state, %{
          stats: new_stats,
          health: new_health
        })

      level_up_info = %{
        new_level: new_level,
        skill_points_gained: skill_points_gained,
        old_level: current_level
      }

      {:ok, updated_state, level_up_info}
    else
      # No level up, just add XP
      new_stats = Map.put(stats, "xp", new_xp)

      {:ok, updated_state} = PlayerGameState.update_state(game_state, %{stats: new_stats})
      {:ok, updated_state, nil}
    end
  end

  @doc """
  Gets a player's current progression stats.
  """
  def get_progression_stats(%PlayerGameState{} = game_state) do
    stats = game_state.stats || %{}

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
  def can_learn_skill?(%PlayerGameState{} = game_state, skill_cost) do
    stats = game_state.stats || %{}
    skill_points = get_stat(stats, "skill_points", 0)
    skill_points >= skill_cost
  end

  @doc """
  Learns a skill, consuming skill points.

  Returns {:ok, updated_state} or {:error, reason}
  """
  def learn_skill(%PlayerGameState{} = game_state, skill_id, skill_cost) do
    stats = game_state.stats || %{}
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

        PlayerGameState.update_state(game_state, %{stats: new_stats})
    end
  end

  @doc """
  Checks if player has learned a specific skill.
  """
  def has_skill?(%PlayerGameState{} = game_state, skill_id) do
    stats = game_state.stats || %{}
    learned_skills = get_stat(stats, "skills", [])
    skill_id in learned_skills
  end

  # Helper to get stat with fallback for string/atom keys
  defp get_stat(map, key, default) do
    Map.get(map, key) || Map.get(map, String.to_atom(key)) || default
  end
end
