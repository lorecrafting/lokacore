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

  defp valid?(%{"kind" => kind, "quantity" => quantity} = row, %{
         "capacity" => capacity,
         "kinds" => kinds
       }) do
    map_size(row) == 2 and capacity?(capacity) and quantity?(quantity, capacity) and
      is_list(kinds) and kind?(kind, quantity, kinds)
  end

  defp valid?(_, _), do: false

  defp capacity?(capacity),
    do: is_integer(capacity) and capacity > 0 and capacity <= 2_147_483_647

  defp quantity?(quantity, capacity),
    do: is_integer(quantity) and quantity >= 0 and quantity <= capacity

  defp kind?(nil, 0, _), do: true

  defp kind?(kind, quantity, kinds) when quantity > 0,
    do: Loka.Core.Contracts.validate("DefinitionRef", kind) == :ok and kind in kinds

  defp kind?(_, _, _), do: false
end
