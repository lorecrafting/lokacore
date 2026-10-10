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

  # Recipe tips' seen_tip_<key> facts (Recipes.tip_facts) are reserved the same way, here.
  def facts(facts, m, defs) when is_map(facts) and m != nil do
    Enum.reduce(defs["skill"], {facts, []}, fn {key, skill}, acc ->
      Enum.reduce(reserved(key, skill), acc, &reserve(&1, skill, &2))
    end)
    |> Loka.Content.Recipes.tip_facts(defs)
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
        do: {rel, ["qualification", "root"], s["qualification"]["root"]}
      )

  def check(nil, _, _, _), do: []

  def check(m, defs, {_, settings}, text) do
    caps = m["requires"]["capabilities"]

    Enum.flat_map(defs["skill"], &definition(&1, caps, text)) ++
      Enum.flat_map(defs["skill"], &growth/1) ++
      floor(m, defs) ++
      equipment(m, defs) ++ dodge(m, defs, settings) ++ defense_narration(defs, settings)
  end

  defp definition({_, {rel, _, s}}, caps, text) do
    capability(rel, caps) ++
      if(String.length(s["key"]) <= 58, do: [], else: [bad(at(rel, ["key"]))]) ++
      for(
        field <- ~w(label requirement),
        text != :unknown and not is_map_key(text, s[field]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, [field]), %{"target" => s[field]})
      )
  end

  defp definition(_, _, _), do: []

  # Toolbox row 5: growth thresholds strictly increase.
  defp growth({_, {rel, _, %{"growth" => g}}}) do
    increasing = g |> Enum.chunk_every(2, 1, :discard) |> Enum.all?(fn [a, b] -> a < b end)
    if increasing, do: [], else: [bad(at(rel, ["growth"]))]
  end

  defp growth(_), do: []

  # Toolbox rows 5 and G5: skill growth, an opposed check or a detail rating needs API 1.44.
  defp floor(m, defs) do
    used =
      Enum.any?(defs["skill"], &match?({_, {_, _, %{"growth" => _}}}, &1)) or
        Enum.any?(defs["recipe"], &match?({_, {_, _, %{"check" => %{"kind" => "opposed"}}}}, &1)) or
        Enum.any?(defs["room"], fn
          {_, {_, _, %{"details" => %{} = ds}}} ->
            Enum.any?(Map.values(ds), &is_map_key(&1, "rating"))

          _ ->
            false
        end)

    if used and version(m) < [1, 44],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp version(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

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
      )
  end

  defp weapon(_, _, _, _), do: []

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
          Enum.count(o["sequence"] || [], &(&1["op"] == "skill.acquire")) == 1,
        do: [],
        else: [bad(at(rel, steps ++ ["lesson_payment"]))]
      )
  end

  defp lesson(rel, steps, o, _, _) do
    grants = Enum.count(o["sequence"] || [], &(&1["op"] == "skill.acquire"))

    if grants > 0 and (grants != 1 or o["payment"] != nil),
      do: [bad(at(rel, steps ++ ["lesson_payment"]))],
      else: []
  end

  defp funded?(%{"role" => "npc", "npc" => ref}, resource, ctx) do
    case Loka.Content.Refs.resolve(ref, "npc", ctx.m, ctx.defs) do
      {_, _, npc} -> is_map_key(npc["resource_starts"] || %{}, resource["key"])
      _ -> true
    end
  end

  defp funded?(_, _, _), do: false

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
