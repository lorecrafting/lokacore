defmodule Loka.Content.Replenish do
  @moduledoc """
  Replenish entries and recipe crafts (toolbox row 19b, Homestead hs-10; docs/system/cartridge.md
  Replenish and Craft declarations);
  twin of cartridge_replenish.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, ref: 3]
  alias Loka.Content.Refs

  @doc "An entry (or a craft consume or yield) with its short item and holder references expanded."
  @spec expand(map(), map()) :: map()
  def expand(r, m),
    do:
      Map.new(r, fn
        {"items", is} -> {"items", Enum.map(is, &ref(&1, "item", m))}
        {e, l} when e in ~w(from to) -> {e, location(l, m)}
        kv -> kv
      end)

  @doc "A recipe with its craft consume expanded (Checks.expand covers yield's items and from)."
  @spec consume(term(), map()) :: term()
  def consume(%{"craft" => %{"consume" => c}} = r, m),
    do: put_in(r, ["craft", "consume"], expand(c, m))

  def consume(definition, _), do: definition

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
    stock(m, defs, rel, [], r, ~w(from to)) ++ same
  end

  @doc """
  Homestead hs-10 (docs/system/cartridge.md Craft declarations): a craft recipe needs kernel_api
  1.101 (one diagnostic), sits on no spell or storylet, its consume and yield follow replenish's
  item and holder rules, and consume's reason has a catalog entry (unless `text` is `:unknown`).
  """
  @spec craft(map(), map(), map() | :unknown) :: [map()]
  def craft(m, defs, text) do
    crafts = for {_, {rel, [], %{"craft" => c} = r}} <- defs["recipe"], do: {rel, r, c}

    floor =
      if crafts != [] and api(m) < [1, 101],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    floor ++
      for {rel, r, c} <- crafts,
          d <- misplaced(rel, r) ++ parts(m, defs, rel, c) ++ reason(rel, c, text),
          do: d
  end

  # A spell or storylet has no station whose stock it could use.
  defp misplaced(rel, r),
    do:
      if(r["target"]["kind"] in ~w(spell storylet),
        do: [diag("SCHEMA_VIOLATION", at(rel, ["craft"]), %{"error" => "invalid_value"})],
        else: []
      )

  defp parts(m, defs, rel, c),
    do:
      for(
        {part, end_} <- [{"consume", "to"}, {"yield", "from"}],
        is_map_key(c, part),
        d <- stock(m, defs, rel, ["craft", part], c[part], [end_]),
        do: d
      )

  defp reason(rel, %{"consume" => %{"reason" => k}}, text) when is_map(text),
    do:
      if(is_map_key(text, k),
        do: [],
        else: [diag("UNRESOLVED_REFERENCE", at(rel, ~w(craft consume reason)), %{"target" => k})]
      )

  defp reason(_, _, _), do: []

  # Replenish's rules, shared with craft: no duplicate item, each item and holder resolves, and
  # each holder (`ends`, by field) is placed.
  defp stock(m, defs, rel, steps, r, ends),
    do:
      items(m, defs, rel, steps, r["items"]) ++
        Enum.flat_map(ends, &holder(m, defs, rel, steps, &1, r))

  defp items(m, defs, rel, steps, items) do
    duplicate =
      if length(Enum.uniq(items)) != length(items),
        do: [diag("DUPLICATE_DEFINITION", at(rel, steps ++ ["items"]))],
        else: []

    duplicate ++
      for {i, n} <- Enum.with_index(items),
          d <- unresolved(m, defs, i, "item", at(rel, steps ++ ["items", n])),
          do: d
  end

  defp holder(m, defs, rel, steps, end_, r) do
    %{"in" => k} = l = r[end_]

    case k != "template" and Refs.resolve(l[k], k, m, defs) do
      :unresolved ->
        [diag("UNRESOLVED_REFERENCE", at(rel, steps ++ [end_, k]), %{"target" => l[k]})]

      {_, _, d} ->
        nests = end_ == "to" and nests?(m, defs, r["items"])

        if placed?(d, k, nests),
          do: [],
          else: [diag("SCHEMA_VIOLATION", at(rel, steps ++ [end_]))]

      false ->
        [diag("SCHEMA_VIOLATION", at(rel, steps ++ [end_]))]

      _ ->
        []
    end
  end

  # A holder needs a placed entity, and an item holder must be a container: a spawn template has
  # none (nor a template item), a non-container takes nothing. An item target also refuses any
  # listed container: it may be or hold the target, and the move would put it inside itself.
  defp placed?(d, k, nests),
    do:
      d["spawn_template"] != true and d["location"]["in"] != "template" and
        (k != "item" or (d["container"] == true and not nests))

  defp nests?(m, defs, items),
    do:
      Enum.any?(items, &match?({_, _, %{"container" => true}}, Refs.resolve(&1, "item", m, defs)))

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
