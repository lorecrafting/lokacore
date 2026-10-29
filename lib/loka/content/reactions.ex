defmodule Loka.Content.Reactions do
  @moduledoc """
  Reaction rules in a v2 source (reaction.schema.json ReactionRule; 21 §11; 06 §14):
  each rule's owner (reaction@1), its trigger event's owner and each fact.assign's
  (fact@1, by its fact_changed) is required; each trigger filter names a definition of this cartridge
  and each fact.assign a fact with a value of its type. Its `when` tree is checked with every
  other (`conditions/1`, `Loka.Content.Resolve`).
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  import Loka.Content.Refs, only: [owners: 2, owned: 3, reference: 6, resolve: 4]

  @doc "Each schema-valid reaction's `when` root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, %{"when" => w}} <- all(defs), do: {rel, ["when"], w})

  defp all(defs), do: for({_, {rel, [], r}} <- defs["reaction"], do: {rel, r})

  @doc "Diagnostics for the schema-valid reactions of a v2 source with a valid manifest (else none)."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    caps = m["requires"]["capabilities"]
    ctx = %{m: m, defs: defs, text: text, kinds: {caps, owners(registry, ["definitions"])}}
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
    "attacker" => "npc",
    "target" => "npc",
    "witness" => "npc",
    "topic" => "topic"
  }
  @doc "Each trigger filter that names a definition (W1), with that definition's kind."
  @spec filters() :: %{String.t() => String.t()}
  def filters, do: @filters

  defp rule({rel, %{"on" => %{"event" => event} = on} = r}, ctx) do
    owned(at(rel, []), "reaction", ctx.kinds) ++
      owned(at(rel, ["on", "event"]), event, ctx.events) ++
      named(rel, on, ctx) ++
      instances(rel, on, ctx) ++
      steps(rel, Enum.with_index(r["apply"]), on, ctx)
  end

  # Homestead hs-1: a second replenish.run of one entry in a rule would pick the items the first
  # moved.
  defp steps(rel, apply, on, ctx) do
    runs = for {%{"op" => "replenish.run", "key" => k}, i} <- apply, do: {k, i}

    Enum.flat_map(apply, &consequence(rel, &1, on, ctx)) ++
      for {{k, i}, n} <- Enum.with_index(runs),
          Enum.any?(Enum.take(runs, n), &(elem(&1, 0) == k)),
          do: diag("DUPLICATE_DEFINITION", at(rel, ["apply", i, "key"]))
  end

  defp named(rel, on, ctx),
    do:
      Enum.flat_map(Map.take(@filters, Map.keys(on)), fn {f, kind} ->
        reference(rel, ["on"], {f, kind}, on, ctx.m, ctx.defs)
      end)

  # A spawn template has no instance to enter (row W3), attack (loka-kgd.79), be hit (row 39) or
  # witness (row FD5).
  defp instances(rel, on, ctx),
    do:
      Enum.flat_map(Map.take(on, ["npc", "attacker", "target", "witness"]), fn {f, n} ->
        instance(at(rel, ["on", f]), n, ctx)
      end)

  defp instance(path, n, ctx) do
    case resolve(n, "npc", ctx.m, ctx.defs) do
      {_, _, %{"spawn_template" => true}} ->
        [diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})]

      _ ->
        []
    end
  end

  defp consequence(rel, {%{"op" => "quest.activate"} = s, i}, on, ctx) do
    path = at(rel, ["apply", i, "op"])

    # loka-kgd.150.2: only a trigger whose subject resolves to a character activates.
    restricted =
      if on["event"] in ["quest_resolved", "rested", "entity_entered_room"],
        do: [],
        else: [diag("OUTCOME_MISMATCH", path)]

    restricted ++
      owned(path, "quest_activated", ctx.events) ++
      reference(rel, ["apply", i], "quest", s, ctx.m, ctx.defs)
  end

  defp consequence(rel, {%{"op" => op} = s, i}, _on, ctx)
       when op in ["quest.resolve", "quest.fail"] do
    # Legal on any trigger; the kernel acts per holder (loka-kgd.150.2).
    path = at(rel, ["apply", i, "op"])
    event = if op == "quest.resolve", do: owned(path, "quest_resolved", ctx.events), else: []
    event ++ reference(rel, ["apply", i], "quest", s, ctx.m, ctx.defs)
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

  # Settle S3-1: a narrate line's text key is in the catalog (:unknown when the text failed).
  defp consequence(rel, {%{"op" => "narrate", "text" => key}, i}, _, ctx) do
    if ctx.text == :unknown or is_map_key(ctx.text, key),
      do: [],
      else: [diag("UNRESOLVED_REFERENCE", at(rel, ["apply", i, "text"]), %{"target" => key})]
  end

  defp consequence(rel, {%{"op" => "status.apply"} = s, i}, on, ctx),
    do:
      revealed(rel, s, i, on, ctx) ++
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
  # barrier, or on every barrier carrying the tag (BARRIER_UNREACHABLE_KEY).
  defp consequence(rel, {%{"op" => "barrier.set"} = s, i}, on, ctx) do
    owned(at(rel, ["apply", i, "op"]), "barrier_changed", ctx.events) ++
      if(s["barrier"], do: reference(rel, ["apply", i], "barrier", s, ctx.m, ctx.defs), else: []) ++
      lockout(rel, s, i, hit(s, on["room"], ctx))
  end

  # Row 41 (decay): the sink room resolves; the step emits no event.
  defp consequence(rel, {%{"op" => "item.move"} = s, i}, _, ctx),
    do: reference(rel, ["apply", i], "room", s, ctx.m, ctx.defs)

  # Row FD5 (loka-kgd.22): a named NPC and room resolve, the NPC no spawn template; the step emits
  # entity_entered_room. Settle S4-1: a plan resolves, never with npc and only with room.
  defp consequence(rel, {%{"op" => "npc.move"} = s, i}, _, ctx) do
    owned(at(rel, ["apply", i, "op"]), "entity_entered_room", ctx.events) ++
      for(
        f <- ~w(npc room),
        s[f],
        d <- reference(rel, ["apply", i], f, s, ctx.m, ctx.defs),
        do: d
      ) ++
      if(s["npc"], do: instance(at(rel, ["apply", i, "npc"]), s["npc"], ctx), else: []) ++
      plan_move(rel, s, i, ctx)
  end

  # Row 37a (phased world events): the plan resolves; the step emits no event.
  defp consequence(rel, {%{"op" => "population.spawn"} = s, i}, _, ctx),
    do: reference(rel, ["apply", i], {"plan", "population"}, s, ctx.m, ctx.defs)

  # Homestead hs-1: the replenish entry resolves; the step emits no event.
  defp consequence(rel, {%{"op" => "replenish.run"} = s, i}, _, ctx),
    do: reference(rel, ["apply", i], {"key", "replenish"}, s, ctx.m, ctx.defs)

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

  defp plan_move(rel, %{"plan" => _} = s, i, ctx) do
    reference(rel, ["apply", i], {"plan", "population"}, s, ctx.m, ctx.defs) ++
      if(s["npc"] || !s["room"],
        do: [
          diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "plan"]), %{"error" => "invalid_value"})
        ],
        else: []
      )
  end

  defp plan_move(_, _, _, _), do: []

  # Row 16: entry engagement cures concealment in the same move, so an entry reaction may not apply one.
  defp revealed(rel, %{"status" => %{"key" => k}}, i, %{"event" => "entity_entered_room"}, ctx) do
    case (ctx.defs["status"] || %{})[k] do
      {_, _, %{"concealment" => _}} -> [diag("OUTCOME_MISMATCH", at(rel, ["apply", i, "op"]))]
      _ -> []
    end
  end

  defp revealed(_, _, _, _, _), do: []

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
