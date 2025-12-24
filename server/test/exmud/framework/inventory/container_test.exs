defmodule Exmud.Framework.Inventory.ContainerTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Inventory.Container

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
end
