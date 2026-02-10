defmodule Loka.Content.ResourceTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Resource
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns resource by key" do
      {:ok, resource} =
        TypedObject.new(
          key: "test_resource",
          type: :resource,
          name: "Health",
          data: %{
            "max_formula" => "base_hp + (level * 10)",
            "regen_rate" => 5,
            "regen_condition" => "out_of_combat"
          }
        )

      Registry.put("test_resource", resource)

      assert {:ok, fetched} = Resource.get("test_resource")
      assert fetched.key == "test_resource"
    end

    test "returns error for non-resource" do
      {:ok, entity} = TypedObject.new(key: "not_resource", type: :entity)
      Registry.put("not_resource", entity)

      assert {:error, :not_found} = Resource.get("not_resource")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Resource.get("missing")
    end
  end

  describe "max_formula/1" do
    test "returns max formula" do
      {:ok, resource} =
        TypedObject.new(
          key: "formula_resource",
          type: :resource,
          data: %{"max_formula" => "constitution * 5 + 50"}
        )

      assert Resource.max_formula(resource) == "constitution * 5 + 50"
    end

    test "defaults to 100" do
      {:ok, resource} =
        TypedObject.new(
          key: "default_formula",
          type: :resource,
          data: %{}
        )

      assert Resource.max_formula(resource) == "100"
    end
  end

  describe "regen_rate/1" do
    test "returns regen rate" do
      {:ok, resource} =
        TypedObject.new(
          key: "regen_resource",
          type: :resource,
          data: %{"regen_rate" => 10}
        )

      assert Resource.regen_rate(resource) == 10
    end

    test "defaults to 0" do
      {:ok, resource} =
        TypedObject.new(
          key: "no_regen",
          type: :resource,
          data: %{}
        )

      assert Resource.regen_rate(resource) == 0
    end
  end

  describe "regen_condition/1" do
    test "returns regen condition" do
      {:ok, resource} =
        TypedObject.new(
          key: "conditional_regen",
          type: :resource,
          data: %{"regen_condition" => "always"}
        )

      assert Resource.regen_condition(resource) == "always"
    end

    test "defaults to never" do
      {:ok, resource} =
        TypedObject.new(
          key: "no_condition",
          type: :resource,
          data: %{}
        )

      assert Resource.regen_condition(resource) == "never"
    end
  end
end
