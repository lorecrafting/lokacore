defmodule Loka.Engine.ZoneTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Zone

  describe "new/1" do
    test "creates a zone with required fields" do
      attrs = %{
        key: "test_zone",
        name: "Test Zone",
        rooms: ["room1", "room2"]
      }

      assert {:ok, zone} = Zone.new(attrs)
      assert zone.key == "test_zone"
      assert zone.name == "Test Zone"
      assert zone.rooms == ["room1", "room2"]
      assert zone.lifespan_minutes == 30
      assert zone.reset_mode == :empty
      assert zone.enabled == true
    end

    test "creates a zone with string keys" do
      attrs = %{
        "key" => "test_zone",
        "name" => "Test Zone",
        "rooms" => ["room1"],
        "lifespan_minutes" => 60,
        "reset_mode" => "always"
      }

      assert {:ok, zone} = Zone.new(attrs)
      assert zone.lifespan_minutes == 60
      assert zone.reset_mode == :always
    end

    test "creates a zone with rooms_with_tag" do
      attrs = %{
        key: "test_zone",
        name: "Test Zone",
        rooms_with_tag: "dungeon"
      }

      assert {:ok, zone} = Zone.new(attrs)
      assert zone.rooms_with_tag == "dungeon"
    end

    test "validates key is required" do
      attrs = %{name: "Test Zone", rooms: ["room1"]}

      assert {:error, errors} = Zone.new(attrs)
      assert "key is required" in errors
    end

    test "validates name is required" do
      attrs = %{key: "test_zone", rooms: ["room1"]}

      assert {:error, errors} = Zone.new(attrs)
      assert "name is required" in errors
    end

    test "validates rooms or rooms_with_tag required" do
      attrs = %{key: "test_zone", name: "Test Zone"}

      assert {:error, errors} = Zone.new(attrs)
      assert "zone must have rooms or rooms_with_tag defined" in errors
    end

    test "validates reset_mode" do
      attrs = %{key: "test_zone", name: "Test Zone", rooms: ["room1"], reset_mode: :invalid}

      assert {:error, errors} = Zone.new(attrs)
      assert Enum.any?(errors, &String.contains?(&1, "reset_mode"))
    end

    test "parses reset commands" do
      attrs = %{
        key: "test_zone",
        name: "Test Zone",
        rooms: ["room1"],
        resets: [
          %{type: "mob", prototype: "goblin", room: "room1", max: 3},
          %{type: "object", prototype: "sword", room: "room1", max: 1},
          %{type: "door", room: "room1", direction: "north", state: "closed"}
        ]
      }

      assert {:ok, zone} = Zone.new(attrs)
      assert length(zone.resets) == 3

      [mob_reset, obj_reset, door_reset] = zone.resets
      assert mob_reset.type == :mob
      assert obj_reset.type == :object
      assert door_reset.type == :door
      assert door_reset.state == :closed
    end
  end

  describe "should_reset?/2" do
    test "never mode returns false" do
      {:ok, zone} = Zone.new(%{key: "z", name: "Z", rooms: ["r"], reset_mode: :never})

      refute Zone.should_reset?(zone, false)
      refute Zone.should_reset?(zone, true)
    end

    test "always mode returns true" do
      {:ok, zone} = Zone.new(%{key: "z", name: "Z", rooms: ["r"], reset_mode: :always})

      assert Zone.should_reset?(zone, false)
      assert Zone.should_reset?(zone, true)
    end

    test "empty mode returns true only when no players" do
      {:ok, zone} = Zone.new(%{key: "z", name: "Z", rooms: ["r"], reset_mode: :empty})

      assert Zone.should_reset?(zone, false)
      refute Zone.should_reset?(zone, true)
    end
  end

  describe "next_reset_at/1" do
    test "calculates next reset from now when no last reset" do
      {:ok, zone} = Zone.new(%{key: "z", name: "Z", rooms: ["r"], lifespan_minutes: 30})

      next = Zone.next_reset_at(zone)
      now = DateTime.utc_now()

      diff = DateTime.diff(next, now, :second)
      assert diff >= 1790 and diff <= 1810
    end

    test "calculates next reset from last reset time" do
      last = DateTime.add(DateTime.utc_now(), -600, :second)

      {:ok, zone} = Zone.new(%{key: "z", name: "Z", rooms: ["r"], lifespan_minutes: 30})
      zone = %{zone | last_reset_at: last}

      next = Zone.next_reset_at(zone)

      # Should be 30 minutes from last reset, which is 20 minutes from now
      diff = DateTime.diff(next, DateTime.utc_now(), :second)
      assert diff >= 1190 and diff <= 1210
    end
  end

  describe "validate/1" do
    test "validates mob reset has required fields" do
      attrs = %{
        key: "z",
        name: "Z",
        rooms: ["r"],
        resets: [%{type: :mob}]
      }

      assert {:error, errors} = Zone.new(attrs)
      assert Enum.any?(errors, &String.contains?(&1, "mob reset requires prototype"))
    end

    test "validates door reset has required fields" do
      attrs = %{
        key: "z",
        name: "Z",
        rooms: ["r"],
        resets: [%{type: :door, room: "r", direction: "north"}]
      }

      assert {:error, errors} = Zone.new(attrs)
      assert Enum.any?(errors, &String.contains?(&1, "door state"))
    end

    test "validates remove reset has required fields" do
      attrs = %{
        key: "z",
        name: "Z",
        rooms: ["r"],
        resets: [%{type: :remove}]
      }

      assert {:error, errors} = Zone.new(attrs)
      assert Enum.any?(errors, &String.contains?(&1, "remove reset requires"))
    end
  end
end
