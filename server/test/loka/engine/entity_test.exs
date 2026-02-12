defmodule Loka.Engine.EntityTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Entity

  describe "new/2" do
    test "creates a new entity with a UUID" do
      entity = Entity.new(:room, %{short_desc: "Test Room"})

      assert entity.id != nil
      assert entity.type == :room
      assert entity.short_desc == "Test Room"
      assert entity.metadata == %{}
    end
  end

  describe "add_component/3" do
    test "adds a component to an entity" do
      entity = Entity.new(type: :character)
      component = %{health: 100, max_health: 100}

      entity = Entity.add_component(entity, :combatant, component)

      assert entity.components[:combatant] == component
    end
  end

  describe "get_component/2" do
    test "gets a component from an entity" do
      entity =
        Entity.new(type: :character)
        |> Entity.add_component(:combatant, %{health: 100})

      assert Entity.get_component(entity, :combatant) == %{health: 100}
      assert Entity.get_component(entity, :nonexistent) == nil
    end
  end

  describe "has_component?/2" do
    test "checks if entity has a component" do
      entity =
        Entity.new(type: :character)
        |> Entity.add_component(:combatant, %{})

      assert Entity.has_component?(entity, :combatant)
      refute Entity.has_component?(entity, :tradeable)
    end
  end

  describe "add_tag/2 and has_tag?/2" do
    test "adds and checks tags" do
      entity =
        Entity.new(type: :npc)
        |> Entity.add_tag("hostile")
        |> Entity.add_tag("boss")

      assert Entity.has_tag?(entity, "hostile")
      assert Entity.has_tag?(entity, "boss")
      refute Entity.has_tag?(entity, "friendly")
    end

    test "does not duplicate tags" do
      entity =
        Entity.new(type: :npc)
        |> Entity.add_tag("hostile")
        |> Entity.add_tag("hostile")

      assert length(entity.tags) == 1
    end
  end
end
