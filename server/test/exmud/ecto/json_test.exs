defmodule Exmud.Ecto.JsonTest do
  use ExUnit.Case, async: true

  alias Exmud.Ecto.Json

  describe "type/0" do
    test "returns :string" do
      assert Json.type() == :string
    end
  end

  describe "cast/1" do
    test "casts nil" do
      assert {:ok, nil} = Json.cast(nil)
    end

    test "casts any term" do
      assert {:ok, %{foo: :bar}} = Json.cast(%{foo: :bar})
      assert {:ok, [1, 2, 3]} = Json.cast([1, 2, 3])
      assert {:ok, "string"} = Json.cast("string")
      assert {:ok, 42} = Json.cast(42)
    end
  end

  describe "load/1" do
    test "loads nil" do
      assert {:ok, nil} = Json.load(nil)
    end

    test "loads valid JSON string" do
      assert {:ok, %{"foo" => "bar"}} = Json.load(~s({"foo": "bar"}))
    end

    test "loads nested JSON" do
      json = ~s({"health": {"current": 100, "max": 100}})
      assert {:ok, %{"health" => %{"current" => 100, "max" => 100}}} = Json.load(json)
    end

    test "loads arrays" do
      assert {:ok, [1, 2, 3]} = Json.load("[1, 2, 3]")
    end

    test "returns error for invalid JSON" do
      assert :error = Json.load("not valid json")
    end
  end

  describe "dump/1" do
    test "dumps nil" do
      assert {:ok, nil} = Json.dump(nil)
    end

    test "dumps simple values" do
      assert {:ok, "42"} = Json.dump(42)
      assert {:ok, ~s("hello")} = Json.dump("hello")
      assert {:ok, "true"} = Json.dump(true)
    end

    test "converts atoms to strings" do
      assert {:ok, json} = Json.dump(:attack)
      assert json == ~s("attack")
    end

    test "converts atom keys to strings" do
      assert {:ok, json} = Json.dump(%{foo: "bar", baz: 123})
      decoded = Jason.decode!(json)
      assert decoded == %{"foo" => "bar", "baz" => 123}
    end

    test "converts nested atom keys to strings" do
      data = %{
        health: %{current: 100, max: 100},
        stats: %{str: 10, dex: 12}
      }

      assert {:ok, json} = Json.dump(data)
      decoded = Jason.decode!(json)

      assert decoded == %{
               "health" => %{"current" => 100, "max" => 100},
               "stats" => %{"str" => 10, "dex" => 12}
             }
    end

    test "converts tuples to arrays" do
      assert {:ok, json} = Json.dump({1, 2, 3})
      assert Jason.decode!(json) == [1, 2, 3]
    end

    test "converts nested tuples" do
      data = %{position: {10, 20}}
      assert {:ok, json} = Json.dump(data)
      decoded = Jason.decode!(json)
      assert decoded == %{"position" => [10, 20]}
    end

    test "handles lists" do
      assert {:ok, json} = Json.dump([1, 2, 3])
      assert Jason.decode!(json) == [1, 2, 3]
    end

    test "handles lists of maps with atom keys" do
      data = [%{id: 1, name: "foo"}, %{id: 2, name: "bar"}]
      assert {:ok, json} = Json.dump(data)
      decoded = Jason.decode!(json)

      assert decoded == [
               %{"id" => 1, "name" => "foo"},
               %{"id" => 2, "name" => "bar"}
             ]
    end

    test "handles deeply nested structures" do
      data = %{
        level1: %{
          level2: %{
            level3: %{
              value: :deep,
              list: [1, 2, 3]
            }
          }
        }
      }

      assert {:ok, json} = Json.dump(data)
      decoded = Jason.decode!(json)

      assert decoded == %{
               "level1" => %{
                 "level2" => %{
                   "level3" => %{
                     "value" => "deep",
                     "list" => [1, 2, 3]
                   }
                 }
               }
             }
    end

    test "handles mixed key types" do
      data = %{:atom_key => 1, "string_key" => 2}
      assert {:ok, json} = Json.dump(data)
      decoded = Jason.decode!(json)
      assert decoded == %{"atom_key" => 1, "string_key" => 2}
    end

    test "handles empty structures" do
      assert {:ok, "{}"} = Json.dump(%{})
      assert {:ok, "[]"} = Json.dump([])
    end
  end

  describe "round-trip" do
    test "simple map round-trip preserves data (with string keys)" do
      original = %{health: 100, name: "Test"}
      assert {:ok, json} = Json.dump(original)
      assert {:ok, loaded} = Json.load(json)
      assert loaded == %{"health" => 100, "name" => "Test"}
    end

    test "nested structure round-trip" do
      original = %{
        components: %{
          health: %{current: 50, max: 100},
          position: %{x: 10, y: 20}
        },
        tags: ["npc", "hostile"]
      }

      assert {:ok, json} = Json.dump(original)
      assert {:ok, loaded} = Json.load(json)

      assert loaded == %{
               "components" => %{
                 "health" => %{"current" => 50, "max" => 100},
                 "position" => %{"x" => 10, "y" => 20}
               },
               "tags" => ["npc", "hostile"]
             }
    end

    test "behaviors list round-trip" do
      original = ["DefaultObject", "Container", "Lockable"]
      assert {:ok, json} = Json.dump(original)
      assert {:ok, loaded} = Json.load(json)
      assert loaded == original
    end

    test "empty map round-trip" do
      assert {:ok, json} = Json.dump(%{})
      assert {:ok, loaded} = Json.load(json)
      assert loaded == %{}
    end
  end

  describe "equal?/2" do
    test "equal terms are equal" do
      assert Json.equal?(%{a: 1}, %{a: 1})
      assert Json.equal?([1, 2], [1, 2])
    end

    test "different terms are not equal" do
      refute Json.equal?(%{a: 1}, %{a: 2})
      refute Json.equal?([1, 2], [1, 3])
    end
  end

  describe "embed_as/1" do
    test "returns :dump" do
      assert Json.embed_as(:json) == :dump
    end
  end
end
