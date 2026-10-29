defmodule Loka.Content.Skills do
  @moduledoc "Reserved skill acquisition facts and equipment/lesson references."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [reference: 6]

  def spec(key),
    do: %{
      "key" => "skill_" <> key,
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "Skill #{key}'s acquisition (skills@1): only skills@1 writes it."
    }

  @doc "Toolbox row 5: the reserved use count of a skill with growth (mechanics.md skill growth)."
  def uses_spec(key, growth),
    do: %{
      "key" => "uses_" <> key,
      "version" => 1,
      "value_type" => %{
        "type" => "int",
        "default" => 0,
        "minimum" => 0,
        "maximum" => List.last(growth)
      },
      "scopes" => ["player"],
      "meaning" => "Skill #{key}'s use count (skills@1): only skills@1 writes it."
    }

  # Scripted action tips' seen_tip_<key> facts (ActionTips.tip_facts) are reserved the same way, here.
  def facts(facts, m, defs) when is_map(facts) and m != nil do
    Enum.reduce(defs["skill"], {facts, []}, fn {key, skill}, acc ->
      Enum.reduce(reserved(key, skill), acc, &reserve(&1, skill, &2))
    end)
    |> Loka.Content.ActionTips.tip_facts(defs)
  end

  def facts(facts, _, _), do: {facts, []}

  defp reserved(key, {_, _, %{"growth" => g}}),
    do: [{"skill_" <> key, spec(key)}, {"uses_" <> key, uses_spec(key, g)}]

  defp reserved(key, _), do: [{"skill_" <> key, spec(key)}]

  defp reserve({name, s}, skill, {acc, ds}) do
    authored = for {rel, steps, _} <- [acc[name]], do: diag("RESERVED_FACT", at(rel, steps))
    value = if skill == :invalid, do: :invalid, else: {"cartridge.json", [], s}
    {Map.put(acc, name, value), ds ++ authored}
  end

  def conditions(defs),
    do:
      for(
        {_, {rel, _, s}} <- defs["skill"],
        field <- ~w(qualification prerequisite),
        is_map_key(s, field),
        do: {rel, [field], s[field]}
      )

  def check(nil, _, _, _), do: []

  def check(m, defs, {_, settings}, text) do
    caps = m["requires"]["capabilities"]

    hidden = hidden(m, defs)

    Enum.flat_map(
      defs["skill"],
      &(definition(&1, caps, text) ++ growth(&1) ++ itself(m, &1, hidden))
    ) ++
      secret(m, defs) ++
      equipment(m, defs) ++ dodge(m, defs, settings) ++ defense_narration(defs, settings)
  end

  defp definition({_, {rel, _, s}}, caps, text) do
    capability(rel, caps) ++
      if(String.length(s["key"]) <= 58, do: [], else: [bad(at(rel, ["key"]))]) ++
      texts(rel, s, text)
  end

  defp definition(_, _, _), do: []

  defp texts(rel, s, text),
    do:
      for(
        field <- ~w(name requirement profession),
        is_map_key(s, field),
        text != :unknown and not is_map_key(text, s[field]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, [field]), %{"target" => s[field]})
      )

  # Toolbox row 5: growth thresholds strictly increase.
  defp growth({_, {rel, _, %{"growth" => g}}}) do
    increasing = g |> Enum.chunk_every(2, 1, :discard) |> Enum.all?(fn [a, b] -> a < b end)
    if increasing, do: [], else: [bad(at(rel, ["growth"]))]
  end

  defp growth(_), do: []

  # Homestead hs-11: a box never requires itself (its own full ref).
  # Homestead hs-14: a shown box never requires a hidden one.
  defp itself(m, {key, {rel, _, %{"prerequisite" => p} = s}}, hidden) do
    me = ref(m, key)
    banned = if s["hidden"] == true, do: [me], else: [me | hidden]

    if Enum.any?(
         Loka.Content.Policies.nodes(p, []),
         &(match?({%{"op" => "skill_compare", "skill" => _}, _}, &1) and
             elem(&1, 0)["skill"] in banned)
       ),
       do: [bad(at(rel, ["prerequisite"]))],
       else: []
  end

  defp itself(_, _, _), do: []

  # Homestead hs-14 (secret): no shown skill's qualification and no dialogue policy reads a hidden
  # skill, and no labeled talk or riddle dialogue teaches one.
  defp secret(m, defs) do
    hidden? =
      &match?({_, _, %{"hidden" => true}}, Loka.Content.Refs.resolve(&1, "skill", m, defs))

    shown_qualifications(defs, hidden?) ++ dialogues(defs, hidden?)
  end

  defp shown_qualifications(defs, hidden?),
    do:
      for(
        {_, {rel, _, s}} <- defs["skill"],
        !s["hidden"],
        reads?(s["qualification"], hidden?),
        do: bad(at(rel, ["qualification"]))
      )

  defp dialogues(defs, hidden?),
    do:
      for(
        {_, {rel, [], d}} <- defs["dialogue"] || %{},
        {field, true} <- [
          {"policy", reads?(d["policy"], hidden?)},
          {"name", !!d["name"] and teaches?(d, hidden?)},
          {"riddle", !!d["riddle"] and teaches?(d, hidden?)}
        ],
        do: bad(at(rel, [field]))
      )

  # Only skill_compare (in a policy) and skill.acquire (in a sequence) carry a "skill".
  defp reads?(p, hidden?),
    do: Enum.any?(Loka.Content.Policies.nodes(p, []), fn {n, _} -> hidden?.(n["skill"]) end)

  defp teaches?(d, hidden?),
    do:
      Enum.any?(Map.values(d["choices"]), fn o ->
        Enum.any?(o["sequence"] || [], &hidden?.(&1["skill"]))
      end)

  defp hidden(m, defs),
    do: for({key, {_, _, %{"hidden" => true}}} <- defs["skill"], do: ref(m, key))

  defp ref(m, key),
    do: %{
      "cartridge_id" => m["id"],
      "cartridge_version" => m["version"],
      "kind" => "skill",
      "key" => key
    }

  defp capability(rel, caps),
    do:
      if(caps["skills"] == 1 and caps["fact"] == 1 and caps["policy"] == 1,
        do: [],
        else: [diag("UNDECLARED_CAPABILITY", at(rel, []), %{"capability" => "skills"})]
      )

  defp equipment(m, defs) do
    for {_, {rel, _, item}} <- defs["item"],
        error <- weapon(m, defs, rel, item) ++ block(rel, item),
        do: error
  end

  defp weapon(m, defs, rel, %{"weapon" => w} = item) do
    reference(rel, ["weapon"], {"skill", "skill"}, w, m, defs) ++
      if(item["slot"] == "wield" and w["attack"]["damage_min"] <= w["attack"]["damage_max"],
        do: [],
        else: [bad(at(rel, ["weapon"]))]
      ) ++ durability(m, defs, rel, w["durability"])
  end

  defp weapon(_, _, _, _), do: []

  # Toolbox row 21: a durability names a bounded int entity fact.
  defp durability(_, _, _, nil), do: []

  defp durability(m, defs, rel, d) do
    steps = ["weapon", "durability"]

    shape =
      case Loka.Content.Refs.resolve(d["fact"], "fact", m, defs) do
        {_, _, f} when is_map(f) ->
          if entity_int?(f), do: [], else: [bad(at(rel, steps ++ ["fact"]))]

        _ ->
          []
      end

    reference(rel, steps, {"fact", "fact"}, d, m, defs) ++
      shape
  end

  defp entity_int?(%{"value_type" => t} = f),
    do:
      t["type"] == "int" and is_integer(t["minimum"]) and is_integer(t["maximum"]) and
        f["per_subject"] == true and f["scopes"] == ["instance"] and f["npc_pair"] != true

  defp block(rel, %{"block_chance" => _} = item),
    do: if(item["slot"] == "off_hand", do: [], else: [bad(at(rel, ["block_chance"]))])

  defp block(_, _), do: []

  defp dodge(m, defs, settings) do
    case get_in(settings, ["world", "combat", "dodge"]) do
      nil ->
        []

      d ->
        reference("cartridge.json", ["world", "combat", "dodge"], {"skill", "skill"}, d, m, defs)
    end
  end

  defp defense_narration(defs, settings) do
    combat = get_in(settings, ["world", "combat"]) || %{}

    shield =
      Enum.any?(defs["item"], fn
        {_, {_, _, item}} -> is_map_key(item, "block_chance")
        _ -> false
      end)

    for {enabled, field} <- [{!!combat["dodge"], "dodge"}, {shield, "block"}],
        enabled and !get_in(combat, ["narration", field]),
        do: bad(at("cartridge.json", ["world", "combat", "narration", field]))
  end

  def choice(rel, steps, o, d, ctx) do
    refs =
      for {s, i} <- Enum.with_index(o["sequence"] || []),
          s["op"] == "skill.acquire",
          e <- reference(rel, steps ++ ["sequence", i], {"skill", "skill"}, s, ctx.m, ctx.defs),
          do: e

    refs ++ lesson(rel, steps, o, d, ctx)
  end

  defp lesson(rel, steps, %{"lesson_payment" => p} = o, d, ctx) do
    teacher = d["roles"][p["to"]]

    reference(rel, steps ++ ["lesson_payment"], {"resource", "resource"}, p, ctx.m, ctx.defs) ++
      if(
        funded?(teacher, p["resource"], ctx) and teacher["npc"] == d["npc"] and !o["payment"] and
          grants(o) <= 1,
        do: [],
        else: [bad(at(rel, steps ++ ["lesson_payment"]))]
      )
  end

  defp lesson(rel, steps, o, _, _) do
    if grants(o) > 0 and (grants(o) != 1 or o["payment"] != nil),
      do: [bad(at(rel, steps ++ ["lesson_payment"]))],
      else: []
  end

  defp grants(o), do: Enum.count(o["sequence"] || [], &(&1["op"] == "skill.acquire"))

  defp funded?(%{"role" => "npc", "npc" => ref}, resource, ctx) do
    case Loka.Content.Refs.resolve(ref, "npc", ctx.m, ctx.defs) do
      {_, _, npc} -> is_map_key(npc["resource_starts"] || %{}, resource["key"])
      _ -> true
    end
  end

  defp funded?(_, _, _), do: false

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
