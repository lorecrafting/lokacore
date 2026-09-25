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
  @effects JSON.decode!(File.read!("protocol/effect_registry.json"))
  @invariants JSON.decode!(File.read!("protocol/invariants.json"))

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

  # The 14 §R3B list, one kind per named type; ActionRecipe/ComposedAction is one (21 §7).
  @r3b ~w(action_recipe inspectable_detail description_variant connection barrier reaction_rule
          consequence_operator narration_spec scene_definition scene_instance scene_space
          instance_plan spawn_bundle population_plan commerce_composition service capacity
          service_job world_event_plan)

  test "the feature registry lists every 14 §R3B kind once, each entry valid" do
    features = JSON.decode!(File.read!("protocol/feature_registry.json"))

    for entry <- features,
        do: assert(Contracts.validate("FeatureRegistryEntry", entry) == :ok, inspect(entry))

    kinds = for e <- features, do: e["kind"]
    assert Enum.sort(kinds) == Enum.sort(@r3b)
    assert Enum.sort(Contracts.defs()["FeatureKind"]["enum"]) == Enum.sort(@r3b)
  end

  test "every code the fixtures expect is a registered abi_validation code" do
    registered = for %{"code" => c, "category" => "abi_validation"} <- @registry, do: c
    for %{"errors" => es} <- @invalid, %{"code" => c} <- es, do: assert(c in registered, c)
  end

  test "the effect registry classifies exactly the EffectPayload types, each entry valid" do
    for entry <- @effects,
        do: assert(Contracts.validate("EffectRegistryEntry", entry) == :ok, inspect(entry))

    types =
      for b <- Contracts.defs()["EffectPayload"]["oneOf"], do: b["properties"]["type"]["const"]

    assert Enum.sort(for e <- @effects, do: e["type"]) == Enum.sort(types)
  end

  # Invariants are checked by id (docs/ROADMAP.md), so an id must name one invariant, and a
  # citation must point at a real docs/spec heading.
  defp invariant_problems(entries) do
    dupes = for {id, n} <- Enum.frequencies_by(entries, & &1["id"]), n > 1, do: {:duplicate, id}

    dupes ++
      for e <- entries,
          problem <- [entry_problem(e)],
          problem != nil,
          do: {problem, e["id"]}
  end

  defp entry_problem(e) do
    with :ok <- Contracts.validate("InvariantEntry", e),
         {:ok, text} <- File.read(Path.join("docs/spec", e["citation"]["document"])) do
      if e["citation"]["heading"] in String.split(text, "\n"), do: nil, else: :no_heading
    else
      {:error, :enoent} -> :no_document
      {:error, _} -> :invalid
    end
  end

  test "the invariant registry has unique ids and real citations" do
    assert invariant_problems(@invariants) == []
  end

  test "the invariant check catches a duplicate id and bad or missing citations" do
    [a, b | _] = @invariants
    cite = &put_in(b, ["citation", &1], &2)

    planted = [
      a,
      %{b | "id" => a["id"]},
      Map.delete(b, "citation") |> Map.put("id", "no_citation"),
      cite.("document", "99-missing.md") |> Map.put("id", "no_document"),
      cite.("heading", String.slice(b["citation"]["heading"], 0..8))
      |> Map.put("id", "no_heading")
    ]

    assert Enum.sort(invariant_problems(planted)) ==
             Enum.sort([
               {:duplicate, a["id"]},
               {:invalid, "no_citation"},
               {:no_document, "no_document"},
               {:no_heading, "no_heading"}
             ])
  end

  # validate/3 takes decoded values, so recursion is bounded by the canonical depth cap: a
  # Policy nested 128 deep decodes and validates; 129 is rejected by the decoder.
  test "a recursive Policy at the depth cap" do
    nots =
      &(String.duplicate(~s({"op":"not","item":), &1) <>
          ~s({"op":"target_present"}) <> String.duplicate("}", &1))

    assert {:ok, deep} = Loka.Core.Canonical.decode(nots.(127))
    assert Contracts.validate("Policy", deep) == :ok
    assert Loka.Core.Canonical.decode(nots.(128)) == {:error, :invalid_json}
  end

  # A 1025-id list is too large to keep as a fixture line; 1024 is the contract's maximum.
  test "ambiguous candidates at 1024 and 1025" do
    ids =
      &for(
        i <- 1..&1,
        do: :io_lib.format("~8.16.0b-0000-4000-8000-000000000000", [i]) |> to_string()
      )

    assert Contracts.validate("TargetResolution", %{
             "kind" => "ambiguous",
             "candidate_ids" => ids.(1024)
           }) == :ok

    assert Contracts.validate("TargetResolution", %{
             "kind" => "ambiguous",
             "candidate_ids" => ids.(1025)
           }) ==
             {:error, [%{path: "/candidate_ids", code: :too_many_items}]}
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
