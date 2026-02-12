defmodule Loka.Content.ZoneTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Zone
  alias Loka.Engine.{Entity, Entities}

  defp create_zone(key, data, opts \\ []) do
    components = %{"data" => data}

    components =
      if opts[:locks],
        do: Map.put(components, "locks", opts[:locks]),
        else: components

    entity =
      Entity.new(
        type: :zone,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: components
      )

    {:ok, saved} = Entities.save(entity)

    if opts[:tags] do
      Enum.each(opts[:tags], fn tag -> Entities.add_tag(saved.id, tag) end)
      # Re-fetch to get tags loaded
      {:ok, refetched} = Entities.find_one(saved.id)
      refetched
    else
      saved
    end
  end

  describe "get/1" do
    test "returns zone by key" do
      create_zone("test_zone", %{"rooms" => ["room1", "room2"]})

      assert {:ok, fetched} = Zone.get("test_zone")
      assert fetched.key == "test_zone"
    end

    test "returns error for non-zone" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_zone",
          short_desc: "Not a zone",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Zone.get("not_zone")
    end
  end

  describe "rooms/1 and rooms_with_tag/1" do
    test "returns explicit room list" do
      entity = create_zone("explicit_rooms", %{"rooms" => ["room_a", "room_b", "room_c"]})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.rooms(zone) == ["room_a", "room_b", "room_c"]
    end

    test "returns rooms_with_tag" do
      entity = create_zone("tagged_rooms", %{"rooms_with_tag" => "forest"})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.rooms_with_tag(zone) == "forest"
    end
  end

  describe "resets/1" do
    test "returns reset rules" do
      resets = [
        %{"type" => "mob", "prototype" => "goblin", "max" => 5},
        %{"type" => "item", "prototype" => "potion", "max" => 3}
      ]

      entity = create_zone("reset_zone", %{"rooms" => ["r1"], "resets" => resets})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.resets(zone) == resets
    end

    test "returns empty list when no resets" do
      entity = create_zone("no_resets", %{"rooms" => ["r1"]})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.resets(zone) == []
    end
  end

  describe "lifespan_minutes/1" do
    test "returns lifespan" do
      entity = create_zone("timed_zone", %{"rooms" => ["r1"], "lifespan_minutes" => 30})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.lifespan_minutes(zone) == 30
    end
  end

  describe "reset_mode/1" do
    test "returns reset mode" do
      entity = create_zone("mode_zone", %{"rooms" => ["r1"], "reset_mode" => "always"})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.reset_mode(zone) == :always
    end

    test "defaults to empty" do
      entity = create_zone("default_mode", %{"rooms" => ["r1"]})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.reset_mode(zone) == :empty
    end
  end

  describe "level_range/1" do
    test "returns nil when no level range in V2" do
      # In V2, attributes are not carried through Entity -> TypedObject conversion
      # level_range data in attributes is not preserved
      entity = create_zone("leveled_zone", %{"rooms" => ["r1"]})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.level_range(zone) == nil
    end

    test "returns nil when no level range" do
      entity = create_zone("no_level", %{"rooms" => ["r1"]})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.level_range(zone) == nil
    end
  end

  describe "entry_lock/1" do
    test "returns entry lock" do
      entity =
        create_zone("locked_zone", %{"rooms" => ["r1"]}, locks: %{"enter" => "level >= 10"})

      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.entry_lock(zone) == "level >= 10"
    end
  end

  describe "instance?/1" do
    test "returns true for instance zone" do
      entity = create_zone("instance_zone", %{"rooms" => ["r1"]}, tags: ["instance", "dungeon"])
      {:ok, zone} = Entity.to_typed_object(entity)

      assert Zone.instance?(zone)
    end

    test "returns false for regular zone" do
      entity = create_zone("regular_zone", %{"rooms" => ["r1"]}, tags: ["forest"])
      {:ok, zone} = Entity.to_typed_object(entity)

      refute Zone.instance?(zone)
    end
  end

  describe "validate/1" do
    test "passes for valid zone with rooms" do
      entity =
        create_zone("valid_zone", %{
          "rooms" => ["room1", "room2"],
          "resets" => [%{"type" => "mob", "prototype" => "goblin", "max" => 3}]
        })

      {:ok, zone} = Entity.to_typed_object(entity)

      assert :ok = Zone.validate(zone)
    end

    test "passes for zone with rooms_with_tag" do
      entity = create_zone("tagged_zone", %{"rooms_with_tag" => "forest"})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert :ok = Zone.validate(zone)
    end

    test "fails for zone without rooms or tag" do
      entity = create_zone("no_rooms", %{})
      {:ok, zone} = Entity.to_typed_object(entity)

      assert {:error, errors} = Zone.validate(zone)
      assert Enum.any?(errors, &String.contains?(&1, "rooms"))
    end

    test "fails for reset without prototype" do
      entity =
        create_zone("bad_reset", %{
          "rooms" => ["r1"],
          "resets" => [%{"type" => "mob", "max" => 5}]
        })

      {:ok, zone} = Entity.to_typed_object(entity)

      assert {:error, errors} = Zone.validate(zone)
      assert Enum.any?(errors, &String.contains?(&1, "prototype"))
    end
  end
end
