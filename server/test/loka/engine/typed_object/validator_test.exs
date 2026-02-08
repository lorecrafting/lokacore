defmodule Loka.Engine.TypedObject.ValidatorTest do
  use ExUnit.Case, async: false

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Validator
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "validate/1" do
    test "validates a correct TypedObject" do
      {:ok, to} = TypedObject.new(key: "valid_entity", type: :entity, subtype: :npc)
      assert {:ok, _} = Validator.validate(to)
    end

    test "returns errors for invalid key format" do
      to = %TypedObject{key: "123invalid", type: :entity}
      assert {:error, errors} = Validator.validate(to)
      assert Enum.any?(errors, &String.contains?(&1, "not a valid identifier"))
    end

    test "returns errors for missing key" do
      to = %TypedObject{key: nil, type: :entity}
      assert {:error, errors} = Validator.validate(to)
      assert "key is required" in errors
    end

    test "returns errors for invalid type" do
      to = %TypedObject{key: "bad_type", type: :invalid}
      assert {:error, errors} = Validator.validate(to)
      assert Enum.any?(errors, &String.contains?(&1, "invalid type"))
    end

    test "returns errors for invalid entity subtype" do
      to = %TypedObject{key: "bad_subtype", type: :entity, subtype: :invalid}
      assert {:error, errors} = Validator.validate(to)
      assert Enum.any?(errors, &String.contains?(&1, "invalid entity subtype"))
    end
  end

  describe "validate_all/0" do
    test "returns :ok when all TypedObjects valid" do
      {:ok, to1} = TypedObject.new(key: "valid1", type: :entity)
      {:ok, to2} = TypedObject.new(key: "valid2", type: :quest)

      Registry.put("valid1", to1)
      Registry.put("valid2", to2)

      assert :ok = Validator.validate_all()
    end

    test "returns :ok for empty registry" do
      assert :ok = Validator.validate_all()
    end
  end

  describe "validate_references/1" do
    test "returns empty list for valid references" do
      {:ok, parent} = TypedObject.new(key: "parent", type: :entity)
      {:ok, child} = TypedObject.new(key: "child", type: :entity, parent_key: "parent")

      Registry.put("parent", parent)
      Registry.put("child", child)

      errors = Validator.validate_references(child)
      assert errors == []
    end

    test "returns error for missing parent" do
      {:ok, orphan} = TypedObject.new(key: "orphan", type: :entity, parent_key: "nonexistent")
      Registry.put("orphan", orphan)

      errors = Validator.validate_references(orphan)
      assert Enum.any?(errors, &String.contains?(&1, "parent_key 'nonexistent' does not exist"))
    end

    test "returns error for missing quest giver" do
      {:ok, quest} =
        TypedObject.new(
          key: "bad_quest",
          type: :quest,
          data: %{"giver_key" => "nonexistent_npc"}
        )

      Registry.put("bad_quest", quest)

      errors = Validator.validate_references(quest)

      assert Enum.any?(
               errors,
               &String.contains?(&1, "quest giver_key 'nonexistent_npc' does not exist")
             )
    end

    test "returns error for missing dialogue entity" do
      {:ok, dialogue} =
        TypedObject.new(
          key: "bad_dialogue",
          type: :dialogue,
          data: %{"entity_key" => "nonexistent_npc"}
        )

      Registry.put("bad_dialogue", dialogue)

      errors = Validator.validate_references(dialogue)

      assert Enum.any?(
               errors,
               &String.contains?(&1, "dialogue entity_key 'nonexistent_npc' does not exist")
             )
    end

    test "returns error for missing zone rooms" do
      {:ok, zone} =
        TypedObject.new(
          key: "bad_zone",
          type: :zone,
          data: %{"rooms" => ["room1", "room2"]}
        )

      Registry.put("bad_zone", zone)

      errors = Validator.validate_references(zone)
      assert Enum.any?(errors, &String.contains?(&1, "zone references missing rooms"))
    end
  end

  describe "validate_no_cycles/0" do
    test "returns :ok when no cycles" do
      {:ok, grandparent} = TypedObject.new(key: "grandparent", type: :entity)
      {:ok, parent} = TypedObject.new(key: "parent", type: :entity, parent_key: "grandparent")
      {:ok, child} = TypedObject.new(key: "child", type: :entity, parent_key: "parent")

      Registry.put("grandparent", grandparent)
      Registry.put("parent", parent)
      Registry.put("child", child)

      assert :ok = Validator.validate_no_cycles()
    end

    test "detects direct cycle" do
      # Manually create cyclic references (bypassing normal validation)
      a = %TypedObject{key: "cycle_a", type: :entity, parent_key: "cycle_b"}
      b = %TypedObject{key: "cycle_b", type: :entity, parent_key: "cycle_a"}

      Registry.put("cycle_a", a)
      Registry.put("cycle_b", b)

      assert {:error, cycles} = Validator.validate_no_cycles()
      assert length(cycles) > 0
    end

    test "detects self-reference cycle" do
      self_ref = %TypedObject{key: "self_ref", type: :entity, parent_key: "self_ref"}
      Registry.put("self_ref", self_ref)

      assert {:error, _cycles} = Validator.validate_no_cycles()
    end
  end

  describe "full_validate/0" do
    test "runs all validations" do
      {:ok, to} = TypedObject.new(key: "full_valid", type: :entity)
      Registry.put("full_valid", to)

      assert :ok = Validator.full_validate()
    end

    test "catches validation errors" do
      bad = %TypedObject{key: "123bad", type: :entity}
      Registry.put("123bad", bad)

      assert {:error, _} = Validator.full_validate()
    end
  end
end
