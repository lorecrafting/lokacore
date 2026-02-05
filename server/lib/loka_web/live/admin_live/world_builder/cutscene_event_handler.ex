defmodule LokaWeb.AdminLive.WorldBuilder.CutsceneEventHandler do
  @moduledoc """
  Event handlers for cutscene editing operations in World Builder.

  Extracted from WorldBuilderLive to reduce file size and improve maintainability.
  Handles cutscene field updates, step management, effect management, and saving.
  """

  import Phoenix.Component, only: [assign: 3]

  def handle_event("cutscene_update_field", %{"field" => field, "value" => value}, socket) do
    cutscene_data = Map.put(socket.assigns.cutscene_data, String.to_existing_atom(field), value)
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event("cutscene_update_trigger", %{"field" => field, "value" => value}, socket) do
    trigger = Map.put(socket.assigns.cutscene_data.trigger, String.to_existing_atom(field), value)
    cutscene_data = %{socket.assigns.cutscene_data | trigger: trigger}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event("cutscene_add_step", %{"step_type" => ""}, socket) do
    {:noreply, socket}
  end

  def handle_event("cutscene_add_step", %{"step_type" => step_type}, socket) do
    new_step = %{type: step_type, text: "", speaker: "", duration: 1.0}
    sequence = socket.assigns.cutscene_data.sequence ++ [new_step]
    cutscene_data = %{socket.assigns.cutscene_data | sequence: sequence}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event("cutscene_remove_step", %{"idx" => idx}, socket) do
    idx = String.to_integer(idx)
    sequence = List.delete_at(socket.assigns.cutscene_data.sequence, idx)
    cutscene_data = %{socket.assigns.cutscene_data | sequence: sequence}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event(
        "cutscene_update_step",
        %{"idx" => idx, "field" => field, "value" => value},
        socket
      ) do
    idx = String.to_integer(idx)

    sequence =
      List.update_at(socket.assigns.cutscene_data.sequence, idx, fn step ->
        Map.put(step, String.to_existing_atom(field), value)
      end)

    cutscene_data = %{socket.assigns.cutscene_data | sequence: sequence}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event("cutscene_move_step_up", %{"idx" => idx}, socket) do
    idx = String.to_integer(idx)
    sequence = socket.assigns.cutscene_data.sequence

    if idx > 0 do
      sequence = swap_list(sequence, idx, idx - 1)
      cutscene_data = %{socket.assigns.cutscene_data | sequence: sequence}
      {:noreply, assign(socket, :cutscene_data, cutscene_data)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("cutscene_move_step_down", %{"idx" => idx}, socket) do
    idx = String.to_integer(idx)
    sequence = socket.assigns.cutscene_data.sequence

    if idx < length(sequence) - 1 do
      sequence = swap_list(sequence, idx, idx + 1)
      cutscene_data = %{socket.assigns.cutscene_data | sequence: sequence}
      {:noreply, assign(socket, :cutscene_data, cutscene_data)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("cutscene_add_effect", _params, socket) do
    effects = socket.assigns.cutscene_data.effects ++ [%{type: "set_flag", flag: ""}]
    cutscene_data = %{socket.assigns.cutscene_data | effects: effects}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event("cutscene_remove_effect", %{"idx" => idx}, socket) do
    idx = String.to_integer(idx)
    effects = List.delete_at(socket.assigns.cutscene_data.effects, idx)
    cutscene_data = %{socket.assigns.cutscene_data | effects: effects}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event(
        "cutscene_update_effect",
        %{"idx" => idx, "field" => field, "value" => value},
        socket
      ) do
    idx = String.to_integer(idx)

    effects =
      List.update_at(socket.assigns.cutscene_data.effects, idx, fn effect ->
        Map.put(effect, String.to_existing_atom(field), value)
      end)

    cutscene_data = %{socket.assigns.cutscene_data | effects: effects}
    {:noreply, assign(socket, :cutscene_data, cutscene_data)}
  end

  def handle_event("cutscene_save", _params, socket) do
    data = socket.assigns.cutscene_data

    cutscene_params = %{
      "id" => data.id,
      "name" => data.name,
      "trigger" => %{
        "type" => data.trigger.type,
        "location" => data.trigger.location,
        "condition" => data.trigger.condition
      },
      "sequence" =>
        Enum.map(data.sequence, fn step ->
          Map.new(step, fn {k, v} -> {to_string(k), v} end)
        end),
      "effects" =>
        Enum.map(data.effects, fn effect ->
          Map.new(effect, fn {k, v} -> {to_string(k), v} end)
        end)
    }

    # Delegate back to WorldBuilderLive for create_cutscene (which handles persistence)
    LokaWeb.AdminLive.WorldBuilderLive.handle_event("create_cutscene", cutscene_params, socket)
  end

  defp swap_list(list, idx1, idx2) do
    val1 = Enum.at(list, idx1)
    val2 = Enum.at(list, idx2)

    list
    |> List.replace_at(idx1, val2)
    |> List.replace_at(idx2, val1)
  end
end
