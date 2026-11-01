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

    if row == op["expected"] and value["actor_id"] == op["actor_id"] and legal?(row, value),
      do: {:ok, value},
      else: {:error, "precondition_failed"}
  end

  defp legal?(row, value) do
    identity =
      row == nil or (is_map(row) and Map.delete(row, "status") == Map.delete(value, "status"))

    # The one identity change: a new quest instance's start replaces an ended row (escort@1).
    restart =
      is_map(row) and row["status"] != "following" and value["status"] == "following" and
        row["quest_instance_id"] != value["quest_instance_id"]

    restart or (identity and value["status"] in Map.get(@edges, row && row["status"], []))
  end
end
