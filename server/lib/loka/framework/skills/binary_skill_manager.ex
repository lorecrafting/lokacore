defmodule Loka.Framework.Skills.BinarySkillManager do
  @moduledoc """
  Manages binary skill learning and point allocation.

  ## Point System

  - **50 total skill points** (1 per level, max level 50)
  - **Skills cost 1-3 points** to learn
  - **Binary:** Once learned, you know the skill permanently
  - **Stats determine effectiveness:** High STR = better Kick, etc.

  ## State Storage

  Player skills are stored in the character entity's stats component:

      entity.components["stats"]["learned_skills"] = MapSet.new(["kick", "bash", "parry"])

  ## Usage

      alias Loka.Framework.Skills.BinarySkillManager

      # Check if skill is learned
      BinarySkillManager.knows?(entity, "kick")

      # Learn a skill
      {:ok, entity} = BinarySkillManager.learn(entity, "kick")

      # Get points spent/remaining
      BinarySkillManager.points_spent(entity)
      BinarySkillManager.points_remaining(entity)

      # List known skills
      BinarySkillManager.learned_skills(entity)
  """

  alias Loka.Content.Skill, as: ContentSkill
  alias Loka.Engine.{Entity, TypedObject}
  alias Loka.Config.Balance
  alias Loka.Utils.MapHelpers

  # Defaults (used when Balance config not loaded)
  @default_points_per_level 1
  @default_max_level 50

  # =============================================================================
  # Skill Knowledge Queries
  # =============================================================================

  @doc """
  Checks if player knows a skill.
  """
  @spec knows?(Entity.t(), String.t()) :: boolean()
  def knows?(%Entity{} = entity, skill_key) do
    learned = get_learned_skills(entity)
    MapSet.member?(learned, skill_key)
  end

  @doc """
  Returns all skills the player has learned.
  """
  @spec learned_skills(Entity.t()) :: MapSet.t(String.t())
  def learned_skills(%Entity{} = entity) do
    get_learned_skills(entity)
  end

  @doc """
  Returns learned skills as a list.
  """
  @spec learned_skills_list(Entity.t()) :: [String.t()]
  def learned_skills_list(%Entity{} = entity) do
    entity
    |> get_learned_skills()
    |> MapSet.to_list()
  end

  @doc """
  Returns learned skills with their definitions.
  """
  @spec learned_skills_with_info(Entity.t()) :: [TypedObject.t()]
  def learned_skills_with_info(%Entity{} = entity) do
    entity
    |> get_learned_skills()
    |> Enum.map(&ContentSkill.get/1)
    |> Enum.filter(&match?({:ok, _}, &1))
    |> Enum.map(fn {:ok, skill} -> skill end)
  end

  @doc """
  Returns learned skills grouped by category.
  """
  @spec learned_skills_by_category(Entity.t()) :: %{String.t() => [TypedObject.t()]}
  def learned_skills_by_category(%Entity{} = entity) do
    entity
    |> learned_skills_with_info()
    |> Enum.group_by(&ContentSkill.category/1)
  end

  # =============================================================================
  # Point Management
  # =============================================================================

  @doc """
  Returns total skill points based on level.

  1 point per level, so level 50 = 50 points.
  """
  @spec total_points(Entity.t()) :: non_neg_integer()
  def total_points(%Entity{} = entity) do
    level = get_player_level(entity)
    min(level * points_per_level(), max_skill_points())
  end

  @doc """
  Returns skill points currently spent.
  """
  @spec points_spent(Entity.t()) :: non_neg_integer()
  def points_spent(%Entity{} = entity) do
    entity
    |> get_learned_skills()
    |> Enum.reduce(0, fn skill_key, acc ->
      case ContentSkill.get(skill_key) do
        {:ok, skill} -> acc + ContentSkill.cost(skill)
        _ -> acc
      end
    end)
  end

  @doc """
  Returns available skill points.
  """
  @spec points_remaining(Entity.t()) :: non_neg_integer()
  def points_remaining(%Entity{} = entity) do
    max(0, total_points(entity) - points_spent(entity))
  end

  # =============================================================================
  # Learning Skills
  # =============================================================================

  @doc """
  Learns a skill if requirements are met.

  Requirements:
  - Skill exists in registry
  - Player doesn't already know it
  - Prerequisites are met
  - Player has enough skill points

  ## Options

  - `:free` - Learn without spending points (quest reward, scroll, etc.)
  """
  @spec learn(Entity.t(), String.t(), keyword()) ::
          {:ok, Entity.t(), map()} | {:error, term()}
  def learn(%Entity{} = entity, skill_key, opts \\ []) do
    free = Keyword.get(opts, :free, false)

    with {:ok, skill} <- ContentSkill.get(skill_key),
         :ok <- check_not_already_learned(entity, skill_key),
         :ok <- check_prerequisites(entity, skill),
         :ok <- check_can_afford(entity, skill, free) do
      learned = get_learned_skills(entity)
      new_learned = MapSet.put(learned, skill_key)
      new_entity = put_learned_skills(entity, new_learned)

      audit = %{
        operation: :learn_skill,
        skill_key: skill_key,
        cost: if(free, do: 0, else: ContentSkill.cost(skill)),
        free: free,
        points_after: points_remaining(new_entity),
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_entity, audit}
    end
  end

  @doc """
  Forgets a skill, refunding points.

  Note: In some game designs, forgetting skills requires special conditions
  (e.g., visiting a respec NPC). This function allows it freely.
  """
  @spec forget(Entity.t(), String.t()) :: {:ok, Entity.t(), map()} | {:error, term()}
  def forget(%Entity{} = entity, skill_key) do
    with {:ok, skill} <- ContentSkill.get(skill_key),
         :ok <- check_is_learned(entity, skill_key),
         :ok <- check_no_dependents(entity, skill_key) do
      learned = get_learned_skills(entity)
      new_learned = MapSet.delete(learned, skill_key)
      new_entity = put_learned_skills(entity, new_learned)

      audit = %{
        operation: :forget_skill,
        skill_key: skill_key,
        refunded: ContentSkill.cost(skill),
        points_after: points_remaining(new_entity),
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_entity, audit}
    end
  end

  # =============================================================================
  # Skill Usage Checks
  # =============================================================================

  @doc """
  Checks if a player can use a skill (knows it and has resources).
  """
  @spec can_use?(Entity.t(), String.t(), map()) :: {:ok, TypedObject.t()} | {:error, term()}
  def can_use?(%Entity{} = entity, skill_key, resources \\ %{}) do
    with {:ok, skill} <- ContentSkill.get(skill_key),
         :ok <- check_is_learned(entity, skill_key),
         :ok <- check_has_resources(skill, resources) do
      {:ok, skill}
    end
  end

  @doc """
  Returns the effectiveness of a skill for this player.

  Based on the skill's governing stat.
  """
  @spec effectiveness(Entity.t(), String.t()) :: {:ok, float()} | {:error, term()}
  def effectiveness(%Entity{} = entity, skill_key) do
    with {:ok, skill} <- ContentSkill.get(skill_key),
         :ok <- check_is_learned(entity, skill_key) do
      stats = get_player_stats(entity)
      {:ok, ContentSkill.effectiveness(skill, stats)}
    end
  end

  @doc """
  Returns the stat bonus for a skill.
  """
  @spec stat_bonus(Entity.t(), String.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def stat_bonus(%Entity{} = entity, skill_key) do
    with {:ok, skill} <- ContentSkill.get(skill_key),
         :ok <- check_is_learned(entity, skill_key) do
      stats = get_player_stats(entity)
      {:ok, ContentSkill.stat_bonus(skill, stats)}
    end
  end

  # =============================================================================
  # Learnable Skills
  # =============================================================================

  @doc """
  Returns skills the player can currently learn.

  Filters for:
  - Not already learned
  - Prerequisites met
  - Can afford (unless include_unaffordable: true)
  """
  @spec learnable_skills(Entity.t(), keyword()) :: [TypedObject.t()]
  def learnable_skills(%Entity{} = entity, opts \\ []) do
    include_unaffordable = Keyword.get(opts, :include_unaffordable, false)
    learned = get_learned_skills(entity)
    remaining = points_remaining(entity)

    ContentSkill.all_binary()
    |> Enum.filter(fn skill ->
      not MapSet.member?(learned, skill.key) and
        ContentSkill.binary_prerequisites_met?(skill, learned) and
        (include_unaffordable or ContentSkill.cost(skill) <= remaining)
    end)
  end

  @doc """
  Returns skills available from a specific trainer.
  """
  @spec skills_from_trainer(Entity.t(), String.t()) :: [TypedObject.t()]
  def skills_from_trainer(%Entity{} = entity, trainer_key) do
    learned = get_learned_skills(entity)

    ContentSkill.by_trainer(trainer_key)
    |> Enum.filter(fn skill ->
      not MapSet.member?(learned, skill.key) and
        ContentSkill.binary_prerequisites_met?(skill, learned)
    end)
  end

  # =============================================================================
  # Validation Helpers
  # =============================================================================

  defp check_not_already_learned(%Entity{} = entity, skill_key) do
    if knows?(entity, skill_key) do
      {:error, {:already_learned, skill_key}}
    else
      :ok
    end
  end

  defp check_is_learned(%Entity{} = entity, skill_key) do
    if knows?(entity, skill_key) do
      :ok
    else
      {:error, {:not_learned, skill_key}}
    end
  end

  defp check_prerequisites(%Entity{} = entity, %TypedObject{} = skill) do
    learned = get_learned_skills(entity)

    if ContentSkill.binary_prerequisites_met?(skill, learned) do
      :ok
    else
      {:error, {:prerequisites_not_met, ContentSkill.prerequisites(skill)}}
    end
  end

  defp check_can_afford(%Entity{}, %TypedObject{}, true = _free), do: :ok

  defp check_can_afford(%Entity{} = entity, %TypedObject{} = skill, _free) do
    cost = ContentSkill.cost(skill)
    remaining = points_remaining(entity)

    if remaining >= cost do
      :ok
    else
      {:error, {:insufficient_points, cost, remaining}}
    end
  end

  defp check_has_resources(%TypedObject{} = skill, resources) do
    mv = Map.get(resources, :mv, 999_999)
    mana = Map.get(resources, :mana, 999_999)

    cond do
      not ContentSkill.has_mv?(skill, mv) ->
        {:error, {:insufficient_mv, ContentSkill.mv_cost(skill), mv}}

      not ContentSkill.has_mana?(skill, mana) ->
        {:error, {:insufficient_mana, ContentSkill.mana_cost(skill), mana}}

      true ->
        :ok
    end
  end

  defp check_no_dependents(%Entity{} = entity, skill_key) do
    learned = get_learned_skills(entity)

    # Find any learned skills that require this skill as a prerequisite
    dependents =
      learned
      |> Enum.filter(fn key ->
        case ContentSkill.get(key) do
          {:ok, skill} -> skill_key in ContentSkill.prerequisites(skill)
          _ -> false
        end
      end)

    if Enum.empty?(dependents) do
      :ok
    else
      {:error, {:has_dependents, dependents}}
    end
  end

  # =============================================================================
  # State Helpers
  # =============================================================================

  defp get_learned_skills(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    skills = MapHelpers.get_flexible(stats, :learned_skills, [])

    case skills do
      %MapSet{} -> skills
      list when is_list(list) -> MapSet.new(list)
      _ -> MapSet.new()
    end
  end

  defp put_learned_skills(%Entity{} = entity, learned) do
    stats = Entity.get_component(entity, "stats") || %{}
    updated_stats = Map.put(stats, :learned_skills, learned)
    Entity.add_component(entity, "stats", updated_stats)
  end

  defp get_player_level(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    MapHelpers.get_flexible(stats, :level, 1)
  end

  defp get_player_stats(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    # Extract the 6 primary stats
    %{
      str: MapHelpers.get_flexible(stats, :str, 10),
      dex: MapHelpers.get_flexible(stats, :dex, 10),
      con: MapHelpers.get_flexible(stats, :con, 10),
      int: MapHelpers.get_flexible(stats, :int, 10),
      per: MapHelpers.get_flexible(stats, :per, 10),
      spi: MapHelpers.get_flexible(stats, :spi, 10)
    }
  end

  # =============================================================================
  # Constants
  # =============================================================================

  @doc "Returns points gained per level (default: 1)."
  @spec points_per_level() :: pos_integer()
  def points_per_level do
    Balance.get(:skills, :points_per_level, default: @default_points_per_level)
  end

  @doc "Returns max level (default: 50)."
  @spec max_level() :: pos_integer()
  def max_level do
    Balance.get(:stats, :max_level, default: @default_max_level)
  end

  @doc "Returns total skill points at max level (default: 50)."
  @spec max_skill_points() :: pos_integer()
  def max_skill_points do
    Balance.get(:skills, :max_total_points, default: @default_max_level)
  end
end
