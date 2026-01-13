defmodule Loka.Framework.Quest.Handlers.GoToHandler do
  @moduledoc """
  Objective handler for location/visit objectives.

  Tracks progress when the player enters rooms with matching keys.

  ## YAML Format

      objectives:
        - id: visit_temple
          type: go_to
          target_id: ancient_temple  # Prototype key of room to visit
          description: "Visit the Ancient Temple"

  ## Event Format

      %{
        type: :go_to,
        target_id: "ancient_temple"  # The prototype key of the entered room
      }

  ## Notes

  - This is a binary completion objective (0 or 1)
  - Entering the target room once completes the objective
  - target_count is always treated as 1
  """

  @behaviour Loka.Framework.Quest.ObjectiveHandler

  alias Loka.Framework.Quest.Handlers.ObjectiveHelper

  @impl true
  def type, do: :go_to

  @impl true
  def matches?(objective_def, event) do
    ObjectiveHelper.matches_type_and_target?(objective_def, event, :go_to)
  end

  @impl true
  def progress(_objective_def, _event, _current_progress) do
    # go_to is binary - once you've been there, you're done
    1
  end

  @impl true
  def is_complete?(_objective_def, progress) do
    progress >= 1
  end

  @impl true
  def validate(objective_def) do
    ObjectiveHelper.validate_target_id(
      objective_def,
      "go_to objective requires target_id (room prototype key)"
    )
  end

  @impl true
  def description(objective_def, _progress) do
    # go_to objectives don't show progress counts
    ObjectiveHelper.get_description(objective_def)
  end
end
