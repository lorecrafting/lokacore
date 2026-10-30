defmodule Loka.Content.Derived do
  @moduledoc """
  Checks toolbox row 2 derived-stat tables (world.derived), row 3 item affects, row 27 identified
  items, row G3 NPC attributes, balance 6b's gear budget and row 6a's equip words.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, diag: 4, ref: 3]
  alias Loka.Content.Refs

  # hp_max needs the hp pool, which every compiled cartridge has (Resources @defaults).
  @needs %{
    "hit_chance" => "combat",
    "damage" => "combat",
    "carry_grams" => "carry",
    "hp_max" => nil
  }

  def settings(%{"world" => %{"derived" => d}} = settings, m),
    do: put_in(settings, ["world", "derived"], Map.new(d, fn {k, s} -> {k, expand(s, m)} end))

  def settings(settings, _), do: settings

  defp expand(stat, m),
    do:
      Map.update!(
        stat,
        "terms",
        &Enum.map(&1, fn t -> Map.update!(t, "attribute", fn a -> ref(a, "attribute", m) end) end)
      )

  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    world = settings["world"] || %{}
    items = for {_, {rel, _, item}} <- defs["item"] || %{}, do: {rel, item}

    tables(m, defs, world) ++
      gear_budget(m, world) ++
      Enum.flat_map(items, &item(&1, m, defs)) ++ npcs(m, defs)
  end

  defp tables(m, defs, %{"derived" => table} = world),
    do: owner(m, "cartridge.world.derived") ++ Enum.flat_map(table, &stat(&1, m, defs, world))

  defp tables(_, _, _), do: []

  # Balance 6b: a gear budget needs attribute@1 and budgets at least one slot (too_few_items: the
  # subset has no minProperties).
  defp gear_budget(m, %{"gear_budget" => %{"per_slot" => slots}}) when slots == %{},
    do:
      owner(m, "cartridge.world.gear_budget") ++
        [
          diag("SCHEMA_VIOLATION", "cartridge.world.gear_budget.per_slot", %{
            "error" => "too_few_items"
          })
        ]

  defp gear_budget(m, %{"gear_budget" => _}), do: owner(m, "cartridge.world.gear_budget")
  defp gear_budget(_, _), do: []

  defp item(i, m, defs),
    do: intended(i) ++ equip(i) ++ affects(i, m, defs) ++ identified(i, m, defs)

  # Row 6a: authored wear and remove words need a slot to wear in.
  defp equip({rel, %{"equip" => _} = item}) when not is_map_key(item, "slot"),
    do: [diag("SCHEMA_VIOLATION", at(rel, ["equip"]))]

  defp equip(_), do: []

  # Balance 6b: an intended level sits beside affects.
  defp intended({rel, %{"intended_level" => _} = item}) when not is_map_key(item, "affects"),
    do: [diag("SCHEMA_VIOLATION", at(rel, ["intended_level"]))]

  defp intended(_), do: []

  # Toolbox row 3: an item's affects need its slot, attribute@1 and real attributes.
  defp affects({rel, %{"affects" => list} = item}, m, defs) do
    slot = if item["slot"], do: [], else: [diag("SCHEMA_VIOLATION", at(rel, ["affects"]))]

    owner(m, at(rel, ["affects"])) ++
      slot ++
      for {a, i} <- Enum.with_index(list),
          e <- Refs.reference(rel, ["affects", i], "attribute", a, m, defs),
          do: e
  end

  defp affects(_, _, _), do: []

  # Toolbox row 27: an item's identified names a bool fact of this cartridge and sits beside
  # affects (the loader alone refuses a per_subject fact there, FACT_SCOPE_UNSUPPORTED).
  defp identified({rel, %{"identified" => fact} = item}, m, defs) do
    bool =
      case Refs.resolve(fact, "fact", m, defs) do
        {_, _, %{"value_type" => %{"type" => t}}} when t != "bool" ->
          [diag("FACT_TYPE_MISMATCH", at(rel, ["identified"]))]

        _ ->
          []
      end

    worn = if item["affects"], do: [], else: [diag("SCHEMA_VIOLATION", at(rel, ["identified"]))]
    Refs.reference(rel, [], {"identified", "fact"}, item, m, defs) ++ bool ++ worn
  end

  defp identified(_, _, _), do: []

  # Row G3: an NPC's attributes each name a distinct real attribute (an attributes section already
  # needs attribute@1).
  defp npcs(m, defs) do
    for {_, {rel, _, %{"attributes" => list}}} <- defs["npc"] || %{},
        {a, i} <- Enum.with_index(list),
        d <-
          dup(rel, list, a, i) ++ Refs.reference(rel, ["attributes", i], "attribute", a, m, defs),
        do: d
  end

  defp dup(rel, list, a, i) do
    if a["attribute"] in Enum.map(Enum.take(list, i), & &1["attribute"]),
      do: [
        diag(
          "SCHEMA_VIOLATION",
          at(rel, ["attributes", i, "attribute"]),
          %{"error" => "invalid_value"},
          []
        )
      ],
      else: []
  end

  defp owner(m, path) do
    if m["requires"]["capabilities"]["attribute"] == 1,
      do: [],
      else: [
        diag("UNDECLARED_CAPABILITY", path, %{"capability" => "attribute"}, ["attribute@1"])
      ]
  end

  defp stat({key, stat}, m, defs, world) do
    path = ["world", "derived", key]

    needs =
      if Map.fetch!(@needs, key) in [nil | Map.keys(world)],
        do: [],
        else: [diag("SCHEMA_VIOLATION", at("cartridge.json", path))]

    needs ++
      for {term, i} <- Enum.with_index(stat["terms"]),
          d <- Refs.reference("cartridge.json", path ++ ["terms", i], "attribute", term, m, defs),
          do: d
  end
end
