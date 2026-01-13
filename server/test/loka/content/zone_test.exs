defmodule Loka.Content.ZoneTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Zone
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Registry.init()
    Registry.clear()
    :ok
  end

  describe "get/1" do
    test "returns zone by key" do
      {:ok, zone} =
        TypedObject.new(
          key: "test_zone",
          type: :zone,
          data: %{
            "rooms" => ["room1", "room2"]
          }
        )

      Registry.put("test_zone", zone)

      assert {:ok, fetched} = Zone.get("test_zone")
      assert fetched.key == "test_zone"
    end

    test "returns error for non-zone" do
      {:ok, entity} = TypedObject.new(key: "not_zone", type: :entity)
      Registry.put("not_zone", entity)

      assert {:error, :not_found} = Zone.get("not_zone")
    end
  end

  describe "rooms/1 and rooms_with_tag/1" do
    test "returns explicit room list" do
      {:ok, zone} =
        TypedObject.new(
          key: "explicit_rooms",
          type: :zone,
          data: %{"rooms" => ["room_a", "room_b", "room_c"]}
        )

      assert Zone.rooms(zone) == ["room_a", "room_b", "room_c"]
    end

    test "returns rooms_with_tag" do
      {:ok, zone} =
        TypedObject.new(
          key: "tagged_rooms",
          type: :zone,
          data: %{"rooms_with_tag" => "forest"}
        )

      assert Zone.rooms_with_tag(zone) == "forest"
    end
  end

  describe "resets/1" do
    test "returns reset rules" do
      resets = [
        %{"type" => "mob", "prototype" => "goblin", "max" => 5},
        %{"type" => "item", "prototype" => "potion", "max" => 3}
      ]

      {:ok, zone} =
        TypedObject.new(
          key: "reset_zone",
          type: :zone,
          data: %{"rooms" => ["r1"], "resets" => resets}
        )

      assert Zone.resets(zone) == resets
    end

    test "returns empty list when no resets" do
      {:ok, zone} =
        TypedObject.new(
          key: "no_resets",
          type: :zone,
          data: %{"rooms" => ["r1"]}
        )

      assert Zone.resets(zone) == []
    end
  end

  describe "lifespan_minutes/1" do
    test "returns lifespan" do
      {:ok, zone} =
        TypedObject.new(
          key: "timed_zone",
          type: :zone,
          data: %{"rooms" => ["r1"], "lifespan_minutes" => 30}
        )

      assert Zone.lifespan_minutes(zone) == 30
    end
  end

  describe "reset_mode/1" do
    test "returns reset mode" do
      {:ok, zone} =
        TypedObject.new(
          key: "mode_zone",
          type: :zone,
          data: %{"rooms" => ["r1"], "reset_mode" => "always"}
        )

      assert Zone.reset_mode(zone) == :always
    end

    test "defaults to empty" do
      {:ok, zone} =
        TypedObject.new(
          key: "default_mode",
          type: :zone,
          data: %{"rooms" => ["r1"]}
        )

      assert Zone.reset_mode(zone) == :empty
    end
  end

  describe "level_range/1" do
    test "returns level range from attributes" do
      {:ok, zone} =
        TypedObject.new(
          key: "leveled_zone",
          type: :zone,
          attributes: %{"level_range" => %{"min" => 10, "max" => 20}},
          data: %{"rooms" => ["r1"]}
        )

      assert Zone.level_range(zone) == {10, 20}
    end

    test "returns nil when no level range" do
      {:ok, zone} =
        TypedObject.new(
          key: "no_level",
          type: :zone,
          data: %{"rooms" => ["r1"]}
        )

      assert Zone.level_range(zone) == nil
    end
  end

  describe "entry_lock/1" do
    test "returns entry lock" do
      {:ok, zone} =
        TypedObject.new(
          key: "locked_zone",
          type: :zone,
          locks: %{"enter" => "level >= 10"},
          data: %{"rooms" => ["r1"]}
        )

      assert Zone.entry_lock(zone) == "level >= 10"
    end
  end

  describe "instance?/1" do
    test "returns true for instance zone" do
      {:ok, zone} =
        TypedObject.new(
          key: "instance_zone",
          type: :zone,
          tags: ["instance", "dungeon"],
          data: %{"rooms" => ["r1"]}
        )

      assert Zone.instance?(zone)
    end

    test "returns false for regular zone" do
      {:ok, zone} =
        TypedObject.new(
          key: "regular_zone",
          type: :zone,
          tags: ["forest"],
          data: %{"rooms" => ["r1"]}
        )

      refute Zone.instance?(zone)
    end
  end

  describe "validate/1" do
    test "passes for valid zone with rooms" do
      {:ok, zone} =
        TypedObject.new(
          key: "valid_zone",
          type: :zone,
          data: %{
            "rooms" => ["room1", "room2"],
            "resets" => [%{"type" => "mob", "prototype" => "goblin", "max" => 3}]
          }
        )

      assert :ok = Zone.validate(zone)
    end

    test "passes for zone with rooms_with_tag" do
      {:ok, zone} =
        TypedObject.new(
          key: "tagged_zone",
          type: :zone,
          data: %{"rooms_with_tag" => "forest"}
        )

      assert :ok = Zone.validate(zone)
    end

    test "fails for zone without rooms or tag" do
      {:ok, zone} =
        TypedObject.new(
          key: "no_rooms",
          type: :zone,
          data: %{}
        )

      assert {:error, errors} = Zone.validate(zone)
      assert Enum.any?(errors, &String.contains?(&1, "rooms"))
    end

    test "fails for reset without prototype" do
      {:ok, zone} =
        TypedObject.new(
          key: "bad_reset",
          type: :zone,
          data: %{
            "rooms" => ["r1"],
            "resets" => [%{"type" => "mob", "max" => 5}]
          }
        )

      assert {:error, errors} = Zone.validate(zone)
      assert Enum.any?(errors, &String.contains?(&1, "prototype"))
    end
  end
end
