defmodule Loka.Content.Commerce do
  @moduledoc "Validates finite authored shop identities and explicit conserved funding."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2, ref: 3]
  alias Loka.Content.Refs

  def check(nil, _), do: []

  def check(m, defs) do
    for {_, {rel, [], npc}} <- defs["npc"],
        npc["shop"],
        d <- shop(m, defs, rel, npc) ++ stocks(m, defs, rel, npc["shop"]["offers"]),
        do: d
  end

  @doc "Expands an offer's short item references, its stock set's too (toolbox row W11)."
  def expand_offer(o, m) do
    o = Map.update!(o, "item", &ref(&1, "item", m))

    if o["stock"],
      do: update_in(o, ["stock", "items"], &Enum.map(&1, fn i -> ref(i, "item", m) end)),
      else: o
  end

  defp shop(m, defs, rel, npc) do
    s = npc["shop"]
    path = at(rel, ["shop"])
    resource = Refs.resolve(s["resource"], "resource", m, defs)
    ids = Enum.map(s["offers"], & &1["item"])

    api = api_check(m, path)

    duplicate =
      if length(Enum.uniq(ids)) != length(ids), do: [diag("DUPLICATE_DEFINITION", path)], else: []

    funds = if funded?(resource, npc), do: [], else: [diag("RESOURCE_SPEC_INVALID", path)]

    items =
      for ref <- ids, not stocked?(ref, npc, m, defs), do: diag("UNRESOLVED_REFERENCE", path)

    api ++ duplicate ++ funds ++ items ++ discount(m, defs, npc, s, path)
  end

  # Toolbox row W11: a price per count of a set of distinct items led by the offer's own.
  defp stocks(m, defs, rel, offers) do
    stock_api(m, offers) ++
      for {%{"stock" => %{"items" => items, "buy" => buy}} = o, i} <- Enum.with_index(offers),
          path = at(rel, ["shop", "offers", i, "stock"]),
          d <- unresolved(items, path, m, defs) ++ stock_shape(o, items, buy, path),
          do: d
  end

  defp unresolved(items, path, m, defs) do
    for {ref, i} <- Enum.with_index(items),
        not match?({_, _, _}, Refs.resolve(ref, "item", m, defs)),
        do: diag("UNRESOLVED_REFERENCE", path <> ".items[#{i}]")
  end

  defp stock_shape(o, items, buy, path) do
    shape = [
      {Enum.uniq(items) == items, diag("DUPLICATE_DEFINITION", path <> ".items")},
      {length(buy) == length(items) and hd(items) == o["item"] and hd(buy) == o["buy"],
       diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})}
    ]

    for {false, d} <- shape, do: d
  end

  defp stock_api(m, offers) do
    if Enum.any?(offers, & &1["stock"]) and version(m) < [1, 82],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp discount(m, defs, npc, %{"buy_discount" => d, "offers" => offers}, path) do
    valid =
      condition?(m, defs, npc, d) and
        d["numerator"] <= d["denominator"] and
        prices?(offers, d["minimum"], d["numerator"])

    if valid, do: [], else: [diag("RESOURCE_SPEC_INVALID", path)]
  end

  defp discount(_, _, _, _, _), do: []

  # A skill of this cartridge, or (toolbox row 15) friendly with a friendly disposition (the schema admits exactly one).
  defp condition?(_, _, npc, %{"friendly" => true}),
    do: is_map_key(npc["disposition"] || %{}, "friendly")

  defp condition?(m, defs, _, d),
    do:
      m["requires"]["capabilities"]["skills"] == 1 and
        match?({_, _, _}, Refs.resolve(d["skill"], "skill", m, defs))

  defp prices?(offers, minimum, numerator),
    do:
      offers
      |> Enum.flat_map(&[&1["buy"] | (&1["stock"] || %{})["buy"] || []])
      |> Enum.all?(&(&1 >= minimum and &1 * numerator <= 9_007_199_254_740_991))

  defp api_check(manifest, path),
    do: if(version(manifest) < [1, 16], do: [diag("KERNEL_API_RANGE_INVALID", path)], else: [])

  defp version(manifest),
    do:
      manifest["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

  defp funded?({_, _, resource}, npc) do
    resource["gain"] == 0 and resource["regen"] == nil and
      npc["resource_starts"][resource["key"]] != nil
  end

  defp funded?(_, _), do: false

  defp stocked?(ref, npc, m, defs) do
    case Refs.resolve(ref, "item", m, defs) do
      {_, _, %{"location" => %{"in" => "npc", "npc" => holder}}} ->
        holder == Loka.Content.Source.ref(npc["key"], "npc", m)

      _ ->
        false
    end
  end
end
