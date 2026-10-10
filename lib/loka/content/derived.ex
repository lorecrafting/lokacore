defmodule Loka.Content.Derived do
  @moduledoc """
  Checks toolbox row 2 derived-stat tables (world.derived) and row 3 item affects; twin of
  cartridge_derived.ts.
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
    tables =
      case get_in(settings, ["world", "derived"]) do
        nil -> []
        table -> gate(m, table) ++ Enum.flat_map(table, &stat(&1, m, defs, settings["world"]))
      end

    tables ++ affects(m, defs)
  end

  # Toolbox row 3: an item's affects need its slot, attributes@1, API 1.41 and real attributes.
  defp affects(m, defs) do
    items =
      for {_, {rel, _, %{"affects" => list} = item}} <- defs["item"] || %{}, do: {rel, item, list}

    api =
      if items == [] or api(m) >= [1, 41],
        do: [],
        else: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")]

    api ++ Enum.flat_map(items, &affect(&1, m, defs))
  end

  defp affect({rel, item, list}, m, defs) do
    owner =
      if m["requires"]["capabilities"]["attributes"] == 1,
        do: [],
        else: [
          diag("UNDECLARED_CAPABILITY", at(rel, ["affects"]), %{"capability" => "attributes"}, [
            "attributes@1"
          ])
        ]

    slot = if item["slot"], do: [], else: [diag("SCHEMA_VIOLATION", at(rel, ["affects"]))]

    owner ++
      slot ++
      for {a, i} <- Enum.with_index(list),
          e <- Refs.reference(rel, ["affects", i], "attribute", a, m, defs),
          do: e
  end

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

  defp gate(m, table) do
    api =
      if api(m) < if(table["hp_max"], do: [1, 40], else: [1, 39]),
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    cap =
      if m["requires"]["capabilities"]["attributes"] == 1,
        do: [],
        else: [
          diag(
            "UNDECLARED_CAPABILITY",
            "cartridge.world.derived",
            %{"capability" => "attributes"},
            [
              "attributes@1"
            ]
          )
        ]

    api ++ cap
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
