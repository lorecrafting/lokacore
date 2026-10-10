defmodule Loka.Core.ComposeLevelling do
  @moduledoc "One character's levelling row (toolbox row 4); the TypeScript story rule owns its writers."

  def set(op, row) do
    prior = row || %{"experience" => 0, "allocated" => %{}}
    next = op["value"]

    kept =
      Enum.all?(prior["allocated"], fn {a, n} -> Map.get(next["allocated"], a, 0) >= n end)

    if row == op["expected"] and next["experience"] >= prior["experience"] and kept,
      do: {:ok, next},
      else: {:error, "precondition_failed"}
  end
end
