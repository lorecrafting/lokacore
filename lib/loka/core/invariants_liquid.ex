defmodule Loka.Core.InvariantsLiquid do
  @moduledoc "Independent liquid row validation and ordered precondition replay."
  @spec rows_valid?(map(), map()) :: boolean()
  def rows_valid?(_, %{"fault" => _}), do: true

  def rows_valid?(state, %{"changes" => changes}) do
    specs = Map.get(state, "liquid_specs", %{})
    rows = Map.get(state, "liquids", %{})

    Enum.all?(specs, fn {id, _} -> Map.has_key?(rows, id) end) and
      Enum.all?(rows, fn {id, row} -> valid?(row, specs[id]) end) and
      Enum.all?(changes, fn
        %{"target" => %{"kind" => "liquid", "item_id" => id}, "value" => row} ->
          valid?(row, specs[id])

        _ ->
          true
      end)
  end

  @spec holds?(map(), [map()], map()) :: boolean()
  def holds?(state, ops, result) do
    case Enum.reduce_while(ops, %{}, &replay(&1, &2, state)) do
      false ->
        false

      written ->
        Enum.all?(written, fn {id, value} ->
          Enum.any?(
            result["changes"],
            &(&1["target"] == %{"kind" => "liquid", "item_id" => id} and
                &1["value"] == value)
          )
        end)
    end
  end

  defp replay(%{"op" => "liquid.set"} = op, written, state) do
    before =
      Map.get_lazy(written, op["item_id"], fn -> get_in(state, ["liquids", op["item_id"]]) end)

    spec = get_in(state, ["liquid_specs", op["item_id"]])

    if before == op["from"] and valid?(before, spec) and valid?(op["to"], spec),
      do: {:cont, Map.put(written, op["item_id"], op["to"])},
      else: {:halt, false}
  end

  defp replay(_, written, _), do: {:cont, written}

  defp valid?(row, spec) when is_map(row) and is_map(spec) do
    q = row["quantity"]

    is_integer(spec["capacity"]) and spec["capacity"] > 0 and
      spec["capacity"] <= 2_147_483_647 and is_list(spec["kinds"]) and
      Map.keys(row) |> Enum.sort() == ~w(kind quantity) and is_integer(q) and
      q >= 0 and q <= 9_007_199_254_740_991 and q <= spec["capacity"] and
      if(q == 0,
        do: row["kind"] == nil,
        else:
          Loka.Core.Contracts.validate("DefinitionRef", row["kind"]) == :ok and
            row["kind"] in spec["kinds"]
      )
  end

  defp valid?(_, _), do: false
end
