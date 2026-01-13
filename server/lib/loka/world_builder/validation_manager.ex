defmodule Loka.WorldBuilder.ValidationManager do
  @moduledoc """
  Coordinates real-time validation for World Builder.

  Integrates existing validators and provides live feedback.
  """

  alias Loka.Testing.Content.{QuestValidator, CutsceneValidator}

  def validate_all do
    {:ok, quest_results} = QuestValidator.validate()
    {:ok, cutscene_results} = CutsceneValidator.validate()

    %{
      quests: quest_results,
      cutscenes: cutscene_results,
      total_errors: length(quest_results.errors) + length(cutscene_results.errors),
      total_warnings: length(quest_results.warnings) + length(cutscene_results.warnings)
    }
  end

  def validate_room(room) do
    errors = []
    warnings = []

    warnings =
      if is_nil(room.name) || room.name == "",
        do: ["Room missing name" | warnings],
        else: warnings

    errors =
      if room.exits do
        invalid_exits =
          Enum.filter(room.exits, fn exit ->
            case Loka.WorldBuilder.RoomManager.get_room(exit.to || exit[:to]) do
              {:error, :not_found} -> true
              _ -> false
            end
          end)

        if length(invalid_exits) > 0,
          do: ["Room has #{length(invalid_exits)} invalid exits" | errors],
          else: errors
      else
        errors
      end

    status =
      cond do
        length(errors) > 0 -> :error
        length(warnings) > 0 -> :warning
        true -> :valid
      end

    %{status: status, errors: errors, warnings: warnings}
  end
end
