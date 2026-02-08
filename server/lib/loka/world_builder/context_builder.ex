defmodule Loka.WorldBuilder.ContextBuilder do
  @moduledoc """
  Builds context from LiveView assigns for injection into the World Builder
  chat system prompt. Reads selected room, entity, and editing mode so the
  LLM knows what the builder is currently looking at.
  """

  alias Loka.WorldBuilder.RoomManager

  @doc """
  Build a context map from the current socket assigns.
  Returns a map with optional keys for selected room, entity, editing mode, and chat mode.
  """
  def build(assigns) do
    %{}
    |> maybe_add_room_context(assigns)
    |> maybe_add_entity_context(assigns)
    |> maybe_add_editing_context(assigns)
    |> maybe_add_mode_context(assigns)
  end

  @doc """
  Format the context map into a string suitable for appending to the system prompt.
  Returns empty string if no meaningful context available.
  """
  def format_for_system_prompt(context) when map_size(context) == 0, do: ""

  def format_for_system_prompt(context) do
    sections =
      []
      |> maybe_add_room_section(context)
      |> maybe_add_entity_section(context)
      |> maybe_add_editing_section(context)
      |> maybe_add_mode_section(context)

    if sections == [] do
      ""
    else
      "\n\n## Current Selection Context\n\n" <> Enum.join(sections, "\n")
    end
  end

  # Build context from assigns

  defp maybe_add_room_context(context, assigns) do
    case Map.get(assigns, :selected_room) do
      nil ->
        context

      room_key when is_binary(room_key) ->
        case RoomManager.get_room(room_key) do
          {:ok, room} ->
            Map.put(context, :selected_room, %{
              key: room_key,
              name: room[:name] || room_key,
              description: room[:description],
              zone: room[:zone],
              exits: room[:exits] || %{},
              spawns: room[:spawns] || []
            })

          _ ->
            Map.put(context, :selected_room, %{key: room_key})
        end

      _ ->
        context
    end
  end

  defp maybe_add_entity_context(context, assigns) do
    case Map.get(assigns, :selected_entity) do
      nil -> context
      %{type: type, key: key} -> Map.put(context, :selected_entity, %{type: type, key: key})
      _ -> context
    end
  end

  defp maybe_add_editing_context(context, assigns) do
    case Map.get(assigns, :editing_mode) do
      :map -> context
      nil -> context
      mode -> Map.put(context, :editing_mode, mode)
    end
  end

  defp maybe_add_mode_context(context, assigns) do
    case Map.get(assigns, :chat_mode) do
      :design -> context
      nil -> context
      mode -> Map.put(context, :chat_mode, mode)
    end
  end

  # Format context sections

  defp maybe_add_room_section(sections, %{selected_room: room}) do
    lines = ["Selected room: \"#{room.key}\"#{if room[:name], do: " (#{room.name})", else: ""}"]

    lines =
      if room[:zone],
        do: lines ++ ["Zone: #{room.zone}"],
        else: lines

    lines =
      if room[:description] && room[:description] != "",
        do: lines ++ ["Description: #{truncate(room.description, 200)}"],
        else: lines

    lines =
      if room[:exits] && map_size(room.exits) > 0 do
        exit_list =
          room.exits
          |> Enum.map(fn {dir, target} ->
            target_key = if is_map(target), do: target["target"] || target[:target], else: target
            "#{dir} → #{target_key}"
          end)
          |> Enum.join(", ")

        lines ++ ["Exits: #{exit_list}"]
      else
        lines
      end

    lines =
      if room[:spawns] && room.spawns != [] do
        spawn_list =
          room.spawns
          |> Enum.map(fn spawn ->
            if is_map(spawn), do: spawn["key"] || spawn[:key] || inspect(spawn), else: spawn
          end)
          |> Enum.join(", ")

        lines ++ ["Spawns: #{spawn_list}"]
      else
        lines
      end

    sections ++ [Enum.join(lines, "\n")]
  end

  defp maybe_add_room_section(sections, _), do: sections

  defp maybe_add_entity_section(sections, %{selected_entity: entity}) do
    sections ++ ["Selected entity: #{entity.type} \"#{entity.key}\""]
  end

  defp maybe_add_entity_section(sections, _), do: sections

  defp maybe_add_editing_section(sections, %{editing_mode: mode}) do
    sections ++ ["Currently editing: #{mode}"]
  end

  defp maybe_add_editing_section(sections, _), do: sections

  defp maybe_add_mode_section(sections, %{chat_mode: mode}) do
    sections ++ ["Chat mode: #{mode}"]
  end

  defp maybe_add_mode_section(sections, _), do: sections

  defp truncate(text, max_length) do
    if String.length(text) > max_length do
      String.slice(text, 0, max_length) <> "..."
    else
      text
    end
  end
end
