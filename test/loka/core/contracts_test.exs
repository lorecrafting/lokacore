defmodule Loka.Core.ContractsTest do
  # Expected errors are hand-written in protocol/fixtures/invalid.json; fixtures are decoded
  # with the stdlib JSON so they never pass through the code under test. Registries:
  # registries_test.exs; the schema subset: contracts/schema_test.exs; nominal ids:
  # nominal_ids_test.exs.
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts
  alias Loka.Core.Contracts.Schema

  @probe Schema.flatten!(%{
           "subset.schema.json" =>
             JSON.decode!(File.read!("protocol/fixtures/subset.schema.json"))
         })
  @defs Map.merge(Contracts.defs(), @probe)
  @invalid JSON.decode!(File.read!("protocol/fixtures/invalid.json"))

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

  # 64 narration lines (an admission limit, decision.schema.json) is the maximum; 65 is not.
  test "narration at 64 and 65 lines" do
    lines = &List.duplicate(%{"key" => "n"}, &1)

    accepted =
      Enum.find(Contracts.defs()["DecisionResult"]["examples"], &(&1["kind"] == "accepted"))

    record = &%{"command_id" => "e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b", "lines" => lines.(&1)}

    assert Contracts.validate("DecisionResult", Map.put(accepted, "narration", lines.(64))) == :ok
    assert Contracts.validate("NarrationRecord", record.(64)) == :ok

    assert Contracts.validate("DecisionResult", Map.put(accepted, "narration", lines.(65))) ==
             {:error, [%{path: "/narration", code: :too_many_items}]}

    assert Contracts.validate("NarrationRecord", record.(65)) ==
             {:error, [%{path: "/lines", code: :too_many_items}]}
  end

  test "FactSpec scopes are exactly the StateScope kinds" do
    kinds = for b <- Contracts.defs()["StateScope"]["oneOf"], do: b["properties"]["kind"]["const"]
    scopes = Contracts.defs()["FactSpec"]["properties"]["scopes"]["items"]["enum"]
    assert Enum.sort(scopes) == Enum.sort(kinds)
  end

  test "a declared __proto__ property is accepted" do
    assert Contracts.validate("SubsetProbe", JSON.decode!(~s({"__proto__":"ok"})), @defs) == :ok
  end

  test "values outside the canonical profile are rejected at decode, before validation" do
    for text <- [~s({"n":1.0}), ~s({"n":1e0}), ~s({"n":1,"n":1})],
        do: assert(Loka.Core.Canonical.decode(text) == {:error, :invalid_json}, text)
  end
end
