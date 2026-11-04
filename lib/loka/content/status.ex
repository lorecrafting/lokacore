# size: allow 311, consumable applies entries carry their own duration and drinks share the meal checks (loka-kgd.209)
defmodule Loka.Content.Status do
  @moduledoc "Checks toolbox row 1 status declarations, their appliers, the foods that cure them, (row G3) the NPCs and items immune to them and (row 2c) their attribute modifiers and (row G13) the liquids that cure them; (row W8) permanent statuses, which may tick until cured, never move the derived hp maximum."
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, diag: 4, ref: 3]
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
          holders(m, defs) ++
          foods(cures ++ later, m, defs) ++ meals(cures ++ later, m, defs, settings)
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
      for(
        {_, {rel, _, l}} <- defs["liquid"] || %{},
        k <- ~w(cures applies),
        l[k],
        do: {rel, [k], l[k]}
      )

  # An applies entry may be {status, duration} (loka-kgd.209); a cures entry is the status itself.
  defp name(%{"status" => s}), do: s
  defp name(s), do: s

  defp trigger?({_, {_, _, %{} = r}}),
    do:
      String.starts_with?(r["on"]["event"], "status_") or
        Enum.any?(r["steps"], &(&1["op"] == "status.apply" and (&1["item"] || &1["npc"])))

  defp trigger?(_), do: false

  defp permanent?(s), do: s["duration"] == "permanent"

  @doc "A status.apply that schedules no job, so a timed action's advance crosses nothing (`applyStatus`)."
  def no_job?(%{"status" => name} = step, m, defs) do
    status = ref(name, "status", m)

    case Refs.resolve(status, "status", m, defs) do
      {_, [], spec} = found ->
        (spec["duration"] == "permanent" and not ticking?(found)) or
          immune?(step["npc"], status, m, defs)

      # A status or body with its own line: its refusal is the writer's next step, not this one.
      _ ->
        true
    end
  end

  defp immune?(nil, _, _, _), do: false

  defp immune?(npc, status, m, defs) do
    case Refs.resolve(ref(npc, "npc", m), "npc", m, defs) do
      {_, [], %{"immune" => immune}} -> status in Enum.map(immune, &ref(&1, "status", m))
      {_, [], _} -> false
      _ -> true
    end
  end

  # Row W8: a ticking permanent status goes on a body only: never a named item or room, a tag, or
  # the subject of a status event, which may be either.
  defp holders(m, defs) do
    for {_, {rel, _, %{"steps" => steps} = r}} <- defs["reaction"] || %{},
        {%{"op" => "status.apply"} = s, i} <- Enum.with_index(steps),
        ticking?(Refs.resolve(ref(s["status"], "status", m), "status", m, defs)),
        key <- off_body(s, r["on"]["event"]),
        do: diag("SCHEMA_VIOLATION", at(rel, ["steps", i, key]), %{"error" => "invalid_value"})
  end

  defp ticking?({_, _, %{} = s}), do: (s["per_tick"] || s["ticks"]) != nil and permanent?(s)
  defp ticking?(_), do: false

  defp off_body(s, event) do
    case Enum.filter(~w(item room tag), &Map.has_key?(s, &1)) do
      [] ->
        if event in ~w(status_applied status_ticked status_expired) and
             not (Map.has_key?(s, "npc") or Map.has_key?(s, "co_present")),
           do: ["status"],
           else: []

      named ->
        named
    end
  end

  # Status readers 4-8: blocks, allows, resistances, perception, concealment or movement; such a
  # status may omit per_tick too.
  defp reader?(s),
    do: senses?(s) or Enum.any?(~w(blocks allows resistances movement), &Map.has_key?(s, &1))

  defp senses?(s), do: Map.has_key?(s, "perception") or Map.has_key?(s, "concealment")

  # A fatal hp tick runs the death sequence, so death's settings must be declared too.
  defp gate(m) do
    path = at("cartridge.json", ["requires", "capabilities"])

    for c <- ~w(status death),
        m["requires"]["capabilities"][c] != 1,
        do: diag("UNDECLARED_CAPABILITY", path, %{"capability" => c}, [c <> "@1"])
  end

  defp values(statuses, ms, defs, text) do
    for {_, {rel, _, s}} <- statuses, d <- status(rel, s, ms, defs, text), do: d
  end

  defp status(rel, s, {m, settings}, defs, text) do
    pools(rel, s, m, defs) ++
      timing(rel, s) ++
      missing_text(rel, ["name"], [s["name"]], text) ++
      missing_text(rel, ["narration"], Map.values(s["narration"] || %{}), text) ++
      refs(rel, s, m, defs) ++
      hp_max(rel, s, settings) ++ readers(rel, s)
  end

  defp readers(rel, s), do: commands(rel, s) ++ perception(rel, s)

  defp timing(rel, s) do
    if(not permanent?(s) and s["tick_every"] >= s["duration"],
      do: [diag("SCHEMA_VIOLATION", at(rel, ["tick_every"]))],
      else: []
    ) ++ per_tick(rel, s) ++ expired(rel, s)
  end

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

  # loka-kgd.209: one `resource` (with its optional per_tick) or several `ticks`, never both.
  defp pools(rel, %{"ticks" => ticks} = s, m, defs) do
    both =
      for k <- ~w(resource per_tick),
          Map.has_key?(s, k),
          do: diag("SCHEMA_VIOLATION", at(rel, [k]))

    # Beside a `resource`, Resolve.expand leaves the ticks' own refs unexpanded: report only both.
    if both != [], do: both, else: Enum.flat_map(Enum.with_index(ticks), &tick(rel, &1, m, defs))
  end

  defp pools(rel, s, m, defs) when is_map_key(s, "resource"),
    do: Refs.reference(rel, [], "resource", s, m, defs)

  defp pools(rel, _, _, _), do: [diag("SCHEMA_VIOLATION", at(rel, ["resource"]))]

  defp tick(rel, {%{"per_tick" => 0}, i}, _, _),
    do: [diag("SCHEMA_VIOLATION", at(rel, ["ticks", i, "per_tick"]))]

  defp tick(rel, {t, i}, m, defs), do: Refs.reference(rel, ["ticks", i], "resource", t, m, defs)

  # Never 0; only a ticks (loka-kgd.209), modifying (row 2c), fear (row W21), reader (4, 5, 6, 8) or permanent (row W8) status
  # may omit it.
  defp per_tick(rel, s) do
    if s["per_tick"] == 0 or
         (s["per_tick"] == nil and s["ticks"] == nil and s["modifies"] == nil and s["fear"] == nil and
            not reader?(s) and
            not permanent?(s)),
       do: [diag("SCHEMA_VIOLATION", at(rel, ["per_tick"]))],
       else: []
  end

  # A timed status tells its expiry; a permanent one (row W8) never expires, so it may omit the line.
  defp expired(rel, s) do
    if permanent?(s) or Map.has_key?(s["narration"] || %{}, "expired"),
      do: [],
      else: [diag("SCHEMA_VIOLATION", at(rel, ["narration", "expired"]))]
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

  @doc "Row 16: expands a pierced_by; `expand` (Resolve.expand) expands the rest."
  # Row hs-5: an edible's `applies` names statuses as its `cures` do.
  def edible(e, m, expand) do
    {lists, rest} = Map.split(e, ~w(cures applies))

    Map.merge(
      expand.(rest, m),
      Map.new(lists, fn {k, l} ->
        {k, if(is_list(l), do: Enum.map(l, &status_ref(k, &1, m)), else: l)}
      end)
    )
  end

  # loka-kgd.209: an applies entry compiles to {status, duration?}; a bare key is {status}.
  defp status_ref("applies", %{"status" => s} = a, m), do: %{a | "status" => ref(s, "status", m)}
  defp status_ref("applies", s, m), do: %{"status" => ref(s, "status", m)}
  defp status_ref(_, s, m), do: ref(s, "status", m)

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

  # Row hs-5: a meal's or drink's status never moves the derived hp maximum either (loka-kgd.50),
  # and its own duration never lands on a permanent status (loka-kgd.209).
  defp meals(lists, m, defs, settings) do
    terms = hp_terms(settings)

    for {rel, path, list} <- lists,
        List.last(path) == "applies",
        {s, i} <- Enum.with_index(list),
        bad_meal?(s, Refs.resolve(name(s), "status", m, defs), terms),
        do: diag("SCHEMA_VIOLATION", at(rel, path ++ [i]))
  end

  defp bad_meal?(s, {_, _, d}, terms),
    do:
      Enum.any?(d["modifies"] || [], &(&1["attribute"] in terms)) or
        (is_map(s) and is_map_key(s, "duration") and permanent?(d))

  defp bad_meal?(_, _, _), do: false

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
        Refs.resolve(name(s), "status", m, defs) == :unresolved,
        do: diag("UNRESOLVED_REFERENCE", at(rel, path ++ [i]))
  end
end
