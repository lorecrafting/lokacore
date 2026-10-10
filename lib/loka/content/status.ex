defmodule Loka.Content.Status do
  @moduledoc "Checks toolbox row 1 status declarations, their appliers, the foods that cure them and (row G3) the NPCs and items immune to them."
  import Loka.Content.Source, only: [at: 2, diag: 2]
  alias Loka.Content.Refs

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    statuses = defs["status"] || %{}

    cures =
      for {_, {rel, _, i}} <- defs["item"],
          cures = get_in(i, ["edible", "cures"]),
          cures,
          do: {rel, ["edible", "cures"], cures}

    # Row G13: a liquid's cures, ended by Drink, need kernel_api 1.46 like row G3's fields.
    drinks =
      for {_, {rel, _, l}} <- defs["liquid"] || %{}, l["cures"], do: {rel, ["cures"], l["cures"]}

    {immune, g3} = row_g3(defs)

    if statuses == %{} and cures == [] and drinks == [] and not g3,
      do: [],
      else:
        gate(m, g3 or drinks != []) ++
          values(statuses, m, defs, text) ++ foods(cures ++ drinks ++ immune, m, defs)
  end

  # Row G3: each NPC's or item's immune list, and whether any G3 field (those, a step naming an
  # item, or a tick or expiry trigger) is used.
  defp row_g3(defs) do
    immune =
      for kind <- ~w(npc item),
          {_, {rel, _, e}} <- defs[kind] || %{},
          e["immune"],
          do: {rel, ["immune"], e["immune"]}

    {immune, immune != [] or Enum.any?(defs["reaction"] || %{}, &trigger?/1)}
  end

  defp trigger?({_, {_, _, %{} = r}}),
    do:
      String.starts_with?(r["on"]["event"], "status_") or
        Enum.any?(r["apply"], &(&1["op"] == "status.apply" and &1["item"] != nil))

  defp trigger?(_), do: false

  # A fatal hp tick runs the death sequence, so death's settings must be declared too.
  defp gate(m, g3) do
    caps = m["requires"]["capabilities"]

    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if caps["status"] == 1 and caps["death"] == 1 and
         version >= if(g3, do: [1, 46], else: [1, 38]),
       do: [],
       else: [diag("KERNEL_API_RANGE_INVALID", at("cartridge.json", ["requires", "kernel_api"]))]
  end

  defp values(statuses, m, defs, text) do
    for {_, {rel, _, s}} <- statuses, d <- status(rel, s, m, defs, text), do: d
  end

  defp status(rel, s, m, defs, text) do
    Refs.reference(rel, [], "resource", s, m, defs) ++
      if(s["tick_every"] >= s["duration"],
        do: [diag("SCHEMA_VIOLATION", at(rel, ["tick_every"]))],
        else: []
      ) ++
      if(s["per_tick"] == 0, do: [diag("SCHEMA_VIOLATION", at(rel, ["per_tick"]))], else: []) ++
      missing_text(rel, ["label"], [s["label"]], text) ++
      missing_text(rel, ["narration"], Map.values(s["narration"] || %{}), text)
  end

  defp missing_text(_, _, _, :unknown), do: []

  defp missing_text(rel, path, keys, text) do
    if Enum.all?(keys, &Map.has_key?(text, &1)),
      do: [],
      else: [diag("SCHEMA_VIOLATION", at(rel, path))]
  end

  defp foods(lists, m, defs) do
    for {rel, path, list} <- lists,
        {s, i} <- Enum.with_index(list),
        Refs.resolve(s, "status", m, defs) == :unresolved,
        do: diag("UNRESOLVED_REFERENCE", at(rel, path ++ [i]))
  end
end
