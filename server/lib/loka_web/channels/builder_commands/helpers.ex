defmodule LokaWeb.Channels.BuilderCommands.Helpers do
  @moduledoc """
  Shared helpers for builder command modules.
  """

  import Phoenix.Channel, only: [push: 3]

  alias Loka.WorldBuilder.RoomManager

  def push_builder(socket, text) do
    push(socket, "output", %{text: "[BUILDER] #{text}"})
  end

  def find_room_by_key(key) do
    rooms = RoomManager.list_rooms()
    Enum.find(rooms, fn r -> r.key == key end)
  end

  def format_entity_list(label, entities, socket) do
    lines =
      entities
      |> Enum.sort_by(& &1.key)
      |> Enum.map(fn e -> "  #{e.key} - #{e.name}" end)
      |> Enum.join("\n")

    {:ok, "#{label} (#{length(entities)}):\n#{lines}", socket}
  end

  def format_typed_object(obj) do
    data = Map.get(obj, :data, %{})

    [
      "  key: #{obj.key}",
      "  type: #{obj.type}",
      "  name: #{data["name"] || obj.key}"
    ]
    |> then(fn lines ->
      if desc = data["description"],
        do: lines ++ ["  description: #{String.slice(desc, 0, 120)}..."],
        else: lines
    end)
    |> then(fn lines ->
      components = data["components"] || %{}

      if components != %{} do
        comp_lines =
          Enum.map(components, fn {k, _v} -> "    - #{k}" end)

        lines ++ ["  components:"] ++ comp_lines
      else
        lines
      end
    end)
    |> Enum.join("\n")
  end

  def matches?(nil, _search), do: false

  def matches?(text, search) do
    String.contains?(String.downcase(to_string(text)), search)
  end
end
