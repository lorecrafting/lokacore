defmodule Loka.Core.ServiceContractsTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts
  @fixture JSON.decode!(File.read!("protocol/fixtures/service_contracts.json"))
  # Breaks: wire admission loses required participants, bounded payment or the closed immediate consequence alternatives.
  test "service boundaries follow independent valid and invalid controls" do
    for c <- @fixture["cases"] do
      b = @fixture["bases"][c["base"]]

      value =
        if b["value_fixture"],
          do: JSON.decode!(File.read!(b["value_fixture"]))["value"],
          else: b["value"]

      v = if c["path"], do: changed(value, c["path"], c), else: value
      assert Contracts.validate(b["contract"], v) == :ok == c["valid"], c["name"]

      if variant = b["variant"] do
        schema =
          Enum.find(
            Contracts.defs()[b["contract"]]["oneOf"],
            &(&1["properties"][variant["field"]]["const"] == variant["value"])
          )

        assert Contracts.validate(
                 "ServiceVariant",
                 v,
                 Map.put(Contracts.defs(), "ServiceVariant", schema)
               ) == :ok == c["valid"],
               c["name"]
      end
    end
  end

  defp changed(v, [field], %{"omit" => true}), do: Map.delete(v, field)
  defp changed(v, [field], c) when is_integer(field), do: List.replace_at(v, field, c["value"])
  defp changed(v, [field], c), do: Map.put(v, field, c["value"])

  defp changed(v, [field | rest], c) when is_integer(field),
    do: List.update_at(v, field, &changed(&1, rest, c))

  defp changed(v, [field | rest], c), do: Map.update!(v, field, &changed(&1, rest, c))
end
