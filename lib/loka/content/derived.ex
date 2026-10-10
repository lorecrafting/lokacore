defmodule Loka.Content.Derived do
  @moduledoc """
  Checks toolbox row 2 derived-stat tables (world.derived), row 3 item affects and row G3 NPC
  attributes; twin of cartridge_derived.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 4, ref: 3]
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
    table = get_in(settings, ["world", "derived"])
    items = for {_, {rel, _, item}} <- defs["item"] || %{}, do: {rel, item}

    tables =
      if table,
        do:
          owner(m, "cartridge.world.derived") ++
            Enum.flat_map(table, &stat(&1, m, defs, settings["world"])),
        else: []

    floor(m, table, items, g3?(defs)) ++
      tables ++ Enum.flat_map(items, &affects(&1, m, defs)) ++ npcs(m, defs)
  end

  # Row G3: NPC attributes, or an opposed check naming an NPC.
  defp g3?(defs),
    do:
      Enum.any?(defs["npc"] || %{}, &match?({_, {_, _, %{"attributes" => _}}}, &1)) or
        Enum.any?(defs["recipe"] || %{}, &match?({_, {_, _, %{"check" => %{"npc" => _}}}}, &1))

  # NPC attributes are row G3 (API 1.46); finger slots and affects row 3 (1.41); hp_max 1.40;
  # the other tables 1.39.
  defp floor(m, table, items, g3) do
    floor =
      cond do
        g3 -> [1, 46]
        Enum.any?(items, fn {_, i} -> i["affects"] || i["slot"] == "finger" end) -> [1, 41]
        table == nil -> nil
        table["hp_max"] -> [1, 40]
        true -> [1, 39]
      end

    if floor && api(m) < floor,
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  # Toolbox row 3: an item's affects need its slot, attributes@1 and real attributes.
  defp affects({rel, %{"affects" => list} = item}, m, defs) do
    slot = if item["slot"], do: [], else: [diag("SCHEMA_VIOLATION", at(rel, ["affects"]))]

    owner(m, at(rel, ["affects"])) ++
      slot ++
      for {a, i} <- Enum.with_index(list),
          e <- Refs.reference(rel, ["affects", i], "attribute", a, m, defs),
          do: e
  end

  defp affects(_, _, _), do: []

  # Row G3: an NPC's attributes each name a distinct real attribute (an attributes section already
  # needs attributes@1).
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
    if m["requires"]["capabilities"]["attributes"] == 1,
      do: [],
      else: [
        diag("UNDECLARED_CAPABILITY", path, %{"capability" => "attributes"}, ["attributes@1"])
      ]
  end

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

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
