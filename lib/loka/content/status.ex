defmodule Loka.Content.Status do
  @moduledoc "Checks toolbox row 1 status declarations, their appliers, the foods that cure them, (row G3) the NPCs and items immune to them and (row 2c) their attribute modifiers and (row G13) the liquids that cure them; (row W8) permanent statuses never tick nor move the derived hp maximum."
  import Loka.Content.Source, only: [at: 2, diag: 2, ref: 3]
  alias Loka.Content.Refs

  def check(nil, _, _, _), do: []
  def check(_, _, nil, _), do: []

  def check(m, defs, {_, text}, settings) do
    statuses = defs["status"] || %{}

    cures = edible_lists(defs)

    {later, g3} = g3_fields(defs)

    if statuses == %{} and cures == [] and not g3,
      do: [],
      else:
        gate(m) ++
          values(statuses, {m, settings}, defs, text) ++
          foods(cures ++ later, m, defs) ++ meals(cures, m, defs, settings)
  end

  # Row hs-5: a meal's `applies` names statuses as its `cures` do.
  defp edible_lists(defs) do
    for {_, {rel, _, i}} <- defs["item"],
        k <- ~w(cures applies),
        list = get_in(i, ["edible", k]),
        list,
        do: {rel, ["edible", k], list}
  end

  # Row G3's immune lists, steps naming an item (or, row 42, an
  # NPC) and tick or expiry triggers; row 2c's status modifiers; row G13's liquid cures (ended by
  # Drink). Returns the lists naming statuses and whether any field is used.
  defp g3_fields(defs) do
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

  defp permanent?(s), do: s["duration"] == "permanent"

  # Status readers 4-8: blocks, allows, resistances, perception, concealment or movement; such a
  # status may omit per_tick too.
  defp reader?(s),
    do: senses?(s) or Enum.any?(~w(blocks allows resistances movement), &Map.has_key?(s, &1))

  defp senses?(s), do: Map.has_key?(s, "perception") or Map.has_key?(s, "concealment")

  # A fatal hp tick runs the death sequence, so death's settings must be declared too.
  defp gate(m) do
    caps = m["requires"]["capabilities"]

    if caps["status"] == 1 and caps["death"] == 1,
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
      refs(rel, s, m, defs) ++
      hp_max(rel, s, settings) ++ readers(rel, s)
  end

  defp readers(rel, s), do: commands(rel, s) ++ perception(rel, s)

  # Status reader 6: a perception names a sense (the schema subset has no minProperties).
  defp perception(rel, %{"perception" => p}) when map_size(p) == 0,
    do: [diag("SCHEMA_VIOLATION", at(rel, ["perception"]))]

  defp perception(_, _), do: []

  # Status reader 4: each name is a player command type (run_job and elapsed are authority-internal).
  defp commands(rel, s) do
    names = Refs.commands() -- ~w(run_job elapsed)

    for field <- ~w(blocks allows),
        {c, i} <- Enum.with_index(s[field] || []),
        c not in names,
        do: diag("UNKNOWN_COMMAND", at(rel, [field, i]))
  end

  # Never 0; only a modifying (row 2c), fear (row W21) or reader (4, 5, 6, 8) status may omit it; a permanent one
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

  defp refs(rel, s, m, defs), do: modifies(rel, s, m, defs) ++ pierced_by(rel, s, m, defs)

  # Row 2c: each status modifier names a real attribute.
  defp modifies(rel, s, m, defs) do
    for {a, i} <- Enum.with_index(s["modifies"] || []),
        d <- Refs.reference(rel, ["modifies", i], "attribute", a, m, defs),
        do: d
  end

  # Row 16: pierced_by only beside a concealment, naming a real skill and attribute.
  defp pierced_by(rel, %{"pierced_by" => p} = s, m, defs) do
    if(Map.has_key?(s, "concealment"),
      do: [],
      else: [diag("SCHEMA_VIOLATION", at(rel, ["pierced_by"]))]
    ) ++
      Refs.reference(rel, ["pierced_by"], "skill", p, m, defs) ++
      Refs.reference(rel, ["pierced_by"], "attribute", p, m, defs)
  end

  defp pierced_by(_, _, _, _), do: []

  @doc "Row 16: expands a pierced_by; `expand` (Checks.expand) expands the rest."
  # Row hs-5: an edible's `applies` names statuses as its `cures` do.
  def edible(e, m, expand) do
    {lists, rest} = Map.split(e, ~w(cures applies))

    Map.merge(
      expand.(rest, m),
      Map.new(lists, fn {k, l} ->
        {k, if(is_list(l), do: Enum.map(l, &ref(&1, "status", m)), else: l)}
      end)
    )
  end

  def expand(%{"pierced_by" => %{"skill" => k, "attribute" => a}} = s, m, expand),
    do:
      Map.put(expand.(Map.delete(s, "pierced_by"), m), "pierced_by", %{
        "skill" => ref(k, "skill", m),
        "attribute" => ref(a, "attribute", m)
      })

  # loka-kgd.50: a permanent status never modifies an attribute the derived hp maximum reads.
  defp hp_max(rel, s, settings) do
    terms = hp_terms(settings)

    for {a, i} <- Enum.with_index(s["modifies"] || []),
        permanent?(s) and a["attribute"] in terms,
        do: diag("SCHEMA_VIOLATION", at(rel, ["modifies", i, "attribute"]))
  end

  # Row hs-5: a meal's status never moves the derived hp maximum either (loka-kgd.50).
  defp meals(lists, m, defs, settings) do
    terms = hp_terms(settings)

    for {rel, ["edible", "applies"] = path, list} <- lists,
        {s, i} <- Enum.with_index(list),
        {_, _, d} <- [Refs.resolve(s, "status", m, defs)],
        Enum.any?(d["modifies"] || [], &(&1["attribute"] in terms)),
        do: diag("SCHEMA_VIOLATION", at(rel, path ++ [i]))
  end

  defp hp_terms(settings),
    do:
      for(
        t <- get_in(settings, ["world", "derived", "hp_max", "terms"]) || [],
        do: t["attribute"]
      )

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
