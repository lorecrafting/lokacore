defmodule Loka.Content.Status do
  @moduledoc "Checks toolbox row 1 status declarations, their appliers, the foods that cure them, (row G3) the NPCs and items immune to them and (row 2c) their attribute modifiers and (row G13) the liquids that cure them; (row W8) permanent statuses never tick nor move the derived hp maximum."
  import Loka.Content.Source, only: [at: 2, diag: 2]
  alias Loka.Content.Refs

  def check(nil, _, _, _), do: []
  def check(_, _, nil, _), do: []

  def check(m, defs, {_, text}, settings) do
    statuses = defs["status"] || %{}

    cures =
      for {_, {rel, _, i}} <- defs["item"],
          cures = get_in(i, ["edible", "cures"]),
          cures,
          do: {rel, ["edible", "cures"], cures}

    {later, g3} = api_146(defs)

    if statuses == %{} and cures == [] and not g3,
      do: [],
      else:
        gate(m, floor(statuses, g3)) ++
          values(statuses, {m, settings}, defs, text) ++ foods(cures ++ later, m, defs)
  end

  # The fields needing kernel_api 1.46: row G3's immune lists, steps naming an item (or, row 42, an
  # NPC) and tick or expiry triggers; row 2c's status modifiers; row G13's liquid cures (ended by
  # Drink). Returns the lists naming statuses and whether any field is used.
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
        Enum.any?(r["apply"], &(&1["op"] == "status.apply" and (&1["item"] || &1["npc"])))

  defp trigger?(_), do: false

  # A movement status (reader 7) needs 1.62, a status reader (4, 5) 1.54, a fear status (row W21) 1.50, a permanent one (row W8) 1.48,
  # the fields above 1.46.
  defp floor(statuses, g3) do
    cond do
      Enum.any?(statuses, &match?({_, {_, _, %{"movement" => _}}}, &1)) -> [1, 62]
      Enum.any?(for {_, {_, _, s}} <- statuses, do: reader?(s)) -> [1, 54]
      Enum.any?(statuses, &match?({_, {_, _, %{"fear" => true}}}, &1)) -> [1, 50]
      Enum.any?(statuses, &match?({_, {_, _, %{"duration" => "permanent"}}}, &1)) -> [1, 48]
      g3 -> [1, 46]
      true -> [1, 38]
    end
  end

  defp permanent?(s), do: s["duration"] == "permanent"

  # Status readers 4, 5 and 7: blocks, allows, resistances or movement; such a status may omit
  # per_tick too.
  defp reader?(s), do: Enum.any?(~w(blocks allows resistances movement), &Map.has_key?(s, &1))

  # A fatal hp tick runs the death sequence, so death's settings must be declared too.
  defp gate(m, floor) do
    caps = m["requires"]["capabilities"]

    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if caps["status"] == 1 and caps["death"] == 1 and
         version >= floor,
       do: [],
       else: [diag("KERNEL_API_RANGE_INVALID", at("cartridge.json", ["requires", "kernel_api"]))]
  end

  defp values(statuses, ms, defs, text) do
    for {_, {rel, _, s}} <- statuses, d <- status(rel, s, ms, defs, text), do: d
  end

  defp status(rel, s, {m, settings}, defs, text) do
    Refs.reference(rel, [], "resource", s, m, defs) ++
      if(not permanent?(s) and s["tick_every"] >= s["duration"],
        do: [diag("SCHEMA_VIOLATION", at(rel, ["tick_every"]))],
        else: []
      ) ++
      per_tick(rel, s) ++
      missing_text(rel, ["label"], [s["label"]], text) ++
      missing_text(rel, ["narration"], Map.values(s["narration"] || %{}), text) ++
      modifies(rel, s, m, defs) ++ hp_max(rel, s, settings) ++ commands(rel, s)
  end

  # Status reader 4: each name is a player command type (run_job and elapsed are authority-internal).
  defp commands(rel, s) do
    names = Refs.commands() -- ~w(run_job elapsed)

    for field <- ~w(blocks allows),
        {c, i} <- Enum.with_index(s[field] || []),
        c not in names,
        do: diag("UNKNOWN_COMMAND", at(rel, [field, i]))
  end

  # Never 0; only a modifying (row 2c), fear (row W21) or reader (4, 5) status may omit it; a permanent one
  # (row W8) never ticks, so it declares none.
  defp per_tick(rel, s) do
    if s["per_tick"] == 0 or
         if(permanent?(s),
           do: s["per_tick"] != nil,
           else:
             s["per_tick"] == nil and s["modifies"] == nil and s["fear"] == nil and not reader?(s)
         ),
       do: [diag("SCHEMA_VIOLATION", at(rel, ["per_tick"]))],
       else: []
  end

  # Row 2c: each status modifier names a real attribute.
  defp modifies(rel, s, m, defs) do
    for {a, i} <- Enum.with_index(s["modifies"] || []),
        d <- Refs.reference(rel, ["modifies", i], "attribute", a, m, defs),
        do: d
  end

  # loka-kgd.50: a permanent status never modifies an attribute the derived hp maximum reads.
  defp hp_max(rel, s, settings) do
    terms =
      for t <- get_in(settings, ["world", "derived", "hp_max", "terms"]) || [], do: t["attribute"]

    for {a, i} <- Enum.with_index(s["modifies"] || []),
        permanent?(s) and a["attribute"] in terms,
        do: diag("SCHEMA_VIOLATION", at(rel, ["modifies", i, "attribute"]))
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
