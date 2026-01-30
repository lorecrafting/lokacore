defmodule Loka.Framework.Skills.BinarySkillManager do
  @moduledoc """
  Manages binary skill learning and point allocation.

  ## Point System

  - **50 total skill points** (1 per level, max level 50)
  - **Skills cost 1-3 points** to learn
  - **Binary:** Once learned, you know the skill permanently
  - **Stats determine effectiveness:** High STR = better Kick, etc.

  ## State Storage

  Player skills are stored as a MapSet of learned skill keys:

      game_state.stats[:learned_skills] = MapSet.new(["kick", "bash", "parry"])

  ## Usage

      alias Loka.Framework.Skills.BinarySkillManager

      # Check if skill is learned
      BinarySkillManager.knows?(game_state, "kick")

      # Learn a skill
      {:ok, state} = BinarySkillManager.learn(game_state, "kick")

      # Get points spent/remaining
      BinarySkillManager.points_spent(game_state)
      BinarySkillManager.points_remaining(game_state)

      # List known skills
      BinarySkillManager.learned_skills(game_state)
  """

  alias Loka.Framework.Skills.{BinarySkill, BinarySkillRegistry}
  alias Loka.Framework.Player.GameState
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
  @spec knows?(GameState.t(), String.t()) :: boolean()
  def knows?(%GameState{} = game_state, skill_key) do
    learned = get_learned_skills(game_state)
    MapSet.member?(learned, skill_key)
  end

  @doc """
  Returns all skills the player has learned.
  """
  @spec learned_skills(GameState.t()) :: MapSet.t(String.t())
  def learned_skills(%GameState{} = game_state) do
    get_learned_skills(game_state)
  end

  @doc """
  Returns learned skills as a list.
  """
  @spec learned_skills_list(GameState.t()) :: [String.t()]
  def learned_skills_list(%GameState{} = game_state) do
    game_state
    |> get_learned_skills()
    |> MapSet.to_list()
  end

  @doc """
  Returns learned skills with their definitions.
  """
  @spec learned_skills_with_info(GameState.t()) :: [BinarySkill.t()]
  def learned_skills_with_info(%GameState{} = game_state) do
    game_state
    |> get_learned_skills()
    |> Enum.map(&BinarySkillRegistry.get/1)
    |> Enum.filter(&match?({:ok, _}, &1))
    |> Enum.map(fn {:ok, skill} -> skill end)
  end

  @doc """
  Returns learned skills grouped by category.
  """
  @spec learned_skills_by_category(GameState.t()) :: %{atom() => [BinarySkill.t()]}
  def learned_skills_by_category(%GameState{} = game_state) do
    game_state
    |> learned_skills_with_info()
    |> Enum.group_by(& &1.category)
  end

  # =============================================================================
  # Point Management
  # =============================================================================

  @doc """
  Returns total skill points based on level.

  1 point per level, so level 50 = 50 points.
  """
  @spec total_points(GameState.t()) :: non_neg_integer()
  def total_points(%GameState{} = game_state) do
    level = get_player_level(game_state)
    min(level * points_per_level(), max_skill_points())
  end

  @doc """
  Returns skill points currently spent.
  """
  @spec points_spent(GameState.t()) :: non_neg_integer()
  def points_spent(%GameState{} = game_state) do
    game_state
    |> get_learned_skills()
    |> Enum.reduce(0, fn skill_key, acc ->
      case BinarySkillRegistry.get(skill_key) do
        {:ok, skill} -> acc + skill.cost
        _ -> acc
      end
    end)
  end

  @doc """
  Returns available skill points.
  """
  @spec points_remaining(GameState.t()) :: non_neg_integer()
  def points_remaining(%GameState{} = game_state) do
    max(0, total_points(game_state) - points_spent(game_state))
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
  @spec learn(GameState.t(), String.t(), keyword()) ::
          {:ok, GameState.t(), map()} | {:error, term()}
  def learn(%GameState{} = game_state, skill_key, opts \\ []) do
    free = Keyword.get(opts, :free, false)

    with {:ok, skill} <- BinarySkillRegistry.get(skill_key),
         :ok <- check_not_already_learned(game_state, skill_key),
         :ok <- check_prerequisites(game_state, skill),
         :ok <- check_can_afford(game_state, skill, free) do
      learned = get_learned_skills(game_state)
      new_learned = MapSet.put(learned, skill_key)
      new_state = put_learned_skills(game_state, new_learned)

      audit = %{
        operation: :learn_skill,
        skill_key: skill_key,
        cost: if(free, do: 0, else: skill.cost),
        free: free,
        points_after: points_remaining(new_state),
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_state, audit}
    end
  end

  @doc """
  Forgets a skill, refunding points.

  Note: In some game designs, forgetting skills requires special conditions
  (e.g., visiting a respec NPC). This function allows it freely.
  """
  @spec forget(GameState.t(), String.t()) :: {:ok, GameState.t(), map()} | {:error, term()}
  def forget(%GameState{} = game_state, skill_key) do
    with {:ok, skill} <- BinarySkillRegistry.get(skill_key),
         :ok <- check_is_learned(game_state, skill_key),
         :ok <- check_no_dependents(game_state, skill_key) do
      learned = get_learned_skills(game_state)
      new_learned = MapSet.delete(learned, skill_key)
      new_state = put_learned_skills(game_state, new_learned)

      audit = %{
        operation: :forget_skill,
        skill_key: skill_key,
        refunded: skill.cost,
        points_after: points_remaining(new_state),
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_state, audit}
    end
  end

  # =============================================================================
  # Skill Usage Checks
  # =============================================================================

  @doc """
  Checks if a player can use a skill (knows it and has resources).
  """
  @spec can_use?(GameState.t(), String.t(), map()) :: {:ok, BinarySkill.t()} | {:error, term()}
  def can_use?(%GameState{} = game_state, skill_key, resources \\ %{}) do
    with {:ok, skill} <- BinarySkillRegistry.get(skill_key),
         :ok <- check_is_learned(game_state, skill_key),
         :ok <- check_has_resources(skill, resources) do
      {:ok, skill}
    end
  end

  @doc """
  Returns the effectiveness of a skill for this player.

  Based on the skill's governing stat.
  """
  @spec effectiveness(GameState.t(), String.t()) :: {:ok, float()} | {:error, term()}
  def effectiveness(%GameState{} = game_state, skill_key) do
    with {:ok, skill} <- BinarySkillRegistry.get(skill_key),
         :ok <- check_is_learned(game_state, skill_key) do
      stats = get_player_stats(game_state)
      {:ok, BinarySkill.effectiveness(skill, stats)}
    end
  end

  @doc """
  Returns the stat bonus for a skill.
  """
  @spec stat_bonus(GameState.t(), String.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def stat_bonus(%GameState{} = game_state, skill_key) do
    with {:ok, skill} <- BinarySkillRegistry.get(skill_key),
         :ok <- check_is_learned(game_state, skill_key) do
      stats = get_player_stats(game_state)
      {:ok, BinarySkill.stat_bonus(skill, stats)}
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
  @spec learnable_skills(GameState.t(), keyword()) :: [BinarySkill.t()]
  def learnable_skills(%GameState{} = game_state, opts \\ []) do
    include_unaffordable = Keyword.get(opts, :include_unaffordable, false)
    learned = get_learned_skills(game_state)
    remaining = points_remaining(game_state)

    BinarySkillRegistry.all()
    |> Enum.filter(fn skill ->
      not MapSet.member?(learned, skill.key) and
        BinarySkill.prerequisites_met?(skill, learned) and
        (include_unaffordable or skill.cost <= remaining)
    end)
  end

  @doc """
  Returns skills available from a specific trainer.
  """
  @spec skills_from_trainer(GameState.t(), String.t()) :: [BinarySkill.t()]
  def skills_from_trainer(%GameState{} = game_state, trainer_key) do
    learned = get_learned_skills(game_state)

    BinarySkillRegistry.by_trainer(trainer_key)
    |> Enum.filter(fn skill ->
      not MapSet.member?(learned, skill.key) and
        BinarySkill.prerequisites_met?(skill, learned)
    end)
  end

  # =============================================================================
  # Validation Helpers
  # =============================================================================

  defp check_not_already_learned(%GameState{} = game_state, skill_key) do
    if knows?(game_state, skill_key) do
      {:error, {:already_learned, skill_key}}
    else
      :ok
    end
  end

  defp check_is_learned(%GameState{} = game_state, skill_key) do
    if knows?(game_state, skill_key) do
      :ok
    else
      {:error, {:not_learned, skill_key}}
    end
  end

  defp check_prerequisites(%GameState{} = game_state, %BinarySkill{} = skill) do
    learned = get_learned_skills(game_state)

    if BinarySkill.prerequisites_met?(skill, learned) do
      :ok
    else
      {:error, {:prerequisites_not_met, skill.prerequisites}}
    end
  end

  defp check_can_afford(%GameState{}, %BinarySkill{}, true = _free), do: :ok

  defp check_can_afford(%GameState{} = game_state, %BinarySkill{cost: cost}, _free) do
    remaining = points_remaining(game_state)

    if remaining >= cost do
      :ok
    else
      {:error, {:insufficient_points, cost, remaining}}
    end
  end

  defp check_has_resources(%BinarySkill{} = skill, resources) do
    mv = Map.get(resources, :mv, 999_999)
    mana = Map.get(resources, :mana, 999_999)

    cond do
      not BinarySkill.has_mv?(skill, mv) ->
        {:error, {:insufficient_mv, skill.mv_cost, mv}}

      not BinarySkill.has_mana?(skill, mana) ->
        {:error, {:insufficient_mana, skill.mana_cost, mana}}

      true ->
        :ok
    end
  end

  defp check_no_dependents(%GameState{} = game_state, skill_key) do
    learned = get_learned_skills(game_state)

    # Find any learned skills that require this skill as a prerequisite
    dependents =
      learned
      |> Enum.filter(fn key ->
        case BinarySkillRegistry.get(key) do
          {:ok, skill} -> skill_key in skill.prerequisites
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

  defp get_learned_skills(%GameState{stats: stats}) do
    skills = MapHelpers.get_flexible(stats, :learned_skills, [])

    case skills do
      %MapSet{} -> skills
      list when is_list(list) -> MapSet.new(list)
      _ -> MapSet.new()
    end
  end

  defp put_learned_skills(%GameState{stats: stats} = game_state, learned) do
    updated_stats = Map.put(stats, :learned_skills, learned)
    %{game_state | stats: updated_stats}
  end

  defp get_player_level(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :level, 1)
  end

  defp get_player_stats(%GameState{stats: stats}) do
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
