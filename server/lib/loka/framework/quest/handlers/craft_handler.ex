defmodule Loka.Framework.Quest.Handlers.CraftHandler do
  @moduledoc """
  Objective handler for crafting objectives.

  Tracks progress when items are crafted using matching recipe keys.

  ## YAML Format

      objectives:
        - id: brew_tea
          type: craft
          target_id: recipe_calming_tea   # Recipe key to craft
          target_count: 1                  # Number to craft (default: 1)
          description: "Brew a calming tea"

  ## Event Format

      %{
        type: :craft,
        target_id: "recipe_calming_tea",  # The recipe key of the crafted item
        count: 1                           # Number crafted (default: 1)
      }
  """

  @behaviour Loka.Framework.Quest.ObjectiveHandler

  alias Loka.Framework.Quest.Handlers.ObjectiveHelper

  @impl true
  def type, do: :craft

  @impl true
  def matches?(objective_def, event) do
    ObjectiveHelper.matches_type_and_target?(objective_def, event, :craft)
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
      "craft objective requires target_id (recipe key)"
    )
  end

  @impl true
  def description(objective_def, progress) do
    target_count = ObjectiveHelper.get_target_count(objective_def)
    desc = ObjectiveHelper.get_description(objective_def)
    ObjectiveHelper.format_progress_description(desc, progress, target_count)
  end
end
