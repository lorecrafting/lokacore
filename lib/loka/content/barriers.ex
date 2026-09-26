defmodule Loka.Content.Barriers do
  @moduledoc """
  Barriers in a v2 source (room.schema.json BarrierDefinition, Connection.barrier; 21 §5
  Barrier; 05 §17, §25), twin of `kernel/ts/src/cartridge_barriers.ts`: each barrier's owning
  capability is required and its key_item names an item; each exit's barrier names a barrier,
  and an exit with a barrier and its reciprocal face (the destination's exit in the opposite
  direction, when that leads back) name the same one (BARRIER_MISMATCH); no locked barrier's key
  is out of reach (BARRIER_UNREACHABLE_KEY). Text keys are `Loka.Content.Checks.rooms/4`'s.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2, ref: 3]
  import Loka.Content.Refs, only: [owners: 2, owned: 3, reference: 6, resolve: 4]

  @opposite %{
    "north" => "south",
    "south" => "north",
    "east" => "west",
    "west" => "east",
    "up" => "down",
    "down" => "up"
  }

  @doc "Diagnostics for the schema-valid barriers and rooms of a v2 source with manifest `m`."
  @spec check(map(), map() | nil, map(), [map()]) :: [map()]
  def check(m, entry, defs, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}
    barriers = for {_, {rel, [], b}} <- defs["barrier"], do: barrier(rel, b, m, defs, required)

    Enum.concat(barriers) ++
      Enum.flat_map(defs["room"], &exits(&1, m, defs)) ++ lockout(entry, m, defs)
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

    face = face(exit, @opposite[dir], ref(r["key"], "room", m), {m, defs})

    if (exit["barrier"] || face["barrier"]) && (face == nil or face["barrier"] != exit["barrier"]),
      do: [diag("BARRIER_MISMATCH", at(rel, ["exits", dir])) | named],
      else: named
  end

  # The destination's exit in direction `back` if it leads to `here`.
  defp face(exit, back, here, {m, defs}) do
    with {_, _, there} <- resolve(exit["to"], "room", m, defs),
         %{"to" => ^here} = face <- there["exits"][back],
         do: face,
         else: (_ -> nil)
  end

  # ponytail: initial states and item locations only, no recipes, facts or NPCs; 05 §17
  # reachability and the Lab's state-space search replace it. Rooms are reached from the entry
  # through exits without a barrier or whose barrier starts open, closed, or locked with a key
  # in reach; an item is in reach when it starts in a reached room or inside an item in reach.
  defp lockout(entry, m, defs) do
    start = if match?({_, _, _}, resolve(entry, "room", m, defs)), do: [entry], else: []
    {rooms, keys} = reach({MapSet.new(start), MapSet.new()}, m, defs)

    for r <- rooms,
        {_, e} <- exits_of(r, m, defs),
        {rel, _, b} <- [resolve(e["barrier"], "barrier", m, defs)],
        known?(b, m, defs) and not passable?(b, keys),
        uniq: true,
        do: diag("BARRIER_UNREACHABLE_KEY", at(rel, []))
  end

  defp reach({rooms, keys} = reached, m, defs) do
    keys =
      for {k, {_, [], i}} <- defs["item"],
          starts_in?(i, rooms, keys),
          into: keys,
          do: ref(k, "item", m)

    rooms =
      for r <- rooms,
          {_, e} <- exits_of(r, m, defs),
          match?({_, _, _}, resolve(e["to"], "room", m, defs)),
          passable?(barrier_of(e, m, defs), keys),
          into: rooms,
          do: e["to"]

    if {rooms, keys} == reached, do: reached, else: reach({rooms, keys}, m, defs)
  end

  defp starts_in?(%{"location" => %{"in" => "room", "room" => r}}, rooms, _), do: r in rooms
  defp starts_in?(%{"location" => %{"in" => "item", "item" => i}}, _, keys), do: i in keys
  defp starts_in?(_, _, _), do: false

  # A reached room's exits (reached rooms resolve).
  defp exits_of(r, m, defs), do: elem(resolve(r, "room", m, defs), 2)["exits"]

  defp barrier_of(e, m, defs) do
    case resolve(e["barrier"], "barrier", m, defs) do
      {_, _, b} -> b
      _ -> nil
    end
  end

  defp passable?(b, keys), do: b["initial"] != "locked" or b["key_item"] in keys

  defp known?(b, m, defs),
    do: b["key_item"] == nil or match?({_, _, _}, resolve(b["key_item"], "item", m, defs))
end
