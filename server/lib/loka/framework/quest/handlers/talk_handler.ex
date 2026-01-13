defmodule Loka.Framework.Quest.Handlers.TalkHandler do
  @moduledoc """
  Objective handler for dialogue/conversation objectives.

  Tracks progress when the player reaches specific dialogue nodes with NPCs.

  ## YAML Format

      objectives:
        - id: talk_to_abbot
          type: talk
          target_id: abbot_jampa     # NPC prototype key
          dialogue_topic: crisis     # Optional: specific dialogue node to reach
          description: "Speak with Abbot Jampa about the crisis"

  ## Event Format

      %{
        type: :talk,
        target_id: "abbot_jampa",    # NPC being talked to
        dialogue_topic: "crisis"      # Dialogue node reached
      }

  ## Notes

  - If `dialogue_topic` is specified in the objective, the player must reach
    that specific dialogue node to complete the objective
  - If `dialogue_topic` is nil/not specified, any dialogue with the NPC completes it
  - This is a binary completion objective (0 or 1)
  """

  @behaviour Loka.Framework.Quest.ObjectiveHandler

  alias Loka.Framework.Quest.Handlers.ObjectiveHelper

  @impl true
  def type, do: :talk

  @impl true
  def matches?(objective_def, event) do
    event_type = Map.get(event, :type)
    event_target = Map.get(event, :target_id)
    event_topic = Map.get(event, :dialogue_topic)

    obj_target = ObjectiveHelper.get_target_id(objective_def)
    obj_topic = ObjectiveHelper.get_dialogue_topic(objective_def)

    # Type and target must match
    type_matches = event_type == :talk && event_target == obj_target

    # If objective specifies a topic, event topic must match
    topic_matches =
      case obj_topic do
        nil -> true
        "" -> true
        expected -> expected == event_topic
      end

    type_matches && topic_matches
  end

  @impl true
  def progress(_objective_def, _event, _current_progress) do
    # talk is binary - once you've talked, you're done
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
      "talk objective requires target_id (NPC prototype key)"
    )
  end

  @impl true
  def description(objective_def, _progress) do
    # talk objectives don't show progress counts
    ObjectiveHelper.get_description(objective_def)
  end
end
