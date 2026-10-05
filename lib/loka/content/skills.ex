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

  def facts(facts, m, defs) when is_map(facts) and m != nil do
    Enum.reduce(defs["skill"], {facts, []}, fn {key, skill}, {acc, ds} ->
      name = "skill_" <> key
      authored = for {rel, steps, _} <- [acc[name]], do: diag("RESERVED_FACT", at(rel, steps))
      value = if skill == :invalid, do: :invalid, else: {"cartridge.json", [], spec(key)}
      {Map.put(acc, name, value), ds ++ authored}
    end)
  end

  def facts(facts, _, _), do: {facts, []}

  def conditions(defs),
    do:
      for(
        {_, {rel, _, s}} <- defs["skill"],
        do: {rel, ["qualification", "root"], s["qualification"]["root"]}
      )

  def check(nil, _, _, _), do: []

  def check(m, defs, {_, settings}, text) do
    caps = m["requires"]["capabilities"]

    Enum.flat_map(defs["skill"], fn
      {_, {rel, _, s}} ->
        if(caps["skills"] == 1 and caps["fact"] == 1 and caps["policy"] == 1,
          do: [],
          else: [diag("UNDECLARED_CAPABILITY", at(rel, []), %{"capability" => "skills"})]
        ) ++
          if(String.length(s["key"]) <= 58, do: [], else: [bad(at(rel, ["key"]))]) ++
          for(
            field <- ~w(label requirement),
            text != :unknown and not is_map_key(text, s[field]),
            do: diag("UNRESOLVED_REFERENCE", at(rel, [field]), %{"target" => s[field]})
          )

      _ ->
        []
    end) ++ equipment(m, defs) ++ dodge(m, defs, settings)
  end

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

    funded =
      case teacher do
        %{"role" => "npc", "npc" => ref} ->
          case Loka.Content.Refs.resolve(ref, "npc", ctx.m, ctx.defs) do
            {_, _, npc} -> is_map_key(npc["resource_starts"] || %{}, p["resource"]["key"])
            _ -> true
          end

        _ ->
          false
      end

    reference(rel, steps ++ ["lesson_payment"], {"resource", "resource"}, p, ctx.m, ctx.defs) ++
      if(
        funded and teacher["npc"] == d["npc"] and !o["payment"] and
          Enum.count(o["sequence"] || [], &(&1["op"] == "skill.acquire")) == 1,
        do: [],
        else: [bad(at(rel, steps ++ ["lesson_payment"]))]
      )
  end

  defp lesson(rel, steps, o, _, _) do
    if Enum.any?(o["sequence"] || [], &(&1["op"] == "skill.acquire")),
      do: [bad(at(rel, steps ++ ["lesson_payment"]))],
      else: []
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
