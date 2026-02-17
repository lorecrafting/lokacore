defmodule Loka.Engine.EntityPropertyTest do
  use ExUnit.Case, async: true
  use ExUnitProperties

  import Loka.Test.Generators

  alias Loka.Engine.Entity

  describe "Entity.new/1 properties" do
    property "always generates a UUID id" do
      check all(type <- entity_type()) do
        entity = Entity.new(type: type, key: "test")
        assert is_binary(entity.id)
        assert {:ok, _} = Ecto.UUID.cast(entity.id)
      end
    end

    property "preserves the given type" do
      check all(type <- entity_type()) do
        entity = Entity.new(type: type, key: "test")
        assert entity.type == type
      end
    end

    property "defaults to empty components, tags, metadata" do
      check all(type <- entity_type()) do
        entity = Entity.new(type: type, key: "test")
        assert entity.components == %{}
        assert entity.tags == []
        assert entity.metadata == %{}
      end
    end
  end

  describe "add_component/3 properties" do
    property "component can be retrieved after adding" do
      check all(
              type <- entity_type(),
              comp_key <- component_key(),
              comp_data <- component_data()
            ) do
        entity =
          Entity.new(type: type, key: "test")
          |> Entity.add_component(comp_key, comp_data)

        assert Entity.get_component(entity, comp_key) == comp_data
        assert Entity.has_component?(entity, comp_key)
      end
    end

    property "adding same component key overwrites previous value" do
      check all(
              type <- entity_type(),
              comp_key <- component_key(),
              data1 <- component_data(),
              data2 <- component_data()
            ) do
        entity =
          Entity.new(type: type, key: "test")
          |> Entity.add_component(comp_key, data1)
          |> Entity.add_component(comp_key, data2)

        assert Entity.get_component(entity, comp_key) == data2
      end
    end
  end

  describe "tag properties" do
    property "tags are unique after add_tag" do
      check all(
              type <- entity_type(),
              tags <-
                list_of(string(:alphanumeric, min_length: 1, max_length: 10),
                  min_length: 1,
                  max_length: 10
                )
            ) do
        entity =
          Enum.reduce(tags, Entity.new(type: type, key: "test"), fn tag, ent ->
            Entity.add_tag(ent, tag)
          end)

        assert length(entity.tags) == length(Enum.uniq(entity.tags))
      end
    end

    property "has_tag? returns true after add_tag" do
      check all(
              type <- entity_type(),
              tag <- string(:alphanumeric, min_length: 1, max_length: 10)
            ) do
        entity =
          Entity.new(type: type, key: "test")
          |> Entity.add_tag(tag)

        assert Entity.has_tag?(entity, tag)
      end
    end
  end

  describe "type validation properties" do
    property "all generated entity types are valid" do
      check all(type <- entity_type()) do
        assert Entity.valid_type?(type)
      end
    end

    property "random atoms are not valid entity types" do
      check all(name <- string(:alphanumeric, min_length: 5, max_length: 15)) do
        bogus = String.to_atom("bogus_#{name}")
        refute Entity.valid_type?(bogus)
      end
    end
  end
end
