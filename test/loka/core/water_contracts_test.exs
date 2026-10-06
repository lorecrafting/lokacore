defmodule Loka.Core.WaterContractsTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts
  @fixture JSON.decode!(File.read!("protocol/fixtures/water_contracts.json"))

  # Breaks: Elixir accepts missing actor/body/deadline fields, unsafe integers or malformed corpse selection that the typed wire refuses.
  test "water wire boundaries match literal valid and invalid inputs" do
    for c <- @fixture["cases"] do
      base = @fixture["bases"][c["base"]]
      value = if c["path"], do: changed(base["value"], c["path"], c), else: base["value"]
      assert Contracts.validate(base["contract"], value) == :ok == c["valid"], c["name"]
    end
  end

  defp changed(value, [field], c),
    do: if(c["omit"], do: Map.delete(value, field), else: Map.put(value, field, c["value"]))

  defp changed(value, [index | rest], c) when is_integer(index),
    do: List.update_at(value, index, &changed(&1, rest, c))

  defp changed(value, [field | rest], c),
    do: Map.update!(value, field, &changed(&1, rest, c))
end
