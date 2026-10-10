defmodule Loka.Content.Status do
  @moduledoc "Checks toolbox row 1 status declarations, their appliers, the foods that cure them, (row G3) the NPCs and items immune to them and (row 2c) their attribute modifiers."
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

    {later, g3} = api_146(defs)

    if statuses == %{} and cures == [] and not g3,
      do: [],
      else: gate(m, g3) ++ values(statuses, m, defs, text) ++ foods(cures ++ later, m, defs)
  end

  # The fields needing kernel_api 1.46: row G3's immune lists, steps naming an item and tick or
  # expiry triggers; row 2c's status modifiers; row G13's liquid cures (ended by Drink). Returns
  # the lists naming statuses and whether any field is used.
  defp api_146(defs) do
    immune =
      for kind <- ~w(npc item),
          {_, {rel, _, e}} <- defs[kind] || %{},
          e["immune"],
          do: {rel, ["immune"], e["immune"]}

    lists = immune ++ drinks(defs)
    modifies = Enum.any?(defs["status"] || %{}, &match?({_, {_, _, %{"modifies" => _}}}, &1))
    {lists, lists != [] or modifies or Enum.any?(defs["reaction"] || %{}, &trigger?/1)}
  end

  defp drinks(defs),
    do:
      for({_, {rel, _, l}} <- defs["liquid"] || %{}, l["cures"], do: {rel, ["cures"], l["cures"]})

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
      per_tick(rel, s) ++
      missing_text(rel, ["label"], [s["label"]], text) ++
      missing_text(rel, ["narration"], Map.values(s["narration"] || %{}), text) ++
      modifies(rel, s, m, defs)
  end

  # Never 0; only a modifying status (row 2c) may omit it.
  defp per_tick(rel, s) do
    if s["per_tick"] == 0 or (s["per_tick"] == nil and s["modifies"] == nil),
      do: [diag("SCHEMA_VIOLATION", at(rel, ["per_tick"]))],
      else: []
  end

  # Row 2c: each status modifier names a real attribute.
  defp modifies(rel, s, m, defs) do
    for {a, i} <- Enum.with_index(s["modifies"] || []),
        d <- Refs.reference(rel, ["modifies", i], "attribute", a, m, defs),
        do: d
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
