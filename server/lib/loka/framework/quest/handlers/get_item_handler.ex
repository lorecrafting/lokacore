defmodule Loka.Framework.Quest.Handlers.GetItemHandler do
  @moduledoc """
  Objective handler for item collection objectives.

  Tracks progress when items with matching keys are picked up.

  ## YAML Format

      objectives:
        - id: find_sword
          type: get_item
          target_id: ancient_sword   # Prototype key of item to obtain
          target_count: 1            # Number to collect (default: 1)
          description: "Find the Ancient Sword"

  ## Event Format

      %{
        type: :get_item,
        target_id: "ancient_sword",  # The prototype key of the obtained item
        count: 1                     # Number obtained (default: 1)
      }
  """

  @behaviour Loka.Framework.Quest.ObjectiveHandler

  alias Loka.Framework.Quest.Handlers.ObjectiveHelper

  @impl true
  def type, do: :get_item

  @impl true
  def matches?(objective_def, event) do
    ObjectiveHelper.matches_type_and_target?(objective_def, event, :get_item)
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
    ObjectiveHelper.validate_target_id(
      objective_def,
      "get_item objective requires target_id (item prototype key)"
    )
  end

  @impl true
  def description(objective_def, progress) do
    target_count = ObjectiveHelper.get_target_count(objective_def)
    desc = ObjectiveHelper.get_description(objective_def)
    ObjectiveHelper.format_progress_description(desc, progress, target_count)
  end
end
