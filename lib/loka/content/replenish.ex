defmodule Loka.Content.Replenish do
  @moduledoc """
  Replenish entries (toolbox row 19b, docs/system/cartridge.md Replenish declarations);
  twin of cartridge_replenish.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, ref: 3]
  alias Loka.Content.Refs

  @doc "An entry with its short item and holder references expanded."
  @spec expand(map(), map()) :: map()
  def expand(r, m),
    do:
      r
      |> Map.update!("items", &Enum.map(&1, fn i -> ref(i, "item", m) end))
      |> Map.update!("from", &location(&1, m))
      |> Map.update!("to", &location(&1, m))

  defp location(%{"in" => k} = l, m) when k in ~w(room npc item),
    do: Map.update!(l, k, &ref(&1, k, m))

  defp location(l, _), do: l

  @spec check(map() | nil, map()) :: [map()]
  def check(nil, _), do: []

  def check(m, defs) do
    entries = for {_, {rel, [], r}} <- defs["replenish"] || %{}, do: {rel, r}

    floor =
      if entries != [] and api(m) < [1, 71],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    floor ++ Enum.flat_map(entries, fn {rel, r} -> entry(m, defs, rel, r) end)
  end

  defp entry(m, defs, rel, r) do
    same = if r["from"] == r["to"], do: [diag("SCHEMA_VIOLATION", at(rel, ["from"]))], else: []

    items(m, defs, rel, r["items"]) ++
      holder(m, defs, rel, "from", r) ++ holder(m, defs, rel, "to", r) ++ same
  end

  defp items(m, defs, rel, items) do
    duplicate =
      if length(Enum.uniq(items)) != length(items),
        do: [diag("DUPLICATE_DEFINITION", at(rel, ["items"]))],
        else: []

    duplicate ++
      for {i, n} <- Enum.with_index(items),
          d <- unresolved(m, defs, i, "item", at(rel, ["items", n])),
          do: d
  end

  defp holder(m, defs, rel, end_, r) do
    case r[end_] do
      %{"in" => "template"} -> [diag("SCHEMA_VIOLATION", at(rel, [end_]))]
      %{"in" => k} = l -> unresolved(m, defs, l[k], k, at(rel, [end_, k]))
    end
  end

  defp unresolved(m, defs, target, kind, path) do
    case Refs.resolve(target, kind, m, defs) do
      :unresolved -> [diag("UNRESOLVED_REFERENCE", path, %{"target" => target})]
      _ -> []
    end
  end

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

  @doc "The item refs a replenish entry refills into `room` (a harvest seam's stock may start elsewhere)."
  @spec refilled(map(), map()) :: [map()]
  def refilled(defs, room),
    do:
      for(
        {_, {_, [], r}} <- defs["replenish"] || %{},
        r["to"] == %{"in" => "room", "room" => room},
        i <- r["items"],
        do: i
      )
end
