defmodule Loka.Content.StatusEffectTest do
  use Loka.DataCase, async: false

  alias Loka.Content.StatusEffect
  alias Loka.Engine.{Entity, Entities}

  defp create_status(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :status,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns status effect by key" do
      create_status(
        "test_status",
        %{
          "type" => "debuff",
          "stackable" => true,
          "effects" => [%{"stat" => "hp", "modifier" => -5}]
        }, name: "Poison")

      assert {:ok, fetched} = StatusEffect.get("test_status")
      assert fetched.key == "test_status"
    end

    test "returns error for non-status" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_status",
          short_desc: "Not a status",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = StatusEffect.get("not_status")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = StatusEffect.get("missing")
    end
  end

  describe "effect_type/1" do
    test "returns effect type" do
      entity = create_status("buff_status", %{"type" => "buff"})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.effect_type(status) == "buff"
    end

    test "defaults to neutral" do
      entity = create_status("no_type_status", %{})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.effect_type(status) == "neutral"
    end
  end

  describe "stackable?/1" do
    test "returns true when stackable" do
      entity = create_status("stackable_status", %{"stackable" => true})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.stackable?(status) == true
    end

    test "returns false when not stackable" do
      entity = create_status("not_stackable", %{"stackable" => false})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.stackable?(status) == false
    end

    test "defaults to false" do
      entity = create_status("default_stack", %{})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.stackable?(status) == false
    end
  end

  describe "effects/1" do
    test "returns effects list" do
      effects = [
        %{"stat" => "strength", "modifier" => 10},
        %{"stat" => "defense", "modifier" => 5}
      ]

      entity = create_status("multi_effect", %{"effects" => effects})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.effects(status) == effects
    end

    test "returns empty list when no effects" do
      entity = create_status("no_effects", %{})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.effects(status) == []
    end
  end

  describe "duration/1" do
    test "returns duration" do
      entity = create_status("timed_status", %{"duration" => 60})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.duration(status) == 60
    end

    test "returns nil when no duration" do
      entity = create_status("permanent_status", %{})
      {:ok, status} = Entity.to_typed_object(entity)

      assert StatusEffect.duration(status) == nil
    end
  end
end
