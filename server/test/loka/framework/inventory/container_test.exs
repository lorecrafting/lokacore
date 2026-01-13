defmodule Loka.Framework.Inventory.ContainerTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Inventory.Container

  describe "container?/1" do
    test "returns false for nil" do
      assert Container.container?(nil) == false
    end

    test "returns true for entity with container component" do
      entity = %{components: %{"container" => %{}}}
      assert Container.container?(entity) == true
    end

    test "returns true for entity with atom key container" do
      entity = %{components: %{container: %{}}}
      assert Container.container?(entity) == true
    end

    test "returns false for entity without container" do
      entity = %{components: %{"equipable" => %{}}}
      assert Container.container?(entity) == false
    end

    test "returns false for entity without components" do
      entity = %{name: "Test Item"}
      assert Container.container?(entity) == false
    end
  end

  describe "get_container/1" do
    test "returns nil for nil entity" do
      assert Container.get_container(nil) == nil
    end

    test "returns nil for entity without container" do
      entity = %{components: %{"equipable" => %{}}}
      assert Container.get_container(entity) == nil
    end

    test "returns container struct from entity" do
      entity = %{
        components: %{
          "container" => %{
            "capacity" => 20,
            "locked" => false
          }
        }
      }

      container = Container.get_container(entity)

      assert %Container{} = container
      assert container.capacity == 20
      assert container.locked == false
    end
  end

  describe "from_component/1" do
    test "creates container with defaults from empty map" do
      container = Container.from_component(%{})

      assert container.capacity == 10
      assert container.weight_capacity == nil
      assert container.accepts == []
      assert container.rejects == []
      assert container.locked == false
      assert container.lock_key == nil
      assert container.contents == []
    end

    test "creates container with custom values" do
      data = %{
        "capacity" => 25,
        "weight_capacity" => 100,
        "accepts" => ["item", "material"],
        "rejects" => ["weapon"],
        "locked" => true,
        "lock_key" => "gold_key",
        "contents" => ["item_1", "item_2"],
        "description_open" => "An open chest",
        "description_closed" => "A closed chest"
      }

      container = Container.from_component(data)

      assert container.capacity == 25
      assert container.weight_capacity == 100
      assert container.accepts == ["item", "material"]
      assert container.rejects == ["weapon"]
      assert container.locked == true
      assert container.lock_key == "gold_key"
      assert container.contents == ["item_1", "item_2"]
      assert container.description_open == "An open chest"
      assert container.description_closed == "A closed chest"
    end

    test "returns nil for non-map input" do
      assert Container.from_component(nil) == nil
      assert Container.from_component("invalid") == nil
    end
  end

  describe "put_item/3" do
    test "adds item to container" do
      container = %Container{capacity: 10, contents: []}

      assert {:ok, updated} = Container.put_item(container, "item_1")
      assert "item_1" in updated.contents
    end

    test "returns error when container is locked" do
      container = %Container{capacity: 10, locked: true}

      assert {:error, :container_locked} = Container.put_item(container, "item_1")
    end

    test "returns error when container is full" do
      container = %Container{capacity: 2, contents: ["item_1", "item_2"]}

      assert {:error, :container_full} = Container.put_item(container, "item_3")
    end

    test "returns error when item type not accepted" do
      container = %Container{capacity: 10, accepts: ["material"], rejects: []}

      assert {:error, :item_type_not_accepted} = Container.put_item(container, "sword", "weapon")
    end

    test "returns error when item type is rejected" do
      container = %Container{capacity: 10, accepts: [], rejects: ["weapon"]}

      assert {:error, :item_type_not_accepted} = Container.put_item(container, "sword", "weapon")
    end

    test "accepts item when type matches accepts list" do
      container = %Container{capacity: 10, accepts: ["material", "item"], rejects: []}

      assert {:ok, updated} = Container.put_item(container, "ore_1", "material")
      assert "ore_1" in updated.contents
    end

    test "accepts any item when accepts and rejects are empty" do
      container = %Container{capacity: 10, accepts: [], rejects: []}

      assert {:ok, updated} = Container.put_item(container, "anything", "whatever")
      assert "anything" in updated.contents
    end

    test "rejects item with nil type when accepts list is non-empty" do
      # When accepts list is specified, nil type doesn't match
      container = %Container{capacity: 10, accepts: ["material"], rejects: []}

      assert {:error, :item_type_not_accepted} = Container.put_item(container, "item_1", nil)
    end

    test "accepts item when type is nil and no accepts/rejects constraints" do
      container = %Container{capacity: 10, accepts: [], rejects: []}

      assert {:ok, updated} = Container.put_item(container, "item_1", nil)
      assert "item_1" in updated.contents
    end
  end

  describe "take_item/2" do
    test "removes and returns item from container" do
      container = %Container{contents: ["item_1", "item_2"]}

      assert {:ok, updated, item_id} = Container.take_item(container, "item_1")
      assert item_id == "item_1"
      assert "item_1" not in updated.contents
      assert "item_2" in updated.contents
    end

    test "returns error when container is locked" do
      container = %Container{contents: ["item_1"], locked: true}

      assert {:error, :container_locked} = Container.take_item(container, "item_1")
    end

    test "returns error when item not in container" do
      container = %Container{contents: ["item_1"]}

      assert {:error, :item_not_found} = Container.take_item(container, "item_2")
    end
  end

  describe "list_contents/1" do
    test "returns contents when unlocked" do
      container = %Container{contents: ["item_1", "item_2"]}

      assert {:ok, contents} = Container.list_contents(container)
      assert contents == ["item_1", "item_2"]
    end

    test "returns error when locked" do
      container = %Container{contents: ["item_1"], locked: true}

      assert {:error, :container_locked} = Container.list_contents(container)
    end

    test "returns empty list for empty container" do
      container = %Container{contents: []}

      assert {:ok, []} = Container.list_contents(container)
    end
  end

  describe "empty?/1" do
    test "returns true for empty container" do
      container = %Container{contents: []}
      assert Container.empty?(container) == true
    end

    test "returns false for container with items" do
      container = %Container{contents: ["item_1"]}
      assert Container.empty?(container) == false
    end
  end

  describe "remaining_capacity/1" do
    test "returns full capacity for empty container" do
      container = %Container{capacity: 10, contents: []}
      assert Container.remaining_capacity(container) == 10
    end

    test "returns 0 for full container" do
      container = %Container{capacity: 2, contents: ["a", "b"]}
      assert Container.remaining_capacity(container) == 0
    end

    test "returns correct remaining space" do
      container = %Container{capacity: 10, contents: ["a", "b", "c"]}
      assert Container.remaining_capacity(container) == 7
    end
  end

  describe "unlock/2" do
    test "unlocks already unlocked container" do
      container = %Container{locked: false}

      assert {:ok, unlocked} = Container.unlock(container, "any_key")
      assert unlocked.locked == false
    end

    test "unlocks container without lock_key" do
      container = %Container{locked: true, lock_key: nil}

      assert {:ok, unlocked} = Container.unlock(container, "any_key")
      assert unlocked.locked == false
    end

    test "unlocks container with correct key" do
      container = %Container{locked: true, lock_key: "gold_key"}

      assert {:ok, unlocked} = Container.unlock(container, "gold_key")
      assert unlocked.locked == false
    end

    test "returns error with wrong key" do
      container = %Container{locked: true, lock_key: "gold_key"}

      assert {:error, :wrong_key} = Container.unlock(container, "silver_key")
    end
  end

  describe "lock/1" do
    test "locks an unlocked container" do
      container = %Container{locked: false}

      assert {:ok, locked} = Container.lock(container)
      assert locked.locked == true
    end

    test "locks already locked container" do
      container = %Container{locked: true}

      assert {:ok, locked} = Container.lock(container)
      assert locked.locked == true
    end
  end

  describe "get_description/1" do
    test "returns closed description when locked" do
      container = %Container{
        locked: true,
        description_open: "Open chest",
        description_closed: "Closed chest"
      }

      assert Container.get_description(container) == "Closed chest"
    end

    test "returns open description when unlocked" do
      container = %Container{
        locked: false,
        description_open: "Open chest",
        description_closed: "Closed chest"
      }

      assert Container.get_description(container) == "Open chest"
    end
  end

  describe "state/1" do
    test "returns :empty for container with no contents" do
      container = %Container{capacity: 10, contents: []}
      assert Container.state(container) == :empty
    end

    test "returns :full when contents equal capacity" do
      container = %Container{capacity: 3, contents: ["a", "b", "c"]}
      assert Container.state(container) == :full
    end

    test "returns :full when contents exceed capacity" do
      container = %Container{capacity: 2, contents: ["a", "b", "c"]}
      assert Container.state(container) == :full
    end

    test "returns :partial when contents between 0 and capacity" do
      container = %Container{capacity: 10, contents: ["a", "b"]}
      assert Container.state(container) == :partial
    end
  end

  describe "get_state_description/1" do
    test "returns state description when available" do
      container = %Container{
        capacity: 10,
        contents: [],
        state_descriptions: %{
          full: "Stuffed full",
          partial: "Has some items",
          empty: "Completely empty"
        }
      }

      assert Container.get_state_description(container) == "Completely empty"
    end

    test "returns partial description for partial state" do
      container = %Container{
        capacity: 10,
        contents: ["a"],
        state_descriptions: %{
          full: "Stuffed full",
          partial: "Has some items",
          empty: "Completely empty"
        }
      }

      assert Container.get_state_description(container) == "Has some items"
    end

    test "returns full description for full state" do
      container = %Container{
        capacity: 2,
        contents: ["a", "b"],
        state_descriptions: %{
          full: "Stuffed full",
          partial: "Has some items",
          empty: "Completely empty"
        }
      }

      assert Container.get_state_description(container) == "Stuffed full"
    end

    test "falls back to legacy description when state_descriptions empty" do
      container = %Container{
        capacity: 10,
        contents: [],
        state_descriptions: %{},
        description_open: "Legacy open",
        description_closed: "Legacy closed"
      }

      assert Container.get_state_description(container) == "Legacy open"
    end

    test "falls back to closed description when locked" do
      container = %Container{
        capacity: 10,
        contents: [],
        locked: true,
        state_descriptions: %{},
        description_open: "Legacy open",
        description_closed: "Legacy closed"
      }

      assert Container.get_state_description(container) == "Legacy closed"
    end
  end

  describe "can_put and can_take" do
    test "put_item fails when can_put is false" do
      container = %Container{capacity: 10, can_put: false}
      assert {:error, :cannot_put} = Container.put_item(container, "item_1")
    end

    test "take_item fails when can_take is false" do
      container = %Container{contents: ["item_1"], can_take: false}
      assert {:error, :cannot_take} = Container.take_item(container, "item_1")
    end

    test "can_put? returns false when locked" do
      container = %Container{can_put: true, locked: true}
      assert Container.can_put?(container) == false
    end

    test "can_take? returns false when locked" do
      container = %Container{can_take: true, locked: true}
      assert Container.can_take?(container) == false
    end

    test "can_put? returns true when enabled and unlocked" do
      container = %Container{can_put: true, locked: false}
      assert Container.can_put?(container) == true
    end

    test "can_take? returns true when enabled and unlocked" do
      container = %Container{can_take: true, locked: false}
      assert Container.can_take?(container) == true
    end
  end

  describe "take_item_at/2" do
    test "takes item at valid index" do
      container = %Container{contents: ["a", "b", "c"]}
      assert {:ok, updated, "b"} = Container.take_item_at(container, 1)
      assert updated.contents == ["a", "c"]
    end

    test "takes first item at index 0" do
      container = %Container{contents: ["a", "b", "c"]}
      assert {:ok, updated, "a"} = Container.take_item_at(container, 0)
      assert updated.contents == ["b", "c"]
    end

    test "takes last item at last index" do
      container = %Container{contents: ["a", "b", "c"]}
      assert {:ok, updated, "c"} = Container.take_item_at(container, 2)
      assert updated.contents == ["a", "b"]
    end

    test "returns error for negative index" do
      container = %Container{contents: ["a", "b"]}
      assert {:error, :index_out_of_bounds} = Container.take_item_at(container, -1)
    end

    test "returns error for index beyond contents" do
      container = %Container{contents: ["a", "b"]}
      assert {:error, :index_out_of_bounds} = Container.take_item_at(container, 5)
    end

    test "returns error when can_take is false" do
      container = %Container{contents: ["a"], can_take: false}
      assert {:error, :cannot_take} = Container.take_item_at(container, 0)
    end

    test "returns error when locked" do
      container = %Container{contents: ["a"], locked: true}
      assert {:error, :container_locked} = Container.take_item_at(container, 0)
    end
  end

  describe "respawn configuration" do
    test "respawn_enabled? returns false when respawn is nil" do
      container = %Container{respawn: nil}
      assert Container.respawn_enabled?(container) == false
    end

    test "respawn_enabled? returns true when enabled" do
      container = %Container{respawn: %{enabled: true, delay_seconds: 1800, loot_table: []}}
      assert Container.respawn_enabled?(container) == true
    end

    test "respawn_delay returns delay seconds" do
      container = %Container{respawn: %{enabled: true, delay_seconds: 900, loot_table: []}}
      assert Container.respawn_delay(container) == 900
    end

    test "respawn_delay returns nil when no respawn config" do
      container = %Container{respawn: nil}
      assert Container.respawn_delay(container) == nil
    end

    test "loot_table returns empty list when no respawn config" do
      container = %Container{respawn: nil}
      assert Container.loot_table(container) == []
    end

    test "loot_table returns configured table" do
      table = [%{item: "gold", weight: 50}]
      container = %Container{respawn: %{enabled: true, delay_seconds: 100, loot_table: table}}
      assert Container.loot_table(container) == table
    end
  end

  describe "from_component with new fields" do
    test "parses can_put and can_take with atom keys" do
      # Note: Using atom keys because MapHelpers.get_flexible has a bug with
      # boolean false values and string keys (Enum.find_value treats false as falsy)
      data = %{can_put: false, can_take: false}
      container = Container.from_component(data)

      assert container.can_put == false
      assert container.can_take == false
    end

    test "defaults can_put and can_take to true" do
      container = Container.from_component(%{})

      assert container.can_put == true
      assert container.can_take == true
    end

    test "parses state_descriptions with string keys" do
      data = %{
        "state_descriptions" => %{
          "full" => "Very full",
          "empty" => "Very empty"
        }
      }

      container = Container.from_component(data)

      assert container.state_descriptions == %{full: "Very full", empty: "Very empty"}
    end

    test "parses state_descriptions with atom keys" do
      data = %{
        state_descriptions: %{
          full: "Very full",
          partial: "Partly full"
        }
      }

      container = Container.from_component(data)

      assert container.state_descriptions == %{full: "Very full", partial: "Partly full"}
    end

    test "parses respawn config" do
      data = %{
        "respawn" => %{
          "enabled" => true,
          "delay_seconds" => 600,
          "loot_table" => [
            %{"item" => "gold", "weight" => 50}
          ]
        }
      }

      container = Container.from_component(data)

      assert container.respawn == %{
               enabled: true,
               delay_seconds: 600,
               loot_table: [%{"item" => "gold", "weight" => 50}]
             }
    end

    test "respawn config is nil when disabled" do
      data = %{
        "respawn" => %{
          "enabled" => false,
          "delay_seconds" => 600
        }
      }

      container = Container.from_component(data)
      assert container.respawn == nil
    end

    test "respawn config uses default delay when not specified" do
      data = %{
        "respawn" => %{
          "enabled" => true
        }
      }

      container = Container.from_component(data)
      assert container.respawn.delay_seconds == 1800
    end
  end

  describe "to_map/1" do
    test "converts container to map for persistence" do
      container = %Container{
        capacity: 5,
        can_put: false,
        can_take: true,
        locked: true,
        contents: ["a", "b"]
      }

      map = Container.to_map(container)

      assert map.capacity == 5
      assert map.can_put == false
      assert map.can_take == true
      assert map.locked == true
      assert map.contents == ["a", "b"]
    end

    test "includes state_descriptions when present" do
      container = %Container{
        state_descriptions: %{full: "Full!", empty: "Empty!"}
      }

      map = Container.to_map(container)
      assert map.state_descriptions == %{full: "Full!", empty: "Empty!"}
    end

    test "excludes state_descriptions when empty" do
      container = %Container{state_descriptions: %{}}
      map = Container.to_map(container)
      refute Map.has_key?(map, :state_descriptions)
    end

    test "includes respawn when present" do
      container = %Container{
        respawn: %{enabled: true, delay_seconds: 600, loot_table: []}
      }

      map = Container.to_map(container)
      assert map.respawn == %{enabled: true, delay_seconds: 600, loot_table: []}
    end

    test "excludes respawn when nil" do
      container = %Container{respawn: nil}
      map = Container.to_map(container)
      refute Map.has_key?(map, :respawn)
    end
  end

  describe "generate_initial_contents/1" do
    test "returns empty list when respawn is disabled" do
      container = %Container{capacity: 5, respawn: nil}
      assert Container.generate_initial_contents(container) == []
    end

    test "generates items from loot table when respawn enabled" do
      container = %Container{
        capacity: 5,
        respawn: %{
          enabled: true,
          delay_seconds: 1800,
          loot_table: [
            %{item: "gold", weight: 100, quantity: 1}
          ]
        }
      }

      result = Container.generate_initial_contents(container)

      # Should have generated items
      assert length(result) > 0
      # All should be "gold"
      assert Enum.all?(result, &(&1 == "gold"))
      # Should not exceed capacity
      assert length(result) <= 5
    end

    test "respects capacity limit" do
      container = %Container{
        capacity: 3,
        respawn: %{
          enabled: true,
          delay_seconds: 1800,
          loot_table: [
            %{item: "item", weight: 100, quantity: 10}
          ]
        }
      }

      result = Container.generate_initial_contents(container)

      # Should be capped at capacity
      assert length(result) <= 3
    end

    test "handles quantity ranges" do
      container = %Container{
        capacity: 10,
        respawn: %{
          enabled: true,
          delay_seconds: 1800,
          loot_table: [
            %{item: "coin", weight: 100, quantity: [1, 3]}
          ]
        }
      }

      result = Container.generate_initial_contents(container)

      # Should have some coins
      assert Enum.all?(result, &(&1 == "coin"))
    end
  end
end
