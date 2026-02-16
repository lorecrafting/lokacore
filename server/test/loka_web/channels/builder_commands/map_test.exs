defmodule LokaWeb.Channels.BuilderCommands.MapTest do
  use Loka.DataCase, async: false

  alias LokaWeb.Channels.BuilderCommands.Map, as: BuilderMap
  alias Loka.WorldBuilder.RoomManager

  describe "minimap_text/1" do
    test "returns nil for nonexistent room" do
      assert BuilderMap.minimap_text("nonexistent_room_xyz") == nil
    end

    test "returns nil for room with no exits" do
      {:ok, room} = RoomManager.create_room(%{key: "isolated_room"})
      # Room with no exits should return nil (nothing to show)
      result = BuilderMap.minimap_text(room.key)
      assert result == nil
    end

    test "returns minimap text for room with exits" do
      {:ok, _center} = RoomManager.create_room(%{key: "map_center"})
      {:ok, _north} = RoomManager.create_room(%{key: "map_north"})
      {:ok, _} = RoomManager.add_exit("map_center", "north", "map_north")

      result = BuilderMap.minimap_text("map_center")
      assert is_binary(result)
      # Should contain current room marker and connected room
      assert result =~ "[*]" or result =~ "o"
    end
  end
end
