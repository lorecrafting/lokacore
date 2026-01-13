defmodule Loka.Framework.World.RoomLoaderTest do
  use Loka.DataCase

  alias Loka.Framework.World.RoomLoader
  alias Loka.Engine.Entities

  import Loka.EngineFixtures

  describe "starting_room_key/0" do
    test "returns configured starting room key" do
      key = RoomLoader.starting_room_key()
      assert is_binary(key)
      # The actual configured key may vary, just verify it exists
      assert String.length(key) > 0
    end
  end

  describe "get_starting_room/0" do
    test "returns {:ok, room} when starting room exists" do
      # The starting room key (monastery_gate) is pre-loaded by the world loader
      # Just verify the function returns a room with the correct key
      starting_key = RoomLoader.starting_room_key()

      assert {:ok, found_room} = RoomLoader.get_starting_room()
      assert found_room.key == starting_key
      assert found_room.type == :room
    end

    # Note: Testing "not found" case is not practical since the world is always pre-loaded
    # and deleting the starting room would break other tests
  end

  describe "get_starting_room_id/0" do
    test "returns room ID when starting room exists" do
      # The starting room is pre-loaded, just verify we get a valid UUID back
      starting_key = RoomLoader.starting_room_key()

      room_id = RoomLoader.get_starting_room_id()
      assert room_id != nil
      assert is_binary(room_id)

      # Verify it matches the starting room
      {:ok, room} = RoomLoader.get_starting_room()
      assert room.id == room_id
    end

    # Note: Testing "nil" case is not practical since the world is always pre-loaded
  end

  describe "load_room_for_display/1" do
    test "loads a room with all basic fields" do
      room =
        room_fixture(%{
          short_desc: "Test Room",
          extra_desc: "A test room for testing."
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert display_room.id == room.id
      assert display_room.title == "Test Room"
      assert display_room.description == "A test room for testing."
      assert display_room.entities == []
      assert display_room.items == []
      assert display_room.exits == []
    end

    test "loads a room with NPCs and their long_desc" do
      room = room_fixture()

      npc =
        npc_fixture(%{
          short_desc: "Guard",
          long_desc: "A stern guard stands watch here.",
          extra_desc: "A stern guard in full armor.",
          location_id: room.id
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert length(display_room.entities) == 1
      entity = List.first(display_room.entities)
      assert entity.id == npc.id
      assert entity.name == "Guard"
      assert entity.long_desc == "A stern guard stands watch here."
      assert entity.description == "A stern guard in full armor."
    end

    test "loads a room with items and their long_desc" do
      room = room_fixture()

      {:ok, item} =
        Entities.create_entity(%{
          key: "test_sword",
          short_desc: "Iron Sword",
          long_desc: "A sturdy iron sword leans against the wall.",
          extra_desc: "A well-crafted iron sword with a leather grip.",
          type: "item",
          location_id: room.id
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert length(display_room.items) == 1
      item_display = List.first(display_room.items)
      assert item_display.id == item.id
      assert item_display.name == "Iron Sword"
      assert item_display.long_desc == "A sturdy iron sword leans against the wall."
      assert item_display.description == "A well-crafted iron sword with a leather grip."
    end

    test "loads a room with exits" do
      room1 = room_fixture(%{short_desc: "Room 1"})
      room2 = room_fixture(%{short_desc: "Room 2"})

      {:ok, exit} =
        Entities.create_entity(%{
          key: "exit_north",
          short_desc: "north",
          type: "exit",
          location_id: room1.id,
          components: %{
            "exit" => %{
              "direction" => "north",
              "destination_id" => room2.id
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room1.id)

      assert length(display_room.exits) == 1
      exit_display = List.first(display_room.exits)
      assert exit_display.id == exit.id
      assert exit_display.direction == "north"
      assert exit_display.destination == "Room 2"
      assert exit_display.destination_id == room2.id
    end

    test "filters out despawned NPCs" do
      room = room_fixture()

      # Create a regular NPC
      npc1 =
        npc_fixture(%{
          short_desc: "Guard",
          location_id: room.id
        })

      # Create a despawned NPC
      {:ok, _npc2} =
        Entities.create_entity(%{
          key: "dead_goblin",
          short_desc: "Goblin",
          type: "npc",
          location_id: room.id,
          components: %{"despawned" => true}
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      # Only the non-despawned NPC should appear
      assert length(display_room.entities) == 1
      entity = List.first(display_room.entities)
      assert entity.id == npc1.id
      assert entity.name == "Guard"
    end

    test "handles NPCs with suffix component" do
      room = room_fixture()

      _npc =
        npc_fixture(%{
          short_desc: "King",
          location_id: room.id,
          components: %{
            "suffix" => "of the realm"
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.suffix == "of the realm"
    end

    test "handles exits with missing destination" do
      room = room_fixture()

      {:ok, _exit} =
        Entities.create_entity(%{
          key: "broken_exit",
          short_desc: "door",
          type: "exit",
          location_id: room.id,
          components: %{
            "exit" => %{
              "direction" => "west",
              "destination_id" => "nonexistent-id"
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      exit_display = List.first(display_room.exits)
      assert exit_display.direction == "west"
      assert exit_display.destination == "somewhere"
    end

    test "handles exits without destination_id" do
      room = room_fixture()

      {:ok, _exit} =
        Entities.create_entity(%{
          key: "incomplete_exit",
          short_desc: "passage",
          type: "exit",
          location_id: room.id,
          components: %{
            "exit" => %{
              "direction" => "east"
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      exit_display = List.first(display_room.exits)
      assert exit_display.direction == "east"
      assert exit_display.destination == "somewhere"
      assert exit_display.destination_id == nil
    end

    test "returns {:error, :not_found} for nil room_id" do
      assert {:error, :not_found} = RoomLoader.load_room_for_display(nil)
    end

    test "returns {:error, :not_found} for nonexistent room_id" do
      fake_id = Ecto.UUID.generate()
      assert {:error, :not_found} = RoomLoader.load_room_for_display(fake_id)
    end

    test "loads room with no short_desc as 'Unknown Room'" do
      {:ok, room} =
        Entities.create_entity(%{
          key: "nameless_room",
          type: "room",
          extra_desc: "A room without a name."
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)
      assert display_room.title == "Unknown Room"
    end

    test "loads room with no extra_desc as 'An empty room.'" do
      {:ok, room} =
        Entities.create_entity(%{
          key: "empty_room",
          short_desc: "Empty Room",
          type: "room"
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)
      assert display_room.description == "An empty room."
    end

    test "loads complex room with multiple entity types" do
      room =
        room_fixture(%{
          short_desc: "Busy Market",
          extra_desc: "A bustling marketplace."
        })

      # Add NPCs with long_desc
      npc1 =
        npc_fixture(%{
          short_desc: "Merchant",
          long_desc: "A merchant hawks wares loudly.",
          location_id: room.id
        })

      npc2 =
        npc_fixture(%{
          short_desc: "Guard",
          long_desc: "A guard patrols the market.",
          location_id: room.id
        })

      # Add items with long_desc
      {:ok, item1} =
        Entities.create_entity(%{
          key: "apple",
          short_desc: "Apple",
          long_desc: "A ripe apple sits on a cart.",
          type: "item",
          location_id: room.id
        })

      {:ok, item2} =
        Entities.create_entity(%{
          key: "bread",
          short_desc: "Bread",
          long_desc: "Fresh bread rests on a shelf.",
          type: "item",
          location_id: room.id
        })

      # Add exits
      room2 = room_fixture(%{short_desc: "Town Square"})

      {:ok, _exit} =
        Entities.create_entity(%{
          key: "exit_north",
          short_desc: "north",
          type: "exit",
          location_id: room.id,
          components: %{
            "exit" => %{
              "direction" => "north",
              "destination_id" => room2.id
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert display_room.title == "Busy Market"
      assert length(display_room.entities) == 2
      assert length(display_room.items) == 2
      assert length(display_room.exits) == 1

      # Verify NPCs have long_desc
      npc_ids = Enum.map(display_room.entities, & &1.id)
      assert npc1.id in npc_ids
      assert npc2.id in npc_ids

      merchant = Enum.find(display_room.entities, &(&1.name == "Merchant"))
      assert merchant.long_desc == "A merchant hawks wares loudly."

      # Verify items have long_desc
      item_ids = Enum.map(display_room.items, & &1.id)
      assert item1.id in item_ids
      assert item2.id in item_ids

      apple = Enum.find(display_room.items, &(&1.name == "Apple"))
      assert apple.long_desc == "A ripe apple sits on a cart."

      # Verify exit
      exit_display = List.first(display_room.exits)
      assert exit_display.destination == "Town Square"
    end

    test "entity without long_desc shows fallback in room" do
      room = room_fixture()

      npc =
        npc_fixture(%{
          short_desc: "Stranger",
          extra_desc: "A mysterious figure.",
          location_id: room.id
          # No long_desc set - should use fallback
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.id == npc.id
      assert entity.name == "Stranger"
      # long_desc should be empty string when not set
      assert entity.long_desc == ""
    end

    test "item without long_desc shows fallback in room" do
      room = room_fixture()

      {:ok, item} =
        Entities.create_entity(%{
          key: "mystery_object",
          short_desc: "Strange Object",
          extra_desc: "An ordinary item.",
          type: "item",
          location_id: room.id
          # No long_desc set - should use fallback
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      item_display = List.first(display_room.items)
      assert item_display.id == item.id
      assert item_display.name == "Strange Object"
      # long_desc should be empty string when not set
      assert item_display.long_desc == ""
    end
  end

  describe "empty_room/0" do
    test "returns a void room structure" do
      empty = RoomLoader.empty_room()

      assert empty.id == nil
      assert empty.title == "The Void"
      assert empty.description =~ "nothing here"
      assert empty.description =~ "world has not been created yet"
      assert empty.entities == []
      assert empty.items == []
      assert empty.exits == []
    end

    test "empty room has all required fields" do
      empty = RoomLoader.empty_room()

      assert Map.has_key?(empty, :id)
      assert Map.has_key?(empty, :title)
      assert Map.has_key?(empty, :description)
      assert Map.has_key?(empty, :entities)
      assert Map.has_key?(empty, :items)
      assert Map.has_key?(empty, :exits)
    end
  end

  describe "component handling" do
    test "handles nil components gracefully" do
      room = room_fixture()

      {:ok, _npc} =
        Entities.create_entity(%{
          key: "simple_npc",
          short_desc: "Villager",
          type: "npc",
          location_id: room.id,
          components: nil
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.name == "Villager"
      assert entity.suffix == nil
    end

    test "handles empty components map" do
      room = room_fixture()

      {:ok, _npc} =
        Entities.create_entity(%{
          key: "basic_npc",
          short_desc: "Citizen",
          type: "npc",
          location_id: room.id,
          components: %{}
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.name == "Citizen"
      assert entity.components == %{}
    end

    test "uses entity extra_desc for NPC description" do
      room = room_fixture()

      {:ok, _npc} =
        Entities.create_entity(%{
          key: "npc_with_desc",
          short_desc: "Mage",
          extra_desc: "A powerful wizard.",
          type: "npc",
          location_id: room.id
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.description == "A powerful wizard."
    end

    test "falls back to default description for NPC without extra_desc" do
      room = room_fixture()

      {:ok, _npc} =
        Entities.create_entity(%{
          key: "mysterious_npc",
          short_desc: "Stranger",
          type: "npc",
          location_id: room.id
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.description == "A mysterious figure."
    end

    test "falls back to default description for item without extra_desc" do
      room = room_fixture()

      {:ok, _item} =
        Entities.create_entity(%{
          key: "unknown_item",
          short_desc: "Object",
          type: "item",
          location_id: room.id
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      item_display = List.first(display_room.items)
      assert item_display.description == "An ordinary item."
    end
  end

  describe "exit direction handling" do
    test "uses direction from exit component" do
      room1 = room_fixture()
      room2 = room_fixture(%{short_desc: "Destination"})

      {:ok, _exit} =
        Entities.create_entity(%{
          key: "exit_south",
          short_desc: "passage",
          type: "exit",
          location_id: room1.id,
          components: %{
            "exit" => %{
              "direction" => "south",
              "destination_id" => room2.id
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room1.id)

      exit_display = List.first(display_room.exits)
      assert exit_display.direction == "south"
    end

    test "falls back to exit short_desc if no direction in component" do
      room1 = room_fixture()
      room2 = room_fixture(%{short_desc: "Destination"})

      {:ok, _exit} =
        Entities.create_entity(%{
          key: "exit_west",
          short_desc: "west",
          type: "exit",
          location_id: room1.id,
          components: %{
            "exit" => %{
              "destination_id" => room2.id
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room1.id)

      exit_display = List.first(display_room.exits)
      assert exit_display.direction == "west"
    end

    test "uses 'unknown' if no direction or short_desc available" do
      room1 = room_fixture()
      room2 = room_fixture(%{short_desc: "Destination"})

      {:ok, _exit} =
        Entities.create_entity(%{
          key: "mystery_exit",
          type: "exit",
          location_id: room1.id,
          components: %{
            "exit" => %{
              "destination_id" => room2.id
            }
          }
        })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room1.id)

      exit_display = List.first(display_room.exits)
      assert exit_display.direction == "unknown"
    end
  end
end
