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
