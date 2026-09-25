defmodule Loka.Core.Contracts.SchemaTest do
  # Loka.Core.Contracts.Schema.flatten!/1 rejects every schema outside the closed subset.
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts.Schema

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

    map =
      &%{
        "A" => Map.merge(%{"type" => "object", "additionalProperties" => %{"type" => "null"}}, &1)
      }

    closed = &object.(Map.put(&1, "additionalProperties", false))
    any_of = &%{"A" => %{"anyOf" => &1}}
    str = %{"type" => "string"}
    int = %{"type" => "integer"}

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
             one_of.([tagged.("a"), obj.(%{"k" => %{"const" => "b"}}, ["k"])])},
            {"a map with properties", map.(%{"properties" => %{}})},
            {"a map with required", map.(%{"required" => []})},
            {"a map with open values", map.(%{"additionalProperties" => true})},
            {"a map without a value schema", %{"A" => %{"type" => "object"}}},
            {"a bad map value schema",
             map.(%{"additionalProperties" => %{"type" => "null", "format" => "x"}})},
            {"propertyNames on a closed object",
             closed.(%{"propertyNames" => %{"pattern" => "^a$"}})},
            {"maxProperties on a closed object", closed.(%{"maxProperties" => 1})},
            {"propertyNames without a pattern", map.(%{"propertyNames" => %{}})},
            {"propertyNames with another keyword",
             map.(%{"propertyNames" => %{"pattern" => "^a$", "maxLength" => 1}})},
            {"a non-portable key pattern", map.(%{"propertyNames" => %{"pattern" => "^\\w$"}})},
            {"a negative maxProperties", map.(%{"maxProperties" => -1})},
            {"anyOf with overlapping types",
             any_of.([str, %{"type" => "string", "minLength" => 1}])},
            {"anyOf overlapping through a $ref",
             Map.put(any_of.([%{"$ref" => "#/$defs/B"}, str]), "B", str)},
            {"anyOf with an object branch", any_of.([str, obj.(%{}, [])])},
            {"anyOf with an array branch", any_of.([str, %{"type" => "array", "items" => str}])},
            {"anyOf with a null branch", any_of.([str, %{"type" => "null"}])},
            {"anyOf with an enum branch", any_of.([int, %{"enum" => ["a"]}])},
            {"a nested anyOf", any_of.([any_of.([str, int])["A"], %{"type" => "boolean"}])},
            {"anyOf with one branch", any_of.([str])},
            {"anyOf mixed with type", %{"A" => %{"anyOf" => [str, int], "type" => "string"}}},
            {"anyOf mixed with enum", %{"A" => %{"anyOf" => [str, int], "enum" => ["a"]}}},
            {"anyOf through a $ref cycle",
             %{
               "A" => %{"anyOf" => [%{"$ref" => "#/$defs/B"}, int]},
               "B" => %{"$ref" => "#/$defs/C"},
               "C" => %{"$ref" => "#/$defs/B"}
             }}
          ] ++
            for(
              p <-
                ~W"^a.b$ ^\s$ ^\w$ ^\d$ ^\bx$ ^\p{L}$ ^[a-z]+\_x$ ^\@$ ^(?i)a$ ^(?:a)$ \Aa$ ^a\z abc ^a ^a$b$ ^a{$ ^[\s]$ ^é$ ^a\-b$ ^a*+$ ^a++$ ^a?+$ ^a{2}+$ ^(?=a)+a$ ^(?=a)?a$ ^(?=a){2}a$",
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
