defmodule Loka.Content.ResourceTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Resource
  alias Loka.Engine.{Entity, Entities}

  defp create_resource(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :resource,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns resource by key" do
      create_resource(
        "test_resource",
        %{
          "max_formula" => "base_hp + (level * 10)",
          "regen_rate" => 5,
          "regen_condition" => "out_of_combat"
        }, name: "Health")

      assert {:ok, fetched} = Resource.get("test_resource")
      assert fetched.key == "test_resource"
    end

    test "returns error for non-resource" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_resource",
          short_desc: "Not a resource",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Resource.get("not_resource")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Resource.get("missing")
    end
  end

  describe "max_formula/1" do
    test "returns max formula" do
      entity = create_resource("formula_resource", %{"max_formula" => "constitution * 5 + 50"})
      {:ok, resource} = Entity.to_typed_object(entity)

      assert Resource.max_formula(resource) == "constitution * 5 + 50"
    end

    test "defaults to 100" do
      entity = create_resource("default_formula", %{})
      {:ok, resource} = Entity.to_typed_object(entity)

      assert Resource.max_formula(resource) == "100"
    end
  end

  describe "regen_rate/1" do
    test "returns regen rate" do
      entity = create_resource("regen_resource", %{"regen_rate" => 10})
      {:ok, resource} = Entity.to_typed_object(entity)

      assert Resource.regen_rate(resource) == 10
    end

    test "defaults to 0" do
      entity = create_resource("no_regen", %{})
      {:ok, resource} = Entity.to_typed_object(entity)

      assert Resource.regen_rate(resource) == 0
    end
  end

  describe "regen_condition/1" do
    test "returns regen condition" do
      entity = create_resource("conditional_regen", %{"regen_condition" => "always"})
      {:ok, resource} = Entity.to_typed_object(entity)

      assert Resource.regen_condition(resource) == "always"
    end

    test "defaults to never" do
      entity = create_resource("no_condition", %{})
      {:ok, resource} = Entity.to_typed_object(entity)

      assert Resource.regen_condition(resource) == "never"
    end
  end
end
