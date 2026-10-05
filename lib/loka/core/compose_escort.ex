defmodule Loka.Core.ComposeEscort do
  @moduledoc "Portable escort transition preconditions over composition's current row."
  @edges %{
    nil => ["following"],
    "following" => ~w(separated completed),
    "separated" => ["following"]
  }

  @spec transition(map(), map() | nil) :: {:ok, map()} | {:error, String.t()}
  def transition(op, row) do
    value = op["value"]

    identity =
      row == nil or (is_map(row) and Map.delete(row, "status") == Map.delete(value, "status"))

    if row == op["expected"] and value["actor_id"] == op["actor_id"] and identity and
         value["status"] in Map.get(@edges, row && row["status"], []),
       do: {:ok, value},
       else: {:error, "precondition_failed"}
  end
end
