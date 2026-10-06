defmodule Loka.Core.LiquidContractsTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts
  @fixture JSON.decode!(File.read!("protocol/fixtures/liquid_contracts.json"))

  # Breaks: liquid wire contracts lose required fields, numeric bounds, closed shapes or discriminators.
  test "liquid wire boundaries match literal errors and valid controls" do
    for c <- @fixture["cases"] do
      base = @fixture["bases"][c["base"]]

      value =
        if Map.has_key?(c, "replace"),
          do: c["replace"],
          else: Map.merge(base["value"], c["set"] || %{})

      value = if c["omit"], do: Map.delete(value, c["omit"]), else: value
      assert Contracts.validate(base["contract"], value) == expected(c["errors"]), c["name"]

      if variant = base["variant"] do
        schema =
          Enum.find(
            Contracts.defs()[base["contract"]]["oneOf"],
            &(&1["properties"][variant["field"]]["const"] == variant["value"])
          )

        assert schema, c["name"]
        defs = Map.put(Contracts.defs(), "LiquidVariant", schema)

        assert Contracts.validate("LiquidVariant", value, defs) ==
                 expected(c["variant_errors"] || c["errors"]),
               c["name"]
      end
    end
  end

  defp expected([]), do: :ok

  defp expected(errors),
    do: {:error, Enum.map(errors, &%{path: &1["path"], code: String.to_atom(&1["code"])})}
end
