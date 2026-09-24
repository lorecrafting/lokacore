defmodule Loka.Core.ContractsTest do
  # Expected errors are hand-written in protocol/fixtures/invalid.json; fixtures are decoded
  # with the stdlib JSON so they never pass through the code under test.
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts
  alias Loka.Core.Contracts.Schema

  @probe Schema.flatten!(%{
           "subset.schema.json" =>
             JSON.decode!(File.read!("protocol/fixtures/subset.schema.json"))
         })
  @defs Map.merge(Contracts.defs(), @probe)
  @invalid JSON.decode!(File.read!("protocol/fixtures/invalid.json"))
  @registry JSON.decode!(File.read!("protocol/error_registry.json"))

  test "every contract has examples and every example validates" do
    for {name, schema} <- @defs do
      assert [_ | _] = schema["examples"], "#{name} has no examples"

      for example <- schema["examples"],
          do: assert(Contracts.validate(name, example, @defs) == :ok, name)
    end
  end

  test "invalid fixtures fail with exactly the listed errors" do
    for %{"contract" => c, "value" => v, "errors" => expected} <- @invalid do
      expected = Enum.map(expected, &%{path: &1["path"], code: String.to_atom(&1["code"])})
      assert Contracts.validate(c, v, @defs) == {:error, expected}, "#{c} #{inspect(v)}"
    end
  end

  test "the registry lists exactly the ErrorCode codes, each entry valid" do
    for entry <- @registry,
        do: assert(Contracts.validate("ErrorRegistryEntry", entry) == :ok, inspect(entry))

    assert Enum.sort(for e <- @registry, do: e["code"]) ==
             Enum.sort(Contracts.defs()["ErrorCode"]["enum"])
  end

  test "every code the fixtures expect is a registered abi_validation code" do
    registered = for %{"code" => c, "category" => "abi_validation"} <- @registry, do: c
    for %{"errors" => es} <- @invalid, %{"code" => c} <- es, do: assert(c in registered, c)
  end

  test "a declared __proto__ property is accepted" do
    assert Contracts.validate("SubsetProbe", JSON.decode!(~s({"__proto__":"ok"})), @defs) == :ok
  end

  test "values outside the canonical profile are rejected at decode, before validation" do
    for text <- [~s({"n":1.0}), ~s({"n":1e0}), ~s({"n":1,"n":1})],
        do: assert(Loka.Core.Canonical.decode(text) == {:error, :invalid_json}, text)
  end

  describe "the schema subset fails closed" do
    obj =
      &%{
        "type" => "object",
        "properties" => &1,
        "required" => &2,
        "additionalProperties" => false
      }

    tagged = &obj.(%{"kind" => %{"const" => &1}}, ["kind"])
    one_of = &%{"A" => %{"oneOf" => &1}}
    object = &%{"A" => Map.merge(%{"type" => "object", "properties" => %{}}, &1)}

    for {name, defs} <-
          [
            {"an unsupported keyword", %{"A" => %{"type" => "string", "format" => "uuid"}}},
            {"a keyword of another type", %{"A" => %{"type" => "string", "minimum" => 1}}},
            {"an unsupported type", %{"A" => %{"type" => "number"}}},
            {"open additionalProperties", object.(%{"additionalProperties" => true})},
            {"missing additionalProperties", object.(%{})},
            {"required but not declared",
             object.(%{"additionalProperties" => false, "required" => ["x"]})},
            {"a nested bad keyword",
             %{"A" => %{"type" => "array", "items" => %{"type" => "null", "format" => "x"}}}},
            {"a dangling $ref", %{"A" => %{"$ref" => "#/$defs/B"}}},
            {"a $ref into a missing file", %{"A" => %{"$ref" => "other.schema.json#/$defs/A"}}},
            {"no type and no $ref/enum/const/oneOf", %{"A" => %{"description" => "x"}}},
            {"a non-scalar enum value", %{"A" => %{"enum" => [[1]]}}},
            {"a pattern that does not compile",
             %{"A" => %{"type" => "string", "pattern" => "^($"}}},
            {"nested $defs", %{"A" => %{"type" => "null", "$defs" => %{}}}},
            {"oneOf branches with the same tag", one_of.([tagged.("a"), tagged.("a")])},
            {"a oneOf branch without a tag", one_of.([tagged.("a"), obj.(%{}, [])])},
            {"an optional tag",
             one_of.([tagged.("a"), obj.(%{"kind" => %{"const" => "b"}}, [])])},
            {"different discriminators",
             one_of.([tagged.("a"), obj.(%{"k" => %{"const" => "b"}}, ["k"])])}
          ] ++
            for(
              p <-
                ~W"^a.b$ ^\s$ ^\w$ ^\d$ ^\bx$ ^\p{L}$ ^[a-z]+\_x$ ^\@$ ^(?i)a$ ^(?:a)$ \Aa$ ^a\z abc ^a ^a$b$ ^a{$ ^[\s]$ ^é$",
              do:
                {"the non-portable pattern #{p}", %{"A" => %{"type" => "string", "pattern" => p}}}
            ) do
      @case_defs defs
      test "rejects #{name}" do
        assert_raise ArgumentError, ~r"outside the schema subset", fn ->
          Schema.flatten!(%{"t.schema.json" => %{"$defs" => @case_defs}})
        end
      end
    end

    test "rejects one name defined in two files" do
      doc = %{"$defs" => %{"A" => %{"type" => "null"}}}

      assert_raise ArgumentError, ~r"outside the schema subset", fn ->
        Schema.flatten!(%{"a.schema.json" => doc, "b.schema.json" => doc})
      end
    end
  end
end
