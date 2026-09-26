defmodule Loka.Content.Barriers do
  @moduledoc """
  Barriers in a v2 source (room.schema.json BarrierDefinition, Connection.barrier; 21 §5
  Barrier; 05 §25 coherent connections): each barrier's owning capability is required and its
  key_item names an item; each exit's barrier names a barrier, and each exit of its destination
  back to its room names the same one or, like it, none (BARRIER_MISMATCH). Text keys are
  `Loka.Content.Checks.rooms/4`'s.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2, ref: 3]
  import Loka.Content.Refs, only: [owners: 2, owned: 3, reference: 6, resolve: 4]

  @doc "Diagnostics for the schema-valid barriers and rooms of a v2 source with manifest `m`."
  @spec check(map(), map(), [map()]) :: [map()]
  def check(m, defs, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}
    barriers = for {_, {rel, [], b}} <- defs["barrier"], do: barrier(rel, b, m, defs, required)
    Enum.concat(barriers) ++ Enum.flat_map(defs["room"], &exits(&1, m, defs))
  end

  defp exits({_, {rel, [], r}}, m, defs),
    do: Enum.flat_map(r["exits"], fn {dir, e} -> exit(rel, dir, {r, e}, m, defs) end)

  defp exits(_, _, _), do: []

  defp barrier(rel, b, m, defs, required) do
    owned(at(rel, []), "barrier", required) ++
      if b["key_item"], do: reference(rel, [], {"key_item", "item"}, b, m, defs), else: []
  end

  defp exit(rel, dir, {r, exit}, m, defs) do
    named =
      if exit["barrier"],
        do: reference(rel, ["exits", dir], {"barrier", "barrier"}, exit, m, defs),
        else: []

    if Enum.any?(
         back(exit, ref(r["key"], "room", m), m, defs),
         &(&1["barrier"] != exit["barrier"])
       ),
       do: [diag("BARRIER_MISMATCH", at(rel, ["exits", dir])) | named],
       else: named
  end

  # The exits of `exit`'s destination (a room of this cartridge) that lead back to `here`.
  defp back(exit, here, m, defs) do
    case resolve(exit["to"], "room", m, defs) do
      {_, _, there} -> for {_, b} <- there["exits"], b["to"] == here, do: b
      _ -> []
    end
  end
end
