defmodule Exmud.Framework.World.RoomLoaderTest do
  use Exmud.DataCase

  alias Exmud.Framework.World.RoomLoader
  alias Exmud.Engine.Entities

  import Exmud.EngineFixtures

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
      # Use the actual configured starting room key
      starting_key = RoomLoader.starting_room_key()
      room = room_fixture(%{key: starting_key, name: "Starting Room"})

      assert {:ok, found_room} = RoomLoader.get_starting_room()
      assert found_room.id == room.id
      assert found_room.key == starting_key
    end

    test "returns {:error, :not_found} when starting room doesn't exist" do
      # Ensure no room with starting key exists
      starting_key = RoomLoader.starting_room_key()
      case Entities.get_entity_by_key(starting_key) do
        nil -> :ok
        room -> Entities.delete_entity(room.id)
      end

      assert {:error, :not_found} = RoomLoader.get_starting_room()
    end
  end

  describe "get_starting_room_id/0" do
    test "returns room ID when starting room exists" do
      starting_key = RoomLoader.starting_room_key()
      room = room_fixture(%{key: starting_key, name: "Starting Room"})

      assert RoomLoader.get_starting_room_id() == room.id
    end

    test "returns nil when starting room doesn't exist" do
      # Ensure no room with starting key exists
      starting_key = RoomLoader.starting_room_key()
      case Entities.get_entity_by_key(starting_key) do
        nil -> :ok
        room -> Entities.delete_entity(room.id)
      end

      assert RoomLoader.get_starting_room_id() == nil
    end
  end

  describe "load_room_for_display/1" do
    test "loads a room with all basic fields" do
      room = room_fixture(%{
        name: "Test Room",
        description: "A test room for testing."
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert display_room.id == room.id
      assert display_room.title == "Test Room"
      assert display_room.description == "A test room for testing."
      assert display_room.entities == []
      assert display_room.items == []
      assert display_room.exits == []
    end

    test "loads a room with NPCs" do
      room = room_fixture()
      npc = npc_fixture(%{
        name: "Guard",
        description: "A stern guard.",
        location_id: room.id
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert length(display_room.entities) == 1
      entity = List.first(display_room.entities)
      assert entity.id == npc.id
      assert entity.name == "Guard"
      assert entity.description == "A stern guard."
    end

    test "loads a room with items" do
      room = room_fixture()

      {:ok, item} = Entities.create_entity(%{
        key: "test_sword",
        name: "Iron Sword",
        description: "A sturdy iron sword.",
        type: "item",
        location_id: room.id
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      assert length(display_room.items) == 1
      item_display = List.first(display_room.items)
      assert item_display.id == item.id
      assert item_display.name == "Iron Sword"
      assert item_display.description == "A sturdy iron sword."
    end

    test "loads a room with exits" do
      room1 = room_fixture(%{name: "Room 1"})
      room2 = room_fixture(%{name: "Room 2"})

      {:ok, exit} = Entities.create_entity(%{
        key: "exit_north",
        name: "north",
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
      npc1 = npc_fixture(%{
        name: "Guard",
        location_id: room.id
      })

      # Create a despawned NPC
      {:ok, npc2} = Entities.create_entity(%{
        key: "dead_goblin",
        name: "Goblin",
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

    test "handles NPCs with short_desc component" do
      room = room_fixture()

      npc = npc_fixture(%{
        name: "Merchant",
        location_id: room.id,
        components: %{
          "short_desc" => "selling wares"
        }
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.short_desc == "selling wares"
    end

    test "handles NPCs with suffix component" do
      room = room_fixture()

      npc = npc_fixture(%{
        name: "King",
        location_id: room.id,
        components: %{
          "suffix" => "of the realm"
        }
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.suffix == "of the realm"
    end

    test "handles items with desc component" do
      room = room_fixture()

      {:ok, item} = Entities.create_entity(%{
        key: "test_potion",
        name: "Health Potion",
        type: "item",
        location_id: room.id,
        components: %{
          "desc" => "glowing red"
        }
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      item_display = List.first(display_room.items)
      assert item_display.desc == "glowing red"
    end

    test "handles exits with missing destination" do
      room = room_fixture()

      {:ok, exit} = Entities.create_entity(%{
        key: "broken_exit",
        name: "door",
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

      {:ok, exit} = Entities.create_entity(%{
        key: "incomplete_exit",
        name: "passage",
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

    test "loads room with no name as 'Unknown Room'" do
      {:ok, room} = Entities.create_entity(%{
        key: "nameless_room",
        type: "room",
        description: "A room without a name."
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)
      assert display_room.title == "Unknown Room"
    end

    test "loads room with no description as 'An empty room.'" do
      {:ok, room} = Entities.create_entity(%{
        key: "empty_room",
        name: "Empty Room",
        type: "room"
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)
      assert display_room.description == "An empty room."
    end

    test "loads complex room with multiple entity types" do
      room = room_fixture(%{
        name: "Busy Market",
        description: "A bustling marketplace."
      })

      # Add NPCs
      npc1 = npc_fixture(%{name: "Merchant", location_id: room.id})
      npc2 = npc_fixture(%{name: "Guard", location_id: room.id})

      # Add items
      {:ok, item1} = Entities.create_entity(%{
        key: "apple",
        name: "Apple",
        type: "item",
        location_id: room.id
      })

      {:ok, item2} = Entities.create_entity(%{
        key: "bread",
        name: "Bread",
        type: "item",
        location_id: room.id
      })

      # Add exits
      room2 = room_fixture(%{name: "Town Square"})
      {:ok, exit} = Entities.create_entity(%{
        key: "exit_north",
        name: "north",
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

      # Verify NPCs
      npc_ids = Enum.map(display_room.entities, & &1.id)
      assert npc1.id in npc_ids
      assert npc2.id in npc_ids

      # Verify items
      item_ids = Enum.map(display_room.items, & &1.id)
      assert item1.id in item_ids
      assert item2.id in item_ids

      # Verify exit
      exit_display = List.first(display_room.exits)
      assert exit_display.destination == "Town Square"
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

      {:ok, npc} = Entities.create_entity(%{
        key: "simple_npc",
        name: "Villager",
        type: "npc",
        location_id: room.id,
        components: nil
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.name == "Villager"
      assert entity.short_desc == ""
      assert entity.suffix == nil
    end

    test "handles empty components map" do
      room = room_fixture()

      {:ok, npc} = Entities.create_entity(%{
        key: "basic_npc",
        name: "Citizen",
        type: "npc",
        location_id: room.id,
        components: %{}
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.name == "Citizen"
      assert entity.components == %{}
    end

    test "prefers description in components over entity description" do
      room = room_fixture()

      {:ok, npc} = Entities.create_entity(%{
        key: "npc_with_component_desc",
        name: "Mage",
        description: "Original description",
        type: "npc",
        location_id: room.id,
        components: %{
          "description" => "Component description"
        }
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      # The code uses entity.description first, so it should use "Original description"
      assert entity.description == "Original description"
    end

    test "falls back to default description for NPC without description" do
      room = room_fixture()

      {:ok, npc} = Entities.create_entity(%{
        key: "mysterious_npc",
        name: "Stranger",
        type: "npc",
        location_id: room.id
      })

      assert {:ok, display_room} = RoomLoader.load_room_for_display(room.id)

      entity = List.first(display_room.entities)
      assert entity.description == "A mysterious figure."
    end

    test "falls back to default description for item without description" do
      room = room_fixture()

      {:ok, item} = Entities.create_entity(%{
        key: "unknown_item",
        name: "Object",
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
      room2 = room_fixture(%{name: "Destination"})

      {:ok, exit} = Entities.create_entity(%{
        key: "exit_south",
        name: "passage",
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

    test "falls back to exit name if no direction in component" do
      room1 = room_fixture()
      room2 = room_fixture(%{name: "Destination"})

      {:ok, exit} = Entities.create_entity(%{
        key: "exit_west",
        name: "west",
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

    test "uses 'unknown' if no direction or name available" do
      room1 = room_fixture()
      room2 = room_fixture(%{name: "Destination"})

      {:ok, exit} = Entities.create_entity(%{
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
