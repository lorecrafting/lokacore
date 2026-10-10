defmodule Loka.Content.Reactions do
  @moduledoc """
  Reaction rules in a v2 source (reaction.schema.json ReactionRule; 21 §11; 06 §14), twin of
  the reaction checks of `kernel/ts/src/content/cartridge.ts` (lock) and `kernel/ts/src/content/cartridge_refs.ts`
  (references): each rule's owner (reaction@1), its trigger event's owner and each fact.assign's
  (fact@1, by its fact_changed) is required; each trigger filter names a definition of this cartridge
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

  @filters %{
    "fact" => "fact",
    "room" => "room",
    "quest" => "quest",
    "item" => "item",
    "victim" => "npc",
    "story_point" => "story_point",
    "barrier" => "barrier",
    "scene" => "scene",
    "kind" => "liquid"
  }
  @doc "Each trigger filter that names a definition (W1), with that definition's kind."
  @spec filters() :: %{String.t() => String.t()}
  def filters, do: @filters

  defp rule({rel, %{"on" => %{"event" => event} = on} = r}, ctx) do
    api(r, ctx.m) ++
      owned(at(rel, []), "reaction", ctx.kinds) ++
      owned(at(rel, ["on", "event"]), event, ctx.events) ++
      named(rel, on, ctx) ++
      Enum.flat_map(Enum.with_index(r["apply"]), &consequence(rel, &1, on, ctx))
  end

  defp named(rel, on, ctx),
    do:
      Enum.flat_map(Map.take(@filters, Map.keys(on)), fn {f, kind} ->
        reference(rel, ["on"], {f, kind}, on, ctx.m, ctx.defs)
      end)

  # ponytail: three finite reaction API floors stay in their one declaration check. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  defp api(r, manifest) do
    needed =
      r["on"]["event"] == "quest_resolved" or
        Enum.any?(r["apply"], &(&1["op"] == "quest.activate"))

    terminal = Enum.any?(r["apply"], &(&1["op"] in ~w(quest.resolve quest.fail)))
    suppression = Enum.any?(r["apply"], &(&1["op"] == "population.suppress"))

    version =
      manifest["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if (needed and version < [1, 8]) or (terminal and version < [1, 12]) or
         (suppression and version < [1, 35]),
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

  defp consequence(rel, {%{"op" => op} = s, i}, on, ctx)
       when op in ["quest.resolve", "quest.fail"] do
    path = at(rel, ["apply", i, "op"])
    restricted = if on["event"] == "fact_changed", do: [], else: [diag("OUTCOME_MISMATCH", path)]
    event = if op == "quest.resolve", do: owned(path, "quest_resolved", ctx.events), else: []
    restricted ++ event ++ reference(rel, ["apply", i], "quest", s, ctx.m, ctx.defs)
  end

  defp consequence(rel, {%{"op" => "population.suppress"} = s, i}, on, ctx) do
    path = at(rel, ["apply", i, "op"])
    restricted = if on["event"] == "fact_changed", do: [], else: [diag("OUTCOME_MISMATCH", path)]

    pack =
      case ctx.defs["population"][s["plan"]["key"]] do
        {_, _, %{"pack" => _}} -> []
        _ -> [diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "plan"]))]
      end

    typed =
      if on["fact"],
        do: reference(rel, ["on"], "fact", Map.put(on, "value", true), ctx.m, ctx.defs),
        else: []

    restricted ++
      typed ++ pack ++ reference(rel, ["apply", i], {"plan", "population"}, s, ctx.m, ctx.defs)
  end

  # Checked with world.levelling (Loka.Content.Levelling).
  defp consequence(_, {%{"op" => "experience.grant"}, _}, _, _), do: []

  defp consequence(rel, {%{"op" => "status.apply"} = s, i}, _, ctx),
    do: reference(rel, ["apply", i], "status", s, ctx.m, ctx.defs)

  defp consequence(rel, {s, i}, _, ctx),
    do:
      owned(at(rel, ["apply", i, "op"]), "fact_changed", ctx.events) ++
        reference(rel, ["apply", i], "fact", s, ctx.m, ctx.defs)
end
