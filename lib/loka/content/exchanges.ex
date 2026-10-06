defmodule Loka.Content.Exchanges do
  @moduledoc "Finite authored stock and equal-count exchanges; twin of cartridge_exchange.ts."
  import Loka.Content.Source, only: [diag: 2, at: 2, ref: 3]
  alias Loka.Content.Refs

  def check(nil, _), do: []

  def check(m, defs) do
    patches = patches(defs)

    Enum.flat_map(patches, &patch(m, defs, &1)) ++
      for({_, {rel, [], q}} <- defs["quest"], d <- quest(m, defs, patches, rel, q), do: d) ++
      dialogue_choices(m, defs)
  end

  defp patches(defs),
    do:
      for(
        {_, {rel, [], r}} <- defs["room"],
        {k, d} <- Map.get(r, "details", %{}),
        d["harvest"],
        do: {rel, r, k, d["harvest"]}
      )

  defp patch(m, defs, {rel, r, k, h}) do
    steps = ["details", k, "harvest"]

    api(m, at(rel, steps)) ++
      stock(m, defs, h["items"], ref(r["key"], "room", m), at(rel, steps ++ ["items"])) ++
      careful(m, defs, h, at(rel, steps ++ ["careful"]))
  end

  defp careful(m, defs, %{"careful" => c, "items" => items}, path) do
    valid =
      m["requires"]["capabilities"]["skills"] == 1 and
        match?({_, _, _}, Refs.resolve(c["skill"], "skill", m, defs)) and
        c["count"] <= length(Enum.uniq(items))

    if valid and careful_action?(m, defs, c["action"]),
      do: [],
      else: [diag("OUTCOME_MISMATCH", path)]
  end

  defp careful(_, _, _, _), do: []

  defp careful_action?(m, defs, key) do
    case Refs.resolve(ref(key, "action", m), "action", m, defs) do
      {_, _, a} ->
        a["command"] == "harvest" and a["input"] == ["method"] and
          a["target"] == %{"kind" => "entity", "scopes" => ["inspectable_details"]}

      _ ->
        false
    end
  end

  defp dialogue_choices(m, defs) do
    for {_, {rel, [], d}} <- defs["dialogue"],
        {k, o} <- d["choices"],
        o["exchange"],
        not valid_choice?(m, defs, d, o),
        do: diag("OUTCOME_MISMATCH", at(rel, ["choices", k, "exchange"]))
  end

  defp api(m, path) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if version < [1, 17], do: [diag("KERNEL_API_RANGE_INVALID", path)], else: []
  end

  defp stock(m, defs, items, holder, path) do
    duplicates =
      if length(Enum.uniq(items)) != length(items),
        do: [diag("DUPLICATE_DEFINITION", path)],
        else: []

    duplicates ++
      for i <- items, not stocked?(m, defs, i, holder), do: diag("OUTCOME_MISMATCH", path)
  end

  defp stocked?(m, defs, item, holder) do
    case Refs.resolve(item, "item", m, defs) do
      {_, _, i} ->
        i["location"]["in"] == holder["kind"] and i["location"][holder["kind"]] == holder and
          is_integer(i["mass_grams"]) and i["mass_grams"] > 0

      _ ->
        false
    end
  end

  defp quest(_, _, _, rel, %{"repeatable" => true} = q) when not is_map_key(q, "exchange"),
    do: [diag("OUTCOME_MISMATCH", at(rel, ["repeatable"]))]

  defp quest(_, _, _, _, q) when not is_map_key(q, "exchange"), do: []

  defp quest(m, defs, patches, rel, q) do
    x = q["exchange"]
    path = at(rel, ["exchange"])

    refs =
      for {field, kind} <- [{"npc", "npc"}, {"contribution", "fact"}, {"faction", "fact"}],
          d <- Refs.reference(rel, ["exchange"], {field, kind}, x, m, defs),
          do: d

    valid = valid_quest?(q) and tuning?(m, defs, x)

    api(m, path) ++
      refs ++
      quest_stock(m, defs, patches, x, path) ++
      if(valid, do: [], else: [diag("OUTCOME_MISMATCH", path)])
  end

  defp quest_stock(m, defs, patches, x, path) do
    outgoing =
      case Enum.find(patches, fn {_, _, _, h} -> h["items"] == x["outgoing"] end) do
        {_, r, _, _} -> stock(m, defs, x["outgoing"], ref(r["key"], "room", m), path)
        _ -> [diag("OUTCOME_MISMATCH", path)]
      end

    all = x["outgoing"] ++ x["incoming"]

    duplicate =
      if length(Enum.uniq(all)) != length(all), do: [diag("DUPLICATE_DEFINITION", path)], else: []

    outgoing ++ stock(m, defs, x["incoming"], x["npc"], path) ++ duplicate
  end

  defp valid_quest?(q) do
    x = q["exchange"]

    q["repeatable"] == true and q["deadline"] == nil and q["offer"] == nil and
      q["objective"]["evidence"] == "current_state" and
      length(x["outgoing"]) == length(x["incoming"]) and x["quantity"] <= length(x["outgoing"])
  end

  defp tuning?(m, defs, x) do
    case {Refs.resolve(x["contribution"], "fact", m, defs),
          Refs.resolve(x["faction"], "fact", m, defs)} do
      {{_, _,
        %{
          "scopes" => ["player"],
          "value_type" => %{"type" => "int", "minimum" => 0, "default" => 0, "maximum" => cap}
        }},
       {_, _,
        %{
          "scopes" => ["player"],
          "value_type" => %{"type" => "int", "minimum" => lo, "maximum" => hi}
        }}} ->
        x["increment"] <= cap and lo <= 0 and hi >= cap and x["contribution"] != x["faction"]

      _ ->
        false
    end
  end

  defp valid_choice?(m, defs, d, o) do
    case Refs.resolve(d["quest"], "quest", m, defs) do
      {_, _, %{"exchange" => x}} ->
        d["npc"] == x["npc"] and
          not Enum.any?(~w(accept receive hand_over payment sequence escort), &is_map_key(o, &1))

      _ ->
        false
    end
  end
end
