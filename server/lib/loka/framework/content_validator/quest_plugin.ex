defmodule Loka.Framework.ContentValidator.QuestPlugin do
  @moduledoc """
  ContentValidator plugin for quest validation.

  Validates quest definitions including:
  - Objective targets exist (NPCs, rooms, items)
  - Dialogue topics exist in NPCs
  - Quest givers have proper dialogue trees
  - Prerequisites are valid
  - Storyline assignments (orphaned quests are errors)
  - Reward items exist
  """

  @behaviour Loka.Engine.ContentValidator.Plugin

  alias Loka.Framework.Quest.Validator, as: QuestValidator

  @impl true
  def name, do: :quest

  @impl true
  def ready? do
    # DB-backed Content.Quest is always available
    true
  end

  @impl true
  def validate do
    {:ok, results} = QuestValidator.validate()

    # Convert quest errors - all are critical
    critical =
      Enum.map(results.errors, fn error ->
        format_error(error)
      end)

    # Some warnings are promoted to critical errors:
    # - Orphaned quests (not in any storyline) - unreachable content
    # - Missing reward items - quest can't give rewards
    # - No objectives - quest has no win condition
    {promoted_errors, remaining_warnings} =
      Enum.split_with(results.warnings, fn warning ->
        case warning do
          {:orphaned_quest, _} -> true
          {:reward_item_not_found, _, _} -> true
          {:no_objectives, _} -> true
          _ -> false
        end
      end)

    promoted_critical = Enum.map(promoted_errors, &format_warning_as_error/1)
    warnings = Enum.map(remaining_warnings, &format_warning/1)

    %{critical: critical ++ promoted_critical, warnings: warnings}
  end

  defp format_error({:missing_target, quest_id, obj_type, target_id}) do
    "Quest '#{quest_id}': #{obj_type} objective references non-existent target '#{target_id}'"
  end

  defp format_error({:missing_dialogue_topic, quest_id, npc_key, topic}) do
    "Quest '#{quest_id}': NPC '#{npc_key}' is missing dialogue topic '#{topic}'"
  end

  defp format_error({:missing_quest_giver, quest_id, giver}) do
    "Quest '#{quest_id}': Giver NPC '#{giver}' not found"
  end

  defp format_error({:giver_no_dialogue, quest_id, giver}) do
    "Quest '#{quest_id}': Giver '#{giver}' has no dialogue tree"
  end

  defp format_error({:circular_prerequisite, quest_id, cycle}) do
    "Quest '#{quest_id}': Circular prerequisite detected: #{Enum.join(cycle, " -> ")}"
  end

  defp format_error({:missing_prerequisite, quest_id, prereq}) do
    "Quest '#{quest_id}': Prerequisite quest '#{prereq}' not found"
  end

  defp format_error({:invalid_objective, quest_id, obj_id, reason}) do
    "Quest '#{quest_id}' objective '#{obj_id}': #{reason}"
  end

  defp format_error(error) do
    inspect(error)
  end

  defp format_warning_as_error({:orphaned_quest, quest_id}) do
    "Quest '#{quest_id}' is not assigned to any storyline (unreachable content)"
  end

  defp format_warning_as_error({:reward_item_not_found, quest_id, item_key}) do
    "Quest '#{quest_id}': Reward item '#{item_key}' not found"
  end

  defp format_warning_as_error({:no_objectives, quest_id}) do
    "Quest '#{quest_id}' has no objectives defined (cannot be completed)"
  end

  defp format_warning_as_error(warning) do
    inspect(warning)
  end

  defp format_warning({:giver_no_accept_action, quest_id, giver}) do
    "Quest '#{quest_id}': Giver '#{giver}' has no accept_quest action for this quest"
  end

  defp format_warning(warning) do
    inspect(warning)
  end
end
