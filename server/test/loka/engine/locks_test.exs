defmodule Loka.Engine.LocksTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Locks
  alias Loka.Engine.Entity

  describe "parse/1" do
    test "parses simple function call" do
      assert {:ok, {:func, "all", []}} = Locks.parse("all()")
      assert {:ok, {:func, "none", []}} = Locks.parse("none()")
    end

    test "parses function with single argument" do
      assert {:ok, {:func, "perm", ["admin"]}} = Locks.parse("perm(admin)")
      assert {:ok, {:func, "id", ["123"]}} = Locks.parse("id(123)")
    end

    test "parses function with multiple arguments" do
      assert {:ok, {:func, "attr", ["strength", "50"]}} = Locks.parse("attr(strength, 50)")
      assert {:ok, {:func, "attr_gt", ["level", "10"]}} = Locks.parse("attr_gt(level, 10)")
    end

    test "parses OR expression" do
      assert {:ok, {:or, {:func, "perm", ["admin"]}, {:func, "id", ["123"]}}} =
               Locks.parse("perm(admin) OR id(123)")
    end

    test "parses AND expression" do
      assert {:ok, {:and, {:func, "perm", ["builder"]}, {:func, "tag", ["active"]}}} =
               Locks.parse("perm(builder) AND tag(active)")
    end

    test "parses NOT expression" do
      assert {:ok, {:not, {:func, "tag", ["broken"]}}} = Locks.parse("NOT tag(broken)")
    end

    test "parses complex expression" do
      result = Locks.parse("perm(admin) OR id(123) AND tag(owner)")

      # AND has higher precedence than OR
      assert {:ok,
              {:or, {:func, "perm", ["admin"]},
               {:and, {:func, "id", ["123"]}, {:func, "tag", ["owner"]}}}} =
               result
    end

    test "parses parenthesized expression" do
      result = Locks.parse("(perm(admin) OR id(123)) AND tag(owner)")

      assert {:ok,
              {:and, {:or, {:func, "perm", ["admin"]}, {:func, "id", ["123"]}},
               {:func, "tag", ["owner"]}}} =
               result
    end

    test "parses NOT with AND" do
      assert {:ok, {:and, {:func, "perm", ["builder"]}, {:not, {:func, "tag", ["broken"]}}}} =
               Locks.parse("perm(builder) AND NOT tag(broken)")
    end

    test "handles whitespace" do
      assert {:ok, _} = Locks.parse("  perm(admin)  OR  id(123)  ")
    end

    test "returns ok for empty string" do
      assert {:ok, {:func, "all", []}} = Locks.parse("")
      assert {:ok, {:func, "all", []}} = Locks.parse("  ")
    end

    test "returns error for invalid syntax" do
      assert {:error, _} = Locks.parse("invalid")
      # Note: perm() is syntactically valid but semantically useless (always false)
      # The parser only validates syntax, not semantics
    end
  end

  describe "evaluate/3" do
    test "all() returns true" do
      entity = %{id: "1"}
      accessor = %{id: "2"}

      assert true == Locks.evaluate({:func, "all", []}, entity, accessor)
    end

    test "none() returns false" do
      entity = %{id: "1"}
      accessor = %{id: "2"}

      assert false == Locks.evaluate({:func, "none", []}, entity, accessor)
    end

    test "AND requires both true" do
      entity = %{tags: ["active"]}
      accessor = %{id: "123"}

      ast = {:and, {:func, "id", ["123"]}, {:func, "tag", ["active"]}}
      assert true == Locks.evaluate(ast, entity, accessor)

      ast_fail = {:and, {:func, "id", ["wrong"]}, {:func, "tag", ["active"]}}
      assert false == Locks.evaluate(ast_fail, entity, accessor)
    end

    test "OR requires at least one true" do
      entity = %{tags: ["active"]}
      accessor = %{id: "123"}

      ast = {:or, {:func, "id", ["wrong"]}, {:func, "tag", ["active"]}}
      assert true == Locks.evaluate(ast, entity, accessor)

      ast_fail = {:or, {:func, "id", ["wrong"]}, {:func, "tag", ["broken"]}}
      assert false == Locks.evaluate(ast_fail, entity, accessor)
    end

    test "NOT inverts result" do
      entity = %{tags: ["active"]}
      accessor = %{id: "123"}

      assert false == Locks.evaluate({:not, {:func, "tag", ["active"]}}, entity, accessor)
      assert true == Locks.evaluate({:not, {:func, "tag", ["broken"]}}, entity, accessor)
    end
  end

  describe "check/3" do
    test "returns :ok when no lock defined" do
      entity = %Entity{id: "1", type: :item, key: "chest", components: %{"locks" => %{}}}
      accessor = %Entity{id: "2", type: :character, key: "player"}

      assert :ok = Locks.check(entity, accessor, "get")
    end

    test "returns :ok when lock passes" do
      entity = %Entity{
        id: "1",
        type: :item,
        key: "chest",
        components: %{"locks" => %{"get" => "all()"}}
      }

      accessor = %Entity{id: "2", type: :character, key: "player"}

      assert :ok = Locks.check(entity, accessor, "get")
    end

    test "returns {:denied, _} when lock fails" do
      entity = %Entity{
        id: "1",
        type: :item,
        key: "chest",
        components: %{"locks" => %{"get" => "none()"}}
      }

      accessor = %Entity{id: "2", type: :character, key: "player"}

      assert {:denied, _} = Locks.check(entity, accessor, "get")
    end

    test "handles complex lock strings" do
      entity = %Entity{
        id: "1",
        type: :item,
        key: "chest",
        tags: ["container"],
        components: %{"locks" => %{"get" => "tag(locked) AND perm(admin)"}}
      }

      # Use maps for accessor since Entity doesn't have permissions field
      admin = %{id: "2", type: :character, key: "admin", permissions: ["admin"]}
      player = %{id: "3", type: :character, key: "player", permissions: []}

      # Entity doesn't have "locked" tag, so AND fails
      assert {:denied, _} = Locks.check(entity, admin, "get")

      # Add locked tag
      locked_entity = %{entity | tags: ["container", "locked"]}
      assert :ok = Locks.check(locked_entity, admin, "get")
      assert {:denied, _} = Locks.check(locked_entity, player, "get")
    end
  end

  describe "lock functions" do
    test "check_permission with permissions list" do
      accessor = %{permissions: ["builder", "admin"]}

      assert Locks.check_permission(nil, accessor, ["admin"])
      assert Locks.check_permission(nil, accessor, ["builder"])
      refute Locks.check_permission(nil, accessor, ["superuser"])
    end

    test "check_permission with is_admin flag" do
      admin = %{is_admin: true, permissions: []}
      player = %{is_admin: false, permissions: []}

      assert Locks.check_permission(nil, admin, ["anything"])
      refute Locks.check_permission(nil, player, ["admin"])
    end

    test "check_id matches accessor id" do
      accessor = %{id: "abc123"}

      assert Locks.check_id(nil, accessor, ["abc123"])
      refute Locks.check_id(nil, accessor, ["wrong"])
    end

    test "check_tag finds entity tag" do
      entity = %{tags: ["locked", "metal"]}

      assert Locks.check_tag(entity, nil, ["locked"])
      assert Locks.check_tag(entity, nil, ["metal"])
      refute Locks.check_tag(entity, nil, ["wooden"])
    end

    test "check_attribute equals value" do
      entity = %{attributes: %{"strength" => 50, "name" => "test"}}

      assert Locks.check_attribute(entity, nil, ["strength", "50"])
      assert Locks.check_attribute(entity, nil, ["name", "test"])
      refute Locks.check_attribute(entity, nil, ["strength", "100"])
    end

    test "check_attribute_gt compares numbers" do
      entity = %{attributes: %{"strength" => 50}}

      assert Locks.check_attribute_gt(entity, nil, ["strength", "40"])
      refute Locks.check_attribute_gt(entity, nil, ["strength", "50"])
      refute Locks.check_attribute_gt(entity, nil, ["strength", "60"])
    end

    test "check_attribute_lt compares numbers" do
      entity = %{attributes: %{"strength" => 50}}

      refute Locks.check_attribute_lt(entity, nil, ["strength", "40"])
      refute Locks.check_attribute_lt(entity, nil, ["strength", "50"])
      assert Locks.check_attribute_lt(entity, nil, ["strength", "60"])
    end

    test "check_attribute searches components" do
      entity = %{
        attributes: %{},
        components: %{
          "stats" => %{
            "strength" => 75
          }
        }
      }

      assert Locks.check_attribute_gt(entity, nil, ["strength", "50"])
    end

    test "check_is_type matches entity type" do
      accessor = %{type: :character}

      assert Locks.check_is_type(nil, accessor, ["character"])
      refute Locks.check_is_type(nil, accessor, ["npc"])
    end

    test "check_in_room matches location_id" do
      accessor = %{location_id: "room123"}

      assert Locks.check_in_room(nil, accessor, ["room123"])
      refute Locks.check_in_room(nil, accessor, ["other_room"])
    end
  end

  describe "set_lock/3 and get_lock/2" do
    test "sets and gets lock on entity" do
      entity = %Entity{id: "1", type: :item, key: "test", components: %{}}

      entity = Locks.set_lock(entity, "get", "perm(admin)")
      assert "perm(admin)" = Locks.get_lock(entity, "get")
    end

    test "overwrites existing lock" do
      entity = %Entity{
        id: "1",
        type: :item,
        key: "test",
        components: %{"locks" => %{"get" => "all()"}}
      }

      entity = Locks.set_lock(entity, "get", "none()")
      assert "none()" = Locks.get_lock(entity, "get")
    end

    test "get_lock returns nil for undefined lock" do
      entity = %Entity{id: "1", type: :item, key: "test", components: %{}}

      assert nil == Locks.get_lock(entity, "nonexistent")
    end
  end

  describe "register_function/2" do
    test "registers custom lock function" do
      # Register a custom function
      Locks.register_function("custom_check", fn _entity, accessor, [value] ->
        accessor[:custom_value] == value
      end)

      entity = %{id: "1"}
      accessor = %{id: "2", custom_value: "expected"}

      # Parse and evaluate with custom function
      {:ok, ast} = Locks.parse("custom_check(expected)")
      assert true == Locks.evaluate(ast, entity, accessor)

      {:ok, ast_fail} = Locks.parse("custom_check(wrong)")
      assert false == Locks.evaluate(ast_fail, entity, accessor)

      # Cleanup
      Locks.unregister_function("custom_check")
    end
  end

  describe "integration" do
    test "complex lock evaluation" do
      # A locked chest that requires either admin perms or the gold_key
      chest = %Entity{
        id: "chest1",
        type: :item,
        key: "golden_chest",
        tags: ["container", "valuable"],
        components: %{
          "locks" => %{"get" => "perm(admin) OR has_item(gold_key)"}
        }
      }

      # Player without key (use map for permissions/contents which aren't Entity fields)
      player = %{
        id: "player1",
        type: :character,
        key: "player",
        permissions: [],
        contents: []
      }

      assert {:denied, _} = Locks.check(chest, player, "get")

      # Admin player
      admin = %{
        id: "admin1",
        type: :character,
        key: "admin",
        permissions: ["admin"],
        contents: []
      }

      assert :ok = Locks.check(chest, admin, "get")

      # Player with key (contents would contain item structs in real scenario)
      player_with_key = %{player | contents: [%{key: "gold_key"}]}
      assert :ok = Locks.check(chest, player_with_key, "get")
    end

    test "locked door example" do
      door = %Entity{
        id: "door1",
        type: :exit,
        key: "castle_door",
        components: %{
          "locks" => %{"traverse" => "has_key(castle_key) OR perm(royalty)"}
        }
      }

      # Use maps for accessors that need permissions/contents fields
      commoner = %{id: "p1", type: :character, key: "commoner", permissions: [], contents: []}
      noble = %{id: "p2", type: :character, key: "noble", permissions: ["royalty"], contents: []}

      guard = %{
        id: "p3",
        type: :character,
        key: "guard",
        permissions: [],
        contents: [%{key: "castle_key"}]
      }

      assert {:denied, _} = Locks.check(door, commoner, "traverse")
      assert :ok = Locks.check(door, noble, "traverse")
      assert :ok = Locks.check(door, guard, "traverse")
    end
  end
end
