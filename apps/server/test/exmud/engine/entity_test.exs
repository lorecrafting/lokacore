defmodule Exmud.Engine.EntityTest do
  use ExUnit.Case, async: true

  alias Exmud.Engine.Entity

  describe "new/2" do
    test "creates a new entity with a UUID" do
      entity = Entity.new(:room, %{name: "Test Room"})

      assert entity.id != nil
      assert entity.type == :room
      assert entity.name == "Test Room"
      assert entity.metadata.created_at != nil
    end
  end

  describe "add_component/3" do
    test "adds a component to an entity" do
      entity = Entity.new(:character)
      component = %{health: 100, max_health: 100}

      entity = Entity.add_component(entity, :combatant, component)

      assert entity.components[:combatant] == component
    end
  end

  describe "get_component/2" do
    test "gets a component from an entity" do
      entity =
        Entity.new(:character)
        |> Entity.add_component(:combatant, %{health: 100})

      assert Entity.get_component(entity, :combatant) == %{health: 100}
      assert Entity.get_component(entity, :nonexistent) == nil
    end
  end

  describe "has_component?/2" do
    test "checks if entity has a component" do
      entity =
        Entity.new(:character)
        |> Entity.add_component(:combatant, %{})

      assert Entity.has_component?(entity, :combatant)
      refute Entity.has_component?(entity, :tradeable)
    end
  end

  describe "set_attribute/3 and get_attribute/3" do
    test "sets and gets attributes" do
      entity =
        Entity.new(:item)
        |> Entity.set_attribute(:rarity, "legendary")
        |> Entity.set_attribute(:level, 50)

      assert Entity.get_attribute(entity, :rarity) == "legendary"
      assert Entity.get_attribute(entity, :level) == 50
      assert Entity.get_attribute(entity, :unknown, "default") == "default"
    end
  end

  describe "add_tag/2 and has_tag?/2" do
    test "adds and checks tags" do
      entity =
        Entity.new(:npc)
        |> Entity.add_tag("hostile")
        |> Entity.add_tag("boss")

      assert Entity.has_tag?(entity, "hostile")
      assert Entity.has_tag?(entity, "boss")
      refute Entity.has_tag?(entity, "friendly")
    end

    test "does not duplicate tags" do
      entity =
        Entity.new(:npc)
        |> Entity.add_tag("hostile")
        |> Entity.add_tag("hostile")

      assert length(entity.tags) == 1
    end
  end
end
