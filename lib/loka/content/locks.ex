defmodule Loka.Content.Locks do
  @moduledoc """
  Toolbox row G7 (access locks): any `locks` on a room, exit or item needs kernel_api 1.78, and a
  `put` lock only a container item may carry (SCHEMA_VIOLATION invalid_value at its locks.put).
  Twin of kernel/ts/src/content/cartridge_locks.ts; the lock roots join the conditions in
  Loka.Content.RoomParts.conditions/1 and Loka.Content.Entities.conditions/1.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, _) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    floor =
      if locked?(defs) and api < [1, 78],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
        else: []

    floor ++
      for {_, {rel, [], %{"locks" => %{"put" => _}} = i}} <- defs["item"] || %{},
          i["container"] != true,
          do: diag("SCHEMA_VIOLATION", at(rel, ["locks", "put"]), %{"error" => "invalid_value"})
  end

  defp locked?(defs) do
    Enum.any?(defs["item"] || %{}, &match?({_, {_, _, %{"locks" => _}}}, &1)) or
      Enum.any?(defs["room"] || %{}, fn {_, {_, _, r}} ->
        is_map_key(r, "locks") or
          Enum.any?(Map.get(r, "exits", %{}), &match?({_, %{"locks" => _}}, &1))
      end)
  end
end
