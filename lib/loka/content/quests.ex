defmodule Loka.Content.Quests do
  @moduledoc """
  Quests in a v2 source (quest.schema.json QuestDefinition; 06 §2, §8), twin of
  `kernel/ts/src/content/cartridge_quests.ts`: each quest's owning capability is required (quest@1, by
  its quest_activated, as a recipe's check by check@1's events), its key is no registered
  command's, action's or recipe's (DUPLICATE_DEFINITION: its offer is an ActionSet identity), its
  title, its offer's label (the offer is optional) and all journal texts have catalog entries
  (unless the catalog was rejected, `:unknown`), and a post_activation_event objective names an item of this cartridge. Its policy trees are checked
  with every other (`conditions/1`, `Loka.Content.Checks`).
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6]

  @doc "Each schema-valid quest's offer policy root and current_state objective's, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs) do
    for {rel, q} <- all(defs), {steps, p} <- policies(q), do: {rel, steps, p}
  end

  defp policies(q) do
    base =
      for {field, %{"policy" => p}} <- [{"offer", q["offer"]}, {"objective", q["objective"]}],
          do: {[field, "policy", "root"], p["root"]}

    base ++
      for {v, i} <- Enum.with_index(get_in(q, ["journal", "active_variants"]) || []),
          do: {["journal", "active_variants", i, "when", "root"], v["when"]["root"]}
  end

  defp all(defs), do: for({_, {rel, [], q}} <- defs["quest"], do: {rel, q})

  @doc "Diagnostics for the schema-valid quests of a v2 source with a valid manifest (else none)."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    events = {m["requires"]["capabilities"], owners(registry, ["events"])}
    keys = for kind <- ~w(action recipe), {_, {_, [], d}} <- defs[kind], do: d["key"]
    taken = MapSet.new(commands() ++ keys)

    Enum.flat_map(
      all(defs),
      &quest(&1, %{m: m, defs: defs, text: text, events: events, taken: taken})
    )
  end

  defp quest({rel, q}, ctx) do
    duplicate =
      if q["key"] in ctx.taken, do: [diag("DUPLICATE_DEFINITION", at(rel, []))], else: []

    owned(at(rel, []), "quest_activated", ctx.events) ++
      duplicate ++
      texts(rel, q, ctx.text) ++
      item(rel, q["objective"], ctx.m, ctx.defs) ++
      deadline(rel, q["deadline"], ctx) ++
      attempts(rel, q, ctx)
  end

  defp attempts(rel, q, ctx),
    do:
      Loka.Content.Patrol.quest(rel, q, ctx) ++
        Loka.Content.Expedition.quest(rel, q, ctx) ++
        hints(rel, q, ctx.m)

  # Toolbox row W24: a deadline is legacy (S2: at, fact, trust_fact and trust_amount, no after) or
  # generic (exactly one of after or at, no legacy field, kernel_api 1.46); any other shape is
  # SCHEMA_VIOLATION invalid_value at the deadline. Twin of cartridge_quests.ts deadline.
  defp deadline(_, nil, _), do: []

  defp deadline(rel, d, ctx) do
    legacy = Enum.count(~w(fact trust_fact trust_amount), &is_map_key(d, &1))

    cond do
      legacy == 3 and is_map_key(d, "at") and not is_map_key(d, "after") ->
        Enum.flat_map(
          ~w(fact trust_fact),
          &reference(rel, ["deadline"], {&1, "fact"}, d, ctx.m, ctx.defs)
        )

      legacy > 0 or is_map_key(d, "after") == is_map_key(d, "at") ->
        [diag("SCHEMA_VIOLATION", at(rel, ["deadline"]), %{"error" => "invalid_value"})]

      api(ctx.m) < [1, 46] ->
        [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")]

      true ->
        []
    end
  end

  defp texts(_, _, :unknown), do: []

  defp texts(rel, q, text) do
    offer = for %{"label" => label} <- [q["offer"]], do: {["offer", "label"], label}

    for {steps, key} <- [{["title"], q["title"]} | offer] ++ journal(q["journal"]),
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
  end

  defp journal(nil), do: []

  defp journal(j) do
    stages =
      for k <- ~w(active objectives_met resolved failed abandoned), do: {["journal", k], j[k]}

    outcomes = for {k, v} <- j["outcomes"] || %{}, do: {["journal", "outcomes", k], v}

    variants =
      for {v, i} <- Enum.with_index(Map.get(j, "active_variants", [])),
          do: {["journal", "active_variants", i, "text"], v["text"]}

    stages ++ outcomes ++ variants ++ hint_texts(j["hints"] || %{})
  end

  defp hint_texts(h) do
    for {stage, list} <- h,
        {x, i} <- Enum.with_index(list),
        do: {["journal", "hints", stage, i, "text"], x["text"]}
  end

  # Toolbox row W23: each stage's minutes strictly ascend; real minutes need the real_elapsed time
  # policy (INVALID_TIME_POLICY); hints need kernel_api 1.46; an empty hints object is
  # too_few_items (the subset has no minProperties). Twin of cartridge_quests.ts hints.
  defp hints(rel, %{"journal" => %{"hints" => h}}, _) when h == %{},
    do: [diag("SCHEMA_VIOLATION", at(rel, ["journal", "hints"]), %{"error" => "too_few_items"})]

  defp hints(rel, %{"journal" => %{"hints" => h}}, m) do
    order =
      for {stage, list} <- h,
          list
          |> Enum.map(& &1["after"])
          |> Enum.chunk_every(2, 1, :discard)
          |> Enum.any?(fn [a, b] -> b <= a end),
          do:
            diag("SCHEMA_VIOLATION", at(rel, ["journal", "hints", stage]), %{
              "error" => "invalid_value"
            })

    policy =
      if get_in(m, ["time_policy", "profile"]) != "real_elapsed",
        do: [diag("INVALID_TIME_POLICY", at(rel, ["journal", "hints"]))],
        else: []

    floor =
      if api(m) < [1, 46],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    order ++ policy ++ floor
  end

  defp hints(_, _, _), do: []

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

  defp item(rel, %{"item_acquired" => _} = o, m, defs),
    do: reference(rel, ["objective"], {"item_acquired", "item"}, o, m, defs)

  defp item(_, _, _, _), do: []
end
