defmodule Loka.Content.Reactions do
  @moduledoc """
  Reaction rules in a v2 source (reaction.schema.json ReactionRule; 21 §11; 06 §14), twin of
  the reaction checks of `kernel/ts/src/content/cartridge.ts` (lock) and `kernel/ts/src/content/cartridge_refs.ts`
  (references): each rule's owner (reaction@1), its trigger event's owner and each fact.assign's
  (fact@1, by its fact_changed) is required; its trigger names a fact or room of this cartridge
  and each fact.assign a fact with a value of its type. Its `when` tree is checked with every
  other (`conditions/1`, `Loka.Content.Checks`).
  """
  import Loka.Content.Source, only: [at: 2, diag: 2]
  import Loka.Content.Refs, only: [owners: 2, owned: 3, reference: 6]

  @doc "Each schema-valid reaction's `when` root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, %{"when" => w}} <- all(defs), do: {rel, ["when", "root"], w["root"]})

  defp all(defs), do: for({_, {rel, [], r}} <- defs["reaction"], do: {rel, r})

  @doc "Diagnostics for the schema-valid reactions of a v2 source with a valid manifest (else none)."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, _, registry) do
    caps = m["requires"]["capabilities"]
    ctx = %{m: m, defs: defs, kinds: {caps, owners(registry, ["definitions"])}}
    ctx = Map.put(ctx, :events, {caps, owners(registry, ["events"])})
    Enum.flat_map(all(defs), &rule(&1, ctx))
  end

  defp rule({rel, %{"on" => %{"event" => event} = on} = r}, ctx) do
    kind =
      %{"fact_changed" => "fact", "entity_entered_room" => "room", "quest_resolved" => "quest"}[
        event
      ]

    api(r, ctx.m) ++
      owned(at(rel, []), "reaction", ctx.kinds) ++
      owned(at(rel, ["on", "event"]), event, ctx.events) ++
      reference(rel, ["on"], kind, on, ctx.m, ctx.defs) ++
      Enum.flat_map(Enum.with_index(r["apply"]), &consequence(rel, &1, on, ctx))
  end

  defp api(r, manifest) do
    needed =
      r["on"]["event"] == "quest_resolved" or
        Enum.any?(r["apply"], &(&1["op"] == "quest.activate"))

    version =
      manifest["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if needed and version < [1, 8],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp consequence(rel, {%{"op" => "quest.activate"} = s, i}, on, ctx) do
    path = at(rel, ["apply", i, "op"])

    restricted =
      if on["event"] == "quest_resolved", do: [], else: [diag("OUTCOME_MISMATCH", path)]

    restricted ++
      owned(path, "quest_activated", ctx.events) ++
      reference(rel, ["apply", i], "quest", s, ctx.m, ctx.defs)
  end

  defp consequence(rel, {s, i}, _, ctx),
    do:
      owned(at(rel, ["apply", i, "op"]), "fact_changed", ctx.events) ++
        reference(rel, ["apply", i], "fact", s, ctx.m, ctx.defs)
end
