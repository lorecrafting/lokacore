defmodule Loka.Content.StatusEffectTest do
  use ExUnit.Case, async: false

  alias Loka.Content.StatusEffect
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns status effect by key" do
      {:ok, status} =
        TypedObject.new(
          key: "test_status",
          type: :status,
          name: "Poison",
          data: %{
            "type" => "debuff",
            "stackable" => true,
            "effects" => [%{"stat" => "hp", "modifier" => -5}]
          }
        )

      Registry.put("test_status", status)

      assert {:ok, fetched} = StatusEffect.get("test_status")
      assert fetched.key == "test_status"
    end

    test "returns error for non-status" do
      {:ok, entity} = TypedObject.new(key: "not_status", type: :entity)
      Registry.put("not_status", entity)

      assert {:error, :not_found} = StatusEffect.get("not_status")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = StatusEffect.get("missing")
    end
  end

  describe "effect_type/1" do
    test "returns effect type" do
      {:ok, status} =
        TypedObject.new(
          key: "buff_status",
          type: :status,
          data: %{"type" => "buff"}
        )

      assert StatusEffect.effect_type(status) == "buff"
    end

    test "defaults to neutral" do
      {:ok, status} =
        TypedObject.new(
          key: "no_type_status",
          type: :status,
          data: %{}
        )

      assert StatusEffect.effect_type(status) == "neutral"
    end
  end

  describe "stackable?/1" do
    test "returns true when stackable" do
      {:ok, status} =
        TypedObject.new(
          key: "stackable_status",
          type: :status,
          data: %{"stackable" => true}
        )

      assert StatusEffect.stackable?(status) == true
    end

    test "returns false when not stackable" do
      {:ok, status} =
        TypedObject.new(
          key: "not_stackable",
          type: :status,
          data: %{"stackable" => false}
        )

      assert StatusEffect.stackable?(status) == false
    end

    test "defaults to false" do
      {:ok, status} =
        TypedObject.new(
          key: "default_stack",
          type: :status,
          data: %{}
        )

      assert StatusEffect.stackable?(status) == false
    end
  end

  describe "effects/1" do
    test "returns effects list" do
      effects = [
        %{"stat" => "strength", "modifier" => 10},
        %{"stat" => "defense", "modifier" => 5}
      ]

      {:ok, status} =
        TypedObject.new(
          key: "multi_effect",
          type: :status,
          data: %{"effects" => effects}
        )

      assert StatusEffect.effects(status) == effects
    end

    test "returns empty list when no effects" do
      {:ok, status} =
        TypedObject.new(
          key: "no_effects",
          type: :status,
          data: %{}
        )

      assert StatusEffect.effects(status) == []
    end
  end

  describe "duration/1" do
    test "returns duration" do
      {:ok, status} =
        TypedObject.new(
          key: "timed_status",
          type: :status,
          data: %{"duration" => 60}
        )

      assert StatusEffect.duration(status) == 60
    end

    test "returns nil when no duration" do
      {:ok, status} =
        TypedObject.new(
          key: "permanent_status",
          type: :status,
          data: %{}
        )

      assert StatusEffect.duration(status) == nil
    end
  end
end
