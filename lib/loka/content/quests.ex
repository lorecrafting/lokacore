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
    for {rel, q} <- all(defs),
        {field, %{"policy" => p}} <- [{"offer", q["offer"]}, {"objective", q["objective"]}],
        do: {rel, [field, "policy", "root"], p["root"]}
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
      duplicate ++ texts(rel, q, ctx.text) ++ item(rel, q["objective"], ctx.m, ctx.defs)
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
    stages ++ outcomes
  end

  defp item(rel, %{"item_acquired" => _} = o, m, defs),
    do: reference(rel, ["objective"], {"item_acquired", "item"}, o, m, defs)

  defp item(_, _, _, _), do: []
end
