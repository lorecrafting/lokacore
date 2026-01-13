defmodule Loka.WorldBuilder.ZoneManager do
  @moduledoc """
  Zone management for World Builder.

  Zones are TypedObjects that group rooms with shared properties:
  - Reset intervals, spawn rules, level ranges
  - Visual organization in World Builder
  """

  alias Loka.Engine.TypedObject
  alias Loka.WorldBuilder.RoomManager

  def create_zone(attrs) do
    attrs =
      attrs
      |> ensure_atom_keys()
      |> Map.put(:type, :zone)
      |> Map.put_new(:name, "New Zone")
      |> Map.put_new(:rooms, [])

    TypedObject.new(attrs)
  end

  def assign_rooms_to_zone(zone_id, room_keys) do
    # Update rooms with zone reference
    Enum.each(room_keys, fn key ->
      RoomManager.update_room(key, %{zone: zone_id})
    end)

    {:ok, room_keys}
  end

  defp ensure_atom_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} -> {k, v}
    end)
  end
end
