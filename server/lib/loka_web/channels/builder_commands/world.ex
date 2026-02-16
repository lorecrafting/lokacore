defmodule LokaWeb.Channels.BuilderCommands.World do
  @moduledoc """
  Builder world state commands: reload, validate, settime.
  """

  alias Loka.WorldBuilder.{RoomManager, ValidationManager}

  def execute(:settime, %{time: time}, socket) do
    valid_times = ~w(dawn noon dusk midnight)

    if time in valid_times do
      {:ok, "Time period set to #{time}. (Note: full calendar implementation pending)", socket}
    else
      {:error, "Invalid time. Use: #{Enum.join(valid_times, ", ")}", socket}
    end
  end

  def execute(:reload, _params, socket) do
    # No ETS registry in V2; content is loaded from DB on access
    {:ok, "No reload needed — V2 reads content from DB directly. Changes are live immediately.",
     socket}
  end

  def execute(:validate, _params, socket) do
    rooms = RoomManager.list_rooms()
    validation = ValidationManager.validation_summary(rooms)

    errors = Map.get(validation, :errors, 0)
    warnings = Map.get(validation, :warnings, 0)

    text =
      if errors == 0 and warnings == 0 do
        "Validation passed. No issues found."
      else
        "Validation: #{errors} error(s), #{warnings} warning(s)."
      end

    {:ok, text, socket}
  end
end
