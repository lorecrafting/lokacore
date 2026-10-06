defmodule Loka.Core.Liquid do
  @moduledoc "Portable liquid whole-row mutation guard."
  @spec compose(map(), term(), map()) :: {:ok, map()} | {:error, String.t()}
  def compose(op, row, state) do
    spec = get_in(state, ["liquid_specs", op["item_id"]])

    if row == op["from"] and valid?(row, spec) and valid?(op["to"], spec),
      do: {:ok, op["to"]},
      else: {:error, "precondition_failed"}
  end

  defp valid?(%{"kind" => kind, "quantity" => quantity} = row, %{
         "capacity" => cap,
         "kinds" => kinds
       }) do
    is_integer(cap) and cap > 0 and cap <= 2_147_483_647 and is_list(kinds) and
      map_size(row) == 2 and is_integer(quantity) and quantity >= 0 and
      quantity <= 9_007_199_254_740_991 and quantity <= cap and
      if(quantity == 0,
        do: kind == nil,
        else: Loka.Core.Contracts.validate("DefinitionRef", kind) == :ok and kind in kinds
      )
  end

  defp valid?(_, _), do: false
end
