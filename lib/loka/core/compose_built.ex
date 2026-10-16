defmodule Loka.Core.ComposeBuilt do
  @moduledoc "One built room's tombstone row (Built rooms S5); twin of compose_built.ts."

  # entity is the room's created row as composition reads it (an earlier entity.create counts).
  def set(op, row, entity) do
    if row == op["expected"] and get_in(entity || %{}, ["origin", "kind"]) == "built",
      do: {:ok, op["value"]},
      else: {:error, "precondition_failed"}
  end
end
