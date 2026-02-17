defmodule Loka.Framework.Skills.SkillManager do
  @moduledoc """
  Manages player skill progression, training, and point allocation.

  ## LegendMUD-Style Point System

  Players have a limited pool of skill points (default: 100) to distribute.
  Higher skill levels cost more points, creating meaningful choices between
  specialization and versatility.

  ## Usage

      alias Loka.Framework.Skills.SkillManager

      # Get player's skill level
      level = SkillManager.get_level(entity, "swordsmanship")

      # Train a skill (spend points)
      {:ok, entity} = SkillManager.train(entity, "swordsmanship")

      # Practice a skill (gain XP from use)
      {:ok, entity} = SkillManager.practice(entity, "swordsmanship", 5)

      # Check points remaining
      remaining = SkillManager.points_remaining(entity)
  """

  alias Loka.Content.Skill, as: ContentSkill
  alias Loka.Engine.Entity
  alias Loka.Utils.MapHelpers

  @default_max_points 100

  # =============================================================================
  # Skill Level Queries
  # =============================================================================

  @doc """
  Gets a player's current level in a skill.
  """
  def get_level(%Entity{} = entity, skill_key) do
    skills = get_player_skills(entity)
    skill_data = Map.get(skills, skill_key, %{})
    Map.get(skill_data, :level, 0)
  end

  @doc """
  Gets a player's current XP in a skill.
  """
  def get_xp(%Entity{} = entity, skill_key) do
    skills = get_player_skills(entity)
    skill_data = Map.get(skills, skill_key, %{})
    Map.get(skill_data, :xp, 0)
  end

  @doc """
  Lists all skills a player has trained.
  """
  def list_trained_skills(%Entity{} = entity) do
    get_player_skills(entity)
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
  def points_spent(%Entity{} = entity) do
    get_player_skills(entity)
    |> Enum.reduce(0, fn {skill_key, data}, acc ->
      level = Map.get(data, :level, 0)

      if level > 0 do
        case ContentSkill.get(skill_key) do
          {:ok, skill_def} -> acc + ContentSkill.total_points_spent(skill_def, level)
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
  def points_remaining(%Entity{} = entity) do
    max_points = get_max_points(entity)
    max_points - points_spent(entity)
  end

  @doc """
  Gets max skill points for a player.
  """
  def get_max_points(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    MapHelpers.get_flexible(stats, :max_skill_points, @default_max_points)
  end

  # =============================================================================
  # Skill Training
  # =============================================================================

  @doc """
  Trains a skill by spending points (increases level).

  Returns `{:ok, updated_entity}` or `{:error, reason}`.
  """
  def train(%Entity{} = entity, skill_key) do
    with {:ok, skill_def} <- ContentSkill.get(skill_key),
         :ok <- check_prerequisites(entity, skill_def),
         current_level <- get_level(entity, skill_key),
         :ok <- check_not_maxed(skill_def, current_level),
         :ok <- check_can_afford_point(entity, skill_def, current_level + 1) do
      new_level = current_level + 1

      skills = get_player_skills(entity)
      skill_data = Map.get(skills, skill_key, %{level: 0, xp: 0})
      updated_skill = Map.put(skill_data, :level, new_level)
      updated_skills = Map.put(skills, skill_key, updated_skill)

      {:ok, put_player_skills(entity, updated_skills)}
    end
  end

  # =============================================================================
  # Skill Practice (XP Gain)
  # =============================================================================

  @doc """
  Grants practice XP to a skill from using it.

  Automatically levels up if enough XP accumulated.
  """
  def practice(%Entity{} = entity, skill_key, xp_amount \\ nil) do
    case ContentSkill.get(skill_key) do
      {:ok, skill_def} ->
        xp_gain = xp_amount || ContentSkill.xp_per_use(skill_def)
        current_level = get_level(entity, skill_key)
        current_xp = get_xp(entity, skill_key)

        if current_level >= ContentSkill.max_level(skill_def) do
          {:ok, entity}
        else
          new_xp = current_xp + xp_gain
          xp_needed = ContentSkill.xp_for_level(skill_def, current_level + 1)

          {final_level, final_xp} =
            if new_xp >= xp_needed and
                 can_afford_next_level?(entity, skill_def, current_level) do
              {current_level + 1, new_xp - xp_needed}
            else
              {current_level, new_xp}
            end

          skills = get_player_skills(entity)
          updated_skill = %{level: final_level, xp: final_xp}
          updated_skills = Map.put(skills, skill_key, updated_skill)

          {:ok, put_player_skills(entity, updated_skills)}
        end

      {:error, _} ->
        {:error, :unknown_skill}
    end
  end

  # =============================================================================
  # Validation
  # =============================================================================

  defp check_prerequisites(%Entity{} = entity, %Entity{} = skill_def) do
    player_skills =
      get_player_skills(entity)
      |> Enum.map(fn {key, data} -> {key, Map.get(data, :level, 0)} end)
      |> Enum.into(%{})

    if ContentSkill.prerequisites_met?(skill_def, player_skills) do
      :ok
    else
      {:error, {:prerequisites_not_met, ContentSkill.prerequisites(skill_def)}}
    end
  end

  defp check_not_maxed(%Entity{} = skill_def, current_level) do
    max = ContentSkill.max_level(skill_def)

    if current_level < max do
      :ok
    else
      {:error, :skill_maxed}
    end
  end

  defp check_can_afford_point(%Entity{} = entity, %Entity{} = skill_def, target_level) do
    cost = ContentSkill.point_cost(skill_def, target_level)
    remaining = points_remaining(entity)

    if remaining >= cost do
      :ok
    else
      {:error, {:insufficient_points, cost, remaining}}
    end
  end

  defp can_afford_next_level?(
         %Entity{} = entity,
         %Entity{} = skill_def,
         current_level
       ) do
    cost = ContentSkill.point_cost(skill_def, current_level + 1)
    points_remaining(entity) >= cost
  end

  # =============================================================================
  # State Helpers
  # =============================================================================

  defp get_player_skills(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    MapHelpers.get_flexible(stats, :skills, %{})
  end

  defp put_player_skills(%Entity{} = entity, skills) do
    stats = Entity.get_component(entity, "stats") || %{}
    updated_stats = Map.put(stats, :skills, skills)
    Entity.add_component(entity, "stats", updated_stats)
  end
end
