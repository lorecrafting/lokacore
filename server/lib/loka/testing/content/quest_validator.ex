defmodule Loka.Testing.Content.QuestValidator do
  @moduledoc """
  Validates quest definitions for completability.

  Checks that all quest objectives can be fulfilled:
  - Kill targets exist and have combatant component
  - Talk targets exist and have dialogue component
  - Item collection targets exist as prototypes
  - Location targets exist as room prototypes
  - Reward items exist as prototypes

  ## Usage

      {:ok, results} = QuestValidator.validate()

      # Check specific quest
      {:ok, issues} = QuestValidator.validate_quest("find_the_artifact")

  ## Result Structure

      %{
        quests_checked: 5,
        errors: [
          {:missing_kill_target, "slay_goblins", "goblin_king"},
          {:target_not_combatant, "defeat_merchant", "friendly_merchant"}
        ],
        warnings: [
          {:reward_item_not_found, "fetch_quest", "rare_gem"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

  @type validation_result :: %{
          quests_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:missing_kill_target, String.t(), String.t()}
          | {:target_not_combatant, String.t(), String.t()}
          | {:missing_talk_target, String.t(), String.t()}
          | {:target_no_dialogue, String.t(), String.t()}
          | {:missing_collect_item, String.t(), String.t()}
          | {:missing_location, String.t(), String.t()}

  @type warning ::
          {:reward_item_not_found, String.t(), String.t()}
          | {:no_objectives, String.t()}

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates all quest prototypes.

  Returns `{:ok, results}` with validation results.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    # Get all prototypes and find quests
    all_prototypes = TypedObjectLoader.all()

    quests =
      all_prototypes
      |> Enum.filter(fn proto ->
        Map.get(proto.components || %{}, "quest") != nil
      end)

    # Validate each quest
    {errors, warnings} =
      Enum.reduce(quests, {[], []}, fn quest, {errs, warns} ->
        {quest_errors, quest_warnings} = validate_single_quest(quest)
        {errs ++ quest_errors, warns ++ quest_warnings}
      end)

    results = %{
      quests_checked: length(quests),
      errors: errors,
      warnings: warnings
    }

    Logger.info(
      "QuestValidator: Checked #{results.quests_checked} quests, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Validates a specific quest by key.
  """
  @spec validate_quest(String.t()) :: {:ok, {[error()], [warning()]}} | {:error, :not_found}
  def validate_quest(quest_key) do
    case TypedObjectLoader.get(quest_key) do
      {:error, :not_found} ->
        {:error, :not_found}

      {:ok, proto} ->
        {:ok, validate_single_quest(proto)}
    end
  end

  @doc """
  Returns true if validation passes (no errors).
  """
  @spec valid?() :: boolean()
  def valid? do
    {:ok, results} = validate()
    Enum.empty?(results.errors)
  end

  @doc """
  Formats validation results as a human-readable report.
  """
  @spec format_report(validation_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== Quest Validation Report ===",
      "",
      "Quests checked: #{results.quests_checked}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_warning/1) ++
          [""]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ warning_lines ++ status, "\n")
  end

  # =============================================================================
  # Private - Quest Validation
  # =============================================================================

  defp validate_single_quest(quest_proto) do
    quest_key = quest_proto.key
    quest_component = Map.get(quest_proto.components || %{}, "quest", %{})

    objectives =
      Map.get(quest_component, "objectives") || Map.get(quest_component, :objectives) || []

    rewards = Map.get(quest_component, "rewards") || Map.get(quest_component, :rewards) || %{}

    # Check if quest has objectives
    warnings =
      if Enum.empty?(objectives) do
        [{:no_objectives, quest_key}]
      else
        []
      end

    # Validate each objective
    objective_results =
      Enum.map(objectives, &validate_objective(quest_key, &1))

    objective_errors = Enum.flat_map(objective_results, fn {errs, _} -> errs end)
    objective_warnings = Enum.flat_map(objective_results, fn {_, warns} -> warns end)

    # Validate rewards
    reward_warnings = validate_rewards(quest_key, rewards)

    {objective_errors, warnings ++ objective_warnings ++ reward_warnings}
  end

  defp validate_objective(quest_key, objective) do
    type = Map.get(objective, "type") || Map.get(objective, :type)
    target = Map.get(objective, "target_id") || Map.get(objective, :target_id)

    case type do
      t when t in ["kill", :kill] ->
        validate_kill_target(quest_key, target)

      t when t in ["talk", :talk] ->
        validate_talk_target(quest_key, target)

      t when t in ["collect", :collect] ->
        validate_collect_target(quest_key, target)

      t when t in ["visit", :visit, "location", :location] ->
        validate_location_target(quest_key, target)

      _ ->
        {[], []}
    end
  end

  defp validate_kill_target(_quest_key, nil), do: {[], []}

  defp validate_kill_target(quest_key, target_key) do
    case TypedObjectLoader.get(target_key) do
      {:error, :not_found} ->
        {[{:missing_kill_target, quest_key, target_key}], []}

      {:ok, proto} ->
        if has_component?(proto, "combatant") do
          {[], []}
        else
          {[{:target_not_combatant, quest_key, target_key}], []}
        end
    end
  end

  defp validate_talk_target(_quest_key, nil), do: {[], []}

  defp validate_talk_target(quest_key, target_key) do
    case TypedObjectLoader.get(target_key) do
      {:error, :not_found} ->
        {[{:missing_talk_target, quest_key, target_key}], []}

      {:ok, proto} ->
        if has_component?(proto, "dialogue_tree") do
          {[], []}
        else
          {[{:target_no_dialogue, quest_key, target_key}], []}
        end
    end
  end

  defp validate_collect_target(_quest_key, nil), do: {[], []}

  defp validate_collect_target(quest_key, target_key) do
    case TypedObjectLoader.get(target_key) do
      {:error, :not_found} ->
        {[{:missing_collect_item, quest_key, target_key}], []}

      {:ok, _proto} ->
        {[], []}
    end
  end

  defp validate_location_target(_quest_key, nil), do: {[], []}

  defp validate_location_target(quest_key, target_key) do
    case TypedObjectLoader.get(target_key) do
      {:error, :not_found} ->
        {[{:missing_location, quest_key, target_key}], []}

      {:ok, proto} ->
        if proto.subtype == :room do
          {[], []}
        else
          {[{:missing_location, quest_key, target_key}], []}
        end
    end
  end

  defp validate_rewards(quest_key, rewards) do
    items = Map.get(rewards, "items") || Map.get(rewards, :items) || []

    Enum.flat_map(items, fn item_key ->
      case TypedObjectLoader.get(item_key) do
        {:error, :not_found} ->
          [{:reward_item_not_found, quest_key, item_key}]

        {:ok, _} ->
          []
      end
    end)
  end

  # sobelow_skip ["DOS.StringToAtom"] - component_name from known validation checks
  defp has_component?(proto, component_name) do
    components = proto.components || %{}

    Map.has_key?(components, component_name) or
      Map.has_key?(components, String.to_atom(component_name))
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:missing_kill_target, quest, target}) do
    "  - Quest '#{quest}': Kill target '#{target}' not found"
  end

  defp format_error({:target_not_combatant, quest, target}) do
    "  - Quest '#{quest}': Kill target '#{target}' has no combatant component"
  end

  defp format_error({:missing_talk_target, quest, target}) do
    "  - Quest '#{quest}': Talk target '#{target}' not found"
  end

  defp format_error({:target_no_dialogue, quest, target}) do
    "  - Quest '#{quest}': Talk target '#{target}' has no dialogue component"
  end

  defp format_error({:missing_collect_item, quest, target}) do
    "  - Quest '#{quest}': Collect item '#{target}' not found"
  end

  defp format_error({:missing_location, quest, target}) do
    "  - Quest '#{quest}': Location '#{target}' not found or not a room"
  end

  defp format_warning({:reward_item_not_found, quest, item}) do
    "  - Quest '#{quest}': Reward item '#{item}' not found"
  end

  defp format_warning({:no_objectives, quest}) do
    "  - Quest '#{quest}': Has no objectives defined"
  end
end
