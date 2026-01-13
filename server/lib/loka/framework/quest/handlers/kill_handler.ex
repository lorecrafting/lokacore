defmodule Loka.Framework.Quest.Handlers.KillHandler do
  @moduledoc """
  Objective handler for kill/defeat objectives.

  Tracks progress when entities with matching keys are defeated.

  ## YAML Format

      objectives:
        - id: defeat_goblins
          type: kill
          target_id: goblin       # Prototype key of enemy to defeat
          target_count: 5         # Number to defeat (default: 1)
          description: "Defeat 5 goblins"

  ## Event Format

      %{
        type: :kill,
        target_id: "goblin",      # The prototype key of the defeated entity
        count: 1                  # Number defeated (default: 1)
      }
  """

  @behaviour Loka.Framework.Quest.ObjectiveHandler

  alias Loka.Framework.Quest.Handlers.ObjectiveHelper

  @impl true
  def type, do: :kill

  @impl true
  def matches?(objective_def, event) do
    ObjectiveHelper.matches_type_and_target?(objective_def, event, :kill)
  end

  @impl true
  def progress(_objective_def, event, current_progress) do
    ObjectiveHelper.increment_progress(event, current_progress)
  end

  @impl true
  def is_complete?(objective_def, progress) do
    target_count = ObjectiveHelper.get_target_count(objective_def)
    ObjectiveHelper.progress_complete?(progress, target_count)
  end

  @impl true
  def validate(objective_def) do
    ObjectiveHelper.validate_all([
      ObjectiveHelper.validate_target_id(
        objective_def,
        "kill objective requires target_id (enemy prototype key)"
      ),
      ObjectiveHelper.validate_target_count(objective_def)
    ])
  end

  @impl true
  def description(objective_def, progress) do
    target_count = ObjectiveHelper.get_target_count(objective_def)
    desc = ObjectiveHelper.get_description(objective_def)
    ObjectiveHelper.format_progress_description(desc, progress, target_count)
  end
end
