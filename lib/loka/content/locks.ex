defmodule Loka.Content.Locks do
  @moduledoc """
  Toolbox row G7 (access locks): a `put` lock only a container item may carry (SCHEMA_VIOLATION invalid_value at its locks.put).
  The lock roots join the conditions in
  Loka.Content.RoomParts.conditions/1 and Loka.Content.Entities.conditions/1.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _), do: []

  def check(_, defs) do
    for {_, {rel, [], %{"locks" => %{"put" => _}} = i}} <- defs["item"] || %{},
        i["container"] != true,
        do: diag("SCHEMA_VIOLATION", at(rel, ["locks", "put"]), %{"error" => "invalid_value"})
  end
end
