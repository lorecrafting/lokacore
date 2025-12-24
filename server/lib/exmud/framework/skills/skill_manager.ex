defmodule Exmud.Framework.Skills.SkillManager do
  @moduledoc """
  Manages player skill progression, training, and point allocation.

  ## LegendMUD-Style Point System

  Players have a limited pool of skill points (default: 100) to distribute.
  Higher skill levels cost more points, creating meaningful choices between
  specialization and versatility.

  ## Usage

      alias Exmud.Framework.Skills.SkillManager

      # Get player's skill level
      level = SkillManager.get_level(game_state, "swordsmanship")

      # Train a skill (spend points)
      {:ok, state} = SkillManager.train(game_state, "swordsmanship")

      # Practice a skill (gain XP from use)
      {:ok, state} = SkillManager.practice(game_state, "swordsmanship", 5)

      # Check points remaining
      remaining = SkillManager.points_remaining(game_state)
  """

  alias Exmud.Framework.Skills.{Skill, SkillRegistry}
  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @default_max_points 100

  # =============================================================================
  # Skill Level Queries
  # =============================================================================

  @doc """
  Gets a player's current level in a skill.
  """
  def get_level(%GameState{} = game_state, skill_key) do
    skills = get_player_skills(game_state)
    skill_data = Map.get(skills, skill_key, %{})
    Map.get(skill_data, :level, 0)
  end

  @doc """
  Gets a player's current XP in a skill.
  """
  def get_xp(%GameState{} = game_state, skill_key) do
    skills = get_player_skills(game_state)
    skill_data = Map.get(skills, skill_key, %{})
    Map.get(skill_data, :xp, 0)
  end

  @doc """
  Lists all skills a player has trained.
  """
  def list_trained_skills(%GameState{} = game_state) do
    get_player_skills(game_state)
    |> Enum.filter(fn {_key, data} -> Map.get(data, :level, 0) > 0 end)
    |> Enum.map(fn {key, data} ->
      %{
        skill: key,
        level: Map.get(data, :level, 0),
        xp: Map.get(data, :xp, 0)
      }
    end)
  end

  # =============================================================================
  # Point Management
  # =============================================================================

  @doc """
  Gets total skill points allocated by player.
  """
  def points_spent(%GameState{} = game_state) do
    get_player_skills(game_state)
    |> Enum.reduce(0, fn {skill_key, data}, acc ->
      level = Map.get(data, :level, 0)

      if level > 0 do
        case SkillRegistry.get(skill_key) do
          {:ok, skill_def} -> acc + Skill.total_points_spent(skill_def, level)
          _ -> acc + level
        end
      else
        acc
      end
    end)
  end

  @doc """
  Gets remaining skill points available.
  """
  def points_remaining(%GameState{} = game_state) do
    max_points = get_max_points(game_state)
    max_points - points_spent(game_state)
  end

  @doc """
  Gets max skill points for a player.
  """
  def get_max_points(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :max_skill_points, @default_max_points)
  end

  # =============================================================================
  # Skill Training
  # =============================================================================

  @doc """
  Trains a skill by spending points (increases level).

  Returns `{:ok, updated_state}` or `{:error, reason}`.
  """
  def train(%GameState{} = game_state, skill_key) do
    with {:ok, skill_def} <- SkillRegistry.get(skill_key),
         :ok <- check_prerequisites(game_state, skill_def),
         current_level <- get_level(game_state, skill_key),
         :ok <- check_not_maxed(skill_def, current_level),
         :ok <- check_can_afford_point(game_state, skill_def, current_level + 1) do
      new_level = current_level + 1

      skills = get_player_skills(game_state)
      skill_data = Map.get(skills, skill_key, %{level: 0, xp: 0})
      updated_skill = Map.put(skill_data, :level, new_level)
      updated_skills = Map.put(skills, skill_key, updated_skill)

      {:ok, put_player_skills(game_state, updated_skills)}
    end
  end

  @doc """
  Reduces a skill level, refunding points.
  """
  def untrain(%GameState{} = game_state, skill_key) do
    current_level = get_level(game_state, skill_key)

    if current_level > 0 do
      skills = get_player_skills(game_state)
      skill_data = Map.get(skills, skill_key, %{level: 0, xp: 0})
      updated_skill = Map.put(skill_data, :level, current_level - 1)
      updated_skills = Map.put(skills, skill_key, updated_skill)

      {:ok, put_player_skills(game_state, updated_skills)}
    else
      {:error, :skill_not_trained}
    end
  end

  # =============================================================================
  # Skill Practice (XP Gain)
  # =============================================================================

  @doc """
  Grants practice XP to a skill from using it.

  Automatically levels up if enough XP accumulated.
  """
  def practice(%GameState{} = game_state, skill_key, xp_amount \\ nil) do
    case SkillRegistry.get(skill_key) do
      {:ok, skill_def} ->
        xp_gain = xp_amount || skill_def.xp_per_use
        current_level = get_level(game_state, skill_key)
        current_xp = get_xp(game_state, skill_key)

        if current_level >= skill_def.max_level do
          {:ok, game_state}
        else
          new_xp = current_xp + xp_gain
          xp_needed = Skill.xp_for_level(skill_def, current_level + 1)

          {final_level, final_xp} =
            if new_xp >= xp_needed and
                 can_afford_next_level?(game_state, skill_def, current_level) do
              {current_level + 1, new_xp - xp_needed}
            else
              {current_level, new_xp}
            end

          skills = get_player_skills(game_state)
          updated_skill = %{level: final_level, xp: final_xp}
          updated_skills = Map.put(skills, skill_key, updated_skill)

          {:ok, put_player_skills(game_state, updated_skills)}
        end

      {:error, _} ->
        {:error, :unknown_skill}
    end
  end

  # =============================================================================
  # Validation
  # =============================================================================

  defp check_prerequisites(%GameState{} = game_state, %Skill{} = skill_def) do
    player_skills =
      get_player_skills(game_state)
      |> Enum.map(fn {key, data} -> {key, Map.get(data, :level, 0)} end)
      |> Enum.into(%{})

    if Skill.prerequisites_met?(skill_def, player_skills) do
      :ok
    else
      {:error, {:prerequisites_not_met, skill_def.prerequisites}}
    end
  end

  defp check_not_maxed(%Skill{max_level: max}, current_level) do
    if current_level < max do
      :ok
    else
      {:error, :skill_maxed}
    end
  end

  defp check_can_afford_point(%GameState{} = game_state, %Skill{} = skill_def, target_level) do
    cost = Skill.point_cost(skill_def, target_level)
    remaining = points_remaining(game_state)

    if remaining >= cost do
      :ok
    else
      {:error, {:insufficient_points, cost, remaining}}
    end
  end

  defp can_afford_next_level?(%GameState{} = game_state, %Skill{} = skill_def, current_level) do
    cost = Skill.point_cost(skill_def, current_level + 1)
    points_remaining(game_state) >= cost
  end

  # =============================================================================
  # State Helpers
  # =============================================================================

  defp get_player_skills(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :skills, %{})
  end

  defp put_player_skills(%GameState{stats: stats} = game_state, skills) do
    updated_stats = Map.put(stats, :skills, skills)
    %{game_state | stats: updated_stats}
  end
end
