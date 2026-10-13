defmodule Loka.Content.Reactions do
  @moduledoc """
  Reaction rules in a v2 source (reaction.schema.json ReactionRule; 21 §11; 06 §14), twin of
  the reaction checks of `kernel/ts/src/content/cartridge.ts` (lock) and `kernel/ts/src/content/cartridge_refs.ts`
  (references): each rule's owner (reaction@1), its trigger event's owner and each fact.assign's
  (fact@1, by its fact_changed) is required; each trigger filter names a definition of this cartridge
  and each fact.assign a fact with a value of its type. Its `when` tree is checked with every
  other (`conditions/1`, `Loka.Content.Checks`).
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  import Loka.Content.Refs, only: [owners: 2, owned: 3, reference: 6, resolve: 4]

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
    "status" => "status",
    "kind" => "liquid",
    "npc" => "npc",
    "attacker" => "npc"
  }
  @doc "Each trigger filter that names a definition (W1), with that definition's kind."
  @spec filters() :: %{String.t() => String.t()}
  def filters, do: @filters

  defp rule({rel, %{"on" => %{"event" => event} = on} = r}, ctx) do
    api(r, ctx.m) ++
      owned(at(rel, []), "reaction", ctx.kinds) ++
      owned(at(rel, ["on", "event"]), event, ctx.events) ++
      named(rel, on, ctx) ++
      instances(rel, on, ctx) ++
      Enum.flat_map(Enum.with_index(r["apply"]), &consequence(rel, &1, on, ctx))
  end

  defp named(rel, on, ctx),
    do:
      Enum.flat_map(Map.take(@filters, Map.keys(on)), fn {f, kind} ->
        reference(rel, ["on"], {f, kind}, on, ctx.m, ctx.defs)
      end)

  # A spawn template has no instance to enter (row W3) or attack (loka-kgd.79).
  defp instances(rel, on, ctx),
    do: Enum.flat_map(Map.take(on, ["npc", "attacker"]), &instance(rel, &1, ctx))

  defp instance(rel, {f, n}, ctx) do
    case resolve(n, "npc", ctx.m, ctx.defs) do
      {_, _, %{"spawn_template" => true}} ->
        [diag("SCHEMA_VIOLATION", at(rel, ["on", f]), %{"error" => "invalid_value"})]

      _ ->
        []
    end
  end

  # The kernel_api minor (major 1) each consequence op needs; twin of FLOORS in
  # kernel/ts/src/content/cartridge_reactions.ts.
  @floors %{
    "quest.activate" => 8,
    "quest.resolve" => 12,
    "quest.fail" => 12,
    "population.suppress" => 35,
    "status.cure" => 53,
    "barrier.set" => 56,
    "item.move" => 77
  }

  # The kernel_api minor each trigger event needs: spoken 1.48 (G9), status_applied 1.53 (status
  # reader 2, row G3).
  @events %{"quest_resolved" => 8, "spoken" => 48, "status_applied" => 53}

  # One diagnostic per rule below its highest floor; the entrant filter needs 1.47 (row W3), the
  # attacker filter 1.58 (loka-kgd.79), a co_present status.apply 1.50 (W21), with a tag 1.56 (W22),
  # naming a room 1.65 (status reader 9).
  defp api(r, manifest) do
    floor =
      Enum.max([
        Map.get(@events, r["on"]["event"], 0),
        if(Map.has_key?(r["on"], "npc"), do: 47, else: 0),
        if(Map.has_key?(r["on"], "attacker"), do: 58, else: 0)
        | Enum.map(r["apply"], &step_floor/1)
      ])

    version =
      manifest["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if floor > 0 and version < [1, floor],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp step_floor(%{"op" => "status.apply", "room" => _}), do: 65
  defp step_floor(%{"tag" => _}), do: 56
  defp step_floor(%{"co_present" => _}), do: 50
  defp step_floor(s), do: Map.get(@floors, s["op"], 0)

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
    do:
      reference(rel, ["apply", i], "status", s, ctx.m, ctx.defs) ++
        if(s["item"], do: reference(rel, ["apply", i], "item", s, ctx.m, ctx.defs), else: []) ++
        if(s["item"] && s["co_present"],
          do: [
            diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "item"]), %{"error" => "invalid_value"})
          ],
          else: []
        ) ++
        room(rel, s, i, ctx) ++
        listener(rel, s, i, ctx)

  # Row W22 (loka-kgd.96): a named barrier resolves; to locked needs a key_item on the named
  # barrier, or on every barrier carrying the tag (BARRIER_UNREACHABLE_KEY); twin of barrierSet.
  defp consequence(rel, {%{"op" => "barrier.set"} = s, i}, on, ctx) do
    owned(at(rel, ["apply", i, "op"]), "barrier_changed", ctx.events) ++
      if(s["barrier"], do: reference(rel, ["apply", i], "barrier", s, ctx.m, ctx.defs), else: []) ++
      lockout(rel, s, i, hit(s, on["room"], ctx))
  end

  # Row 41 (decay): the sink room resolves; the step emits no event.
  defp consequence(rel, {%{"op" => "item.move"} = s, i}, _, ctx),
    do: reference(rel, ["apply", i], "room", s, ctx.m, ctx.defs)

  # Status reader 3 (row G3): the subject's status.
  defp consequence(rel, {%{"op" => "status.cure"} = s, i}, _, ctx),
    do: reference(rel, ["apply", i], "status", s, ctx.m, ctx.defs)

  defp consequence(rel, {s, i}, _, ctx),
    do:
      owned(at(rel, ["apply", i, "op"]), "fact_changed", ctx.events) ++
        reference(rel, ["apply", i], "fact", s, ctx.m, ctx.defs) ++
        for(
          f <- ~w(npc item),
          s[f],
          d <- reference(rel, ["apply", i], f, s, ctx.m, ctx.defs),
          do: d
        )

  defp hit(s, room, ctx) do
    if s["barrier"],
      do: for({_, _, b} <- [resolve(s["barrier"], "barrier", ctx.m, ctx.defs)], do: b),
      else: for(b <- exit_barriers(room, ctx), s["tag"] in (b["tags"] || []), do: b)
  end

  defp lockout(rel, s, i, hit) do
    if s["to"] == "locked" and Enum.any?(hit, &(!&1["key_item"])),
      do: [diag("BARRIER_UNREACHABLE_KEY", at(rel, ["apply", i, "to"]))],
      else: []
  end

  # A tag reaches only barriers on exits (setBarrier), never a container's lid, and only the event
  # room's: the trigger's room filter fixes it, else any room may be it (loka-kgd.103).
  defp exit_barriers(room, ctx) do
    rooms =
      cond do
        room -> [resolve(room, "room", ctx.m, ctx.defs)]
        is_map(ctx.defs["room"]) -> Map.values(ctx.defs["room"])
        true -> []
      end

    for {_, _, r} <- rooms,
        {_, e} <- r["exits"] || %{},
        e["barrier"],
        {_, _, b} <- [resolve(e["barrier"], "barrier", ctx.m, ctx.defs)],
        do: b
  end

  # Row 42: a step names one holder, and a spawn template has no instance to take it; a co_present
  # step (row W21) names none.
  defp listener(rel, %{"npc" => n} = s, i, ctx) do
    case resolve(n, "npc", ctx.m, ctx.defs) do
      {_, _, npc} ->
        if npc["spawn_template"] || s["item"] || s["co_present"],
          do: [
            diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "npc"]), %{"error" => "invalid_value"})
          ],
          else: []

      _ ->
        reference(rel, ["apply", i], "npc", s, ctx.m, ctx.defs)
    end
  end

  defp listener(_, _, _, _), do: []

  # Status reader 9: a named room resolves and is the step's only holder.
  defp room(rel, %{"room" => _} = s, i, ctx),
    do:
      reference(rel, ["apply", i], "room", s, ctx.m, ctx.defs) ++
        if(s["item"] || s["npc"] || s["co_present"],
          do: [
            diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "room"]), %{"error" => "invalid_value"})
          ],
          else: []
        )

  defp room(_, _, _, _), do: []
end
