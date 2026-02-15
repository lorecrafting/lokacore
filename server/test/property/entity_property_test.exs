defmodule Loka.Engine.EntityPropertyTest do
  @moduledoc """
  Property-based tests for the Entity system using StreamData.

  These tests verify that entity operations maintain invariants
  across a wide range of inputs and edge cases.
  """
  use ExUnit.Case, async: true
  use ExUnitProperties

  alias Loka.Engine.Entity

  # =============================================================================
  # Generators
  # =============================================================================

  # Generate valid entity keys (snake_case identifiers)
  defp entity_key_gen do
    StreamData.string(:alphanumeric, min_length: 1, max_length: 50)
    |> StreamData.map(&String.downcase/1)
    |> StreamData.filter(&(String.length(&1) > 0))
  end

  # Generate entity types
  defp entity_type_gen do
    StreamData.member_of([:room, :npc, :item, :character, :exit])
  end

  # Generate entity descriptions (any printable ASCII string to avoid complex unicode issues)
  defp description_gen do
    StreamData.string(:ascii, min_length: 1, max_length: 100)
    |> StreamData.filter(&(String.printable?(&1) and String.length(&1) > 0))
  end

  # Generate simple tag lists
  defp tags_gen do
    entity_key_gen()
    |> StreamData.list_of(max_length: 10)
    |> StreamData.map(&Enum.uniq/1)
  end

  # Generate component values (simplified for testing)
  defp component_value_gen do
    StreamData.one_of([
      StreamData.map_of(
        StreamData.atom(:alphanumeric),
        StreamData.integer(),
        max_length: 3
      ),
      StreamData.map_of(
        StreamData.atom(:alphanumeric),
        StreamData.string(:alphanumeric, max_length: 20),
        max_length: 3
      )
    ])
  end

  # Generate component maps (simplified for testing)
  defp components_gen do
    StreamData.map_of(
      entity_key_gen(),
      component_value_gen(),
      max_length: 5
    )
  end

  # Generate a complete entity struct
  defp entity_gen do
    gen all(
          key <- entity_key_gen(),
          type <- entity_type_gen(),
          short_desc <- description_gen(),
          long_desc <- description_gen(),
          tags <- tags_gen(),
          components <- components_gen()
        ) do
      %Entity{
        id: Ecto.UUID.generate(),
        key: key,
        type: type,
        short_desc: short_desc,
        long_desc: long_desc,
        tags: tags,
        components: components,
        location_id: nil
      }
    end
  end

  # =============================================================================
  # Properties
  # =============================================================================

  describe "Entity.has_tag?/2" do
    property "returns true for tags that exist in the entity" do
      check all(
              entity <- entity_gen(),
              entity.tags != []
            ) do
        # Pick a random tag from the entity
        tag = Enum.random(entity.tags)
        assert Entity.has_tag?(entity, tag)
      end
    end

    property "returns false for tags that don't exist" do
      check all(
              entity <- entity_gen(),
              nonexistent_tag <- entity_key_gen(),
              nonexistent_tag not in entity.tags
            ) do
        refute Entity.has_tag?(entity, nonexistent_tag)
      end
    end

    property "tag check is case-sensitive" do
      check all(
              entity <- entity_gen(),
              entity.tags != []
            ) do
        tag = Enum.random(entity.tags)
        # Uppercase version should not match lowercase tag
        if tag == String.downcase(tag) and tag != String.upcase(tag) do
          refute Entity.has_tag?(entity, String.upcase(tag))
        end
      end
    end
  end

  describe "Entity.get_component/2" do
    property "returns the component value for existing components" do
      check all(
              entity <- entity_gen(),
              map_size(entity.components) > 0
            ) do
        # Pick a random component
        {key, value} = Enum.random(entity.components)
        assert Entity.get_component(entity, key) == value
      end
    end

    property "returns nil for non-existent components" do
      check all(
              entity <- entity_gen(),
              nonexistent_key <- entity_key_gen(),
              not Map.has_key?(entity.components, nonexistent_key)
            ) do
        assert Entity.get_component(entity, nonexistent_key) == nil
      end
    end
  end

  describe "Entity.has_component?/2" do
    property "returns true for existing components" do
      check all(
              entity <- entity_gen(),
              map_size(entity.components) > 0
            ) do
        {key, _value} = Enum.random(entity.components)
        assert Entity.has_component?(entity, key)
      end
    end

    property "returns false for non-existent components" do
      check all(
              entity <- entity_gen(),
              nonexistent_key <- entity_key_gen(),
              not Map.has_key?(entity.components, nonexistent_key)
            ) do
        refute Entity.has_component?(entity, nonexistent_key)
      end
    end
  end

  describe "Entity.add_component/3" do
    property "adding a component makes it retrievable" do
      check all(
              entity <- entity_gen(),
              key <- entity_key_gen(),
              value <- component_value_gen()
            ) do
        updated = Entity.add_component(entity, key, value)
        assert Entity.get_component(updated, key) == value
      end
    end

    property "adding a component makes has_component? return true" do
      check all(
              entity <- entity_gen(),
              key <- entity_key_gen(),
              value <- component_value_gen()
            ) do
        updated = Entity.add_component(entity, key, value)
        assert Entity.has_component?(updated, key)
      end
    end

    property "adding a component preserves other components" do
      check all(
              entity <- entity_gen(),
              suffix <- StreamData.positive_integer(),
              new_value <- component_value_gen()
            ) do
        # Generate a key guaranteed to not be in the entity's components
        new_key = "__test_component_#{suffix}"
        original_components = entity.components

        updated = Entity.add_component(entity, new_key, new_value)

        # All original components should still exist
        for {key, value} <- original_components do
          assert Entity.get_component(updated, key) == value
        end
      end
    end
  end

  describe "Entity.add_tag/2" do
    property "adding a tag makes has_tag? return true" do
      check all(
              entity <- entity_gen(),
              tag <- entity_key_gen()
            ) do
        updated = Entity.add_tag(entity, tag)
        assert Entity.has_tag?(updated, tag)
      end
    end

    property "adding duplicate tags is idempotent" do
      check all(
              entity <- entity_gen(),
              tag <- entity_key_gen()
            ) do
        once = Entity.add_tag(entity, tag)
        twice = Entity.add_tag(once, tag)
        assert length(Enum.filter(twice.tags, &(&1 == tag))) == 1
      end
    end

    property "adding a tag preserves existing tags" do
      check all(
              entity <- entity_gen(),
              new_tag <- entity_key_gen(),
              new_tag not in entity.tags
            ) do
        original_tags = entity.tags
        updated = Entity.add_tag(entity, new_tag)

        # All original tags should still exist
        for tag <- original_tags do
          assert Entity.has_tag?(updated, tag)
        end
      end
    end
  end

  describe "Entity type invariants" do
    property "entity type is always one of the valid types" do
      check all(entity <- entity_gen()) do
        assert entity.type in [:room, :npc, :item, :character, :exit]
      end
    end

    property "entity id is always a valid UUID" do
      check all(entity <- entity_gen()) do
        assert {:ok, _} = Ecto.UUID.cast(entity.id)
      end
    end

    property "entity key is always a string" do
      check all(entity <- entity_gen()) do
        assert is_binary(entity.key)
      end
    end

    property "entity tags is always a list" do
      check all(entity <- entity_gen()) do
        assert is_list(entity.tags)
      end
    end

    property "entity components is always a map" do
      check all(entity <- entity_gen()) do
        assert is_map(entity.components)
      end
    end
  end
end
