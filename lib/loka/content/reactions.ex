defmodule Loka.Content.Reactions do
  @moduledoc """
  Reaction rules in a v2 source (reaction.schema.json ReactionRule; 21 §11; 06 §14):
  each rule's owner (reaction@1) and its trigger event's owner is required, and each trigger
  filter names a definition of this cartridge. Its steps' ops, owning events and references are
  `Loka.Content.Steps` (context :reaction); this module adds the reaction-only rules. Its `when`
  tree is checked with every other (`conditions/1`, `Loka.Content.Resolve`).
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
    Enum.flat_map(all(defs), &(rule(&1, ctx) ++ timed_status(&1, ctx)))
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
      Loka.Content.Steps.check(rel, ["steps"], r["steps"], :reaction, ctx) ++
      steps(rel, Enum.with_index(r["steps"]), on, ctx)
  end

  # The action's completion or its own custom event runs inside it; the status row would start before
  # a duration's time.advance, which faults at runtime (its own steps: `Loka.Content.ScriptedActions`).
  # Refuses only a path known to run: `after` writes a job instead; a `when`, a `witness` or a fact_changed
  # may not fire; a status.apply with no job crosses nothing.
  defp timed_status({rel, %{"steps" => steps} = r}, %{m: m, defs: defs}) do
    for {%{"op" => "status.apply"} = step, i} <- Enum.with_index(steps),
        inside_timed?(r, defs),
        not Loka.Content.Status.no_job?(step, m, defs) do
      diag("SCHEMA_VIOLATION", at(rel, ["steps", i]), %{"why" => "duration_status"})
    end
  end

  defp inside_timed?(%{"on" => on} = r, defs) do
    not is_map_key(r, "after") and not is_map_key(r, "when") and not is_map_key(on, "witness") and
      Enum.any?(
        for({_, {_, [], %{"duration" => d} = a}} <- defs["scripted_action"] || %{}, d > 0, do: a),
        &inside?(on, &1)
      )
  end

  defp inside?(%{"event" => "action_completed"} = on, action),
    do: on["action"] in [nil, action["key"]]

  defp inside?(%{"event" => "custom_event", "custom" => custom}, action),
    do:
      Enum.any?(action["outcomes"], fn {_, o} ->
        Enum.any?(o["steps"], &(&1["event"] == custom))
      end)

  defp inside?(_, _), do: false

  # Homestead hs-1: a second replenish.run of one entry in a rule would pick the items the first
  # moved.
  defp steps(rel, steps, on, ctx) do
    runs = for {%{"op" => "replenish.run", "replenish" => k}, i} <- steps, do: {k, i}

    Enum.flat_map(steps, &consequence(rel, &1, on, ctx)) ++
      for {{k, i}, n} <- Enum.with_index(runs),
          Enum.any?(Enum.take(runs, n), &(elem(&1, 0) == k)),
          do: diag("DUPLICATE_DEFINITION", at(rel, ["steps", i, "replenish"]))
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

  # loka-kgd.150.2: only a trigger whose subject resolves to a character activates.
  defp consequence(rel, {%{"op" => "quest.activate"}, i}, on, _) do
    if on["event"] in ["quest_resolved", "rested", "entity_entered_room"],
      do: [],
      else: [diag("OUTCOME_MISMATCH", at(rel, ["steps", i, "op"]))]
  end

  defp consequence(rel, {%{"op" => "population.suppress"} = s, i}, on, ctx) do
    path = at(rel, ["steps", i, "op"])
    restricted = if on["event"] == "fact_changed", do: [], else: [diag("OUTCOME_MISMATCH", path)]

    pack =
      case ctx.defs["population"][s["plan"]["key"]] do
        {_, _, %{"pack" => _}} -> []
        _ -> [diag("SCHEMA_VIOLATION", at(rel, ["steps", i, "plan"]))]
      end

    typed =
      if on["fact"],
        do: reference(rel, ["on"], "fact", Map.put(on, "value", true), ctx.m, ctx.defs),
        else: []

    restricted ++
      typed ++ pack ++ reference(rel, ["steps", i], {"plan", "population"}, s, ctx.m, ctx.defs)
  end

  # Settle S3-1: a narrate line's text key is in the catalog (:unknown when the text failed).
  defp consequence(rel, {%{"op" => "narrate", "text" => key}, i}, _, ctx) do
    if ctx.text == :unknown or is_map_key(ctx.text, key),
      do: [],
      else: [diag("UNRESOLVED_REFERENCE", at(rel, ["steps", i, "text"]), %{"target" => key})]
  end

  defp consequence(rel, {%{"op" => "status.apply"} = s, i}, on, ctx),
    do:
      revealed(rel, s, i, on, ctx) ++
        if(s["item"] && s["co_present"],
          do: [
            diag("SCHEMA_VIOLATION", at(rel, ["steps", i, "item"]), %{"error" => "invalid_value"})
          ],
          else: []
        ) ++
        room(rel, s, i) ++
        listener(rel, s, i, ctx)

  # Row W22 (loka-kgd.96): a named barrier resolves; to locked needs a key_item on the named
  # barrier, or on every barrier carrying the tag (BARRIER_UNREACHABLE_KEY).
  defp consequence(rel, {%{"op" => "barrier.set"} = s, i}, on, ctx),
    do: lockout(rel, s, i, hit(s, on["room"], ctx))

  # Row FD5 (loka-kgd.22): the NPC is no spawn template. Settle S4-1: a plan never with npc and
  # only with room.
  defp consequence(rel, {%{"op" => "npc.move"} = s, i}, _, ctx) do
    if(s["npc"], do: instance(at(rel, ["steps", i, "npc"]), s["npc"], ctx), else: []) ++
      plan_move(rel, s, i)
  end

  # NPC emotes (G9): the emoter is no spawn template; to subject needs the emote's to forms.
  defp consequence(rel, {%{"op" => "emote"} = s, i}, _, ctx) do
    if(s["npc"], do: instance(at(rel, ["steps", i, "npc"]), s["npc"], ctx), else: []) ++
      case {s["to"], resolve(s["emote"], "emote", ctx.m, ctx.defs)} do
        {"subject", {_, _, %{} = e}} when not is_map_key(e, "to") ->
          r = s["emote"]
          target = "#{r["cartridge_id"]}@#{r["cartridge_version"]}:emote/#{r["key"]}"
          [diag("UNRESOLVED_REFERENCE", at(rel, ["steps", i, "to"]), %{"target" => target})]

        _ ->
          []
      end
  end

  defp consequence(_, _, _, _), do: []

  defp plan_move(rel, %{"plan" => _} = s, i) do
    if(s["npc"] || !s["room"],
      do: [
        diag("SCHEMA_VIOLATION", at(rel, ["steps", i, "plan"]), %{"error" => "invalid_value"})
      ],
      else: []
    )
  end

  defp plan_move(_, _, _), do: []

  # Row 16: entry engagement cures concealment in the same move, so an entry reaction may not apply one.
  defp revealed(rel, %{"status" => %{"key" => k}}, i, %{"event" => "entity_entered_room"}, ctx) do
    case (ctx.defs["status"] || %{})[k] do
      {_, _, %{"concealment" => _}} -> [diag("OUTCOME_MISMATCH", at(rel, ["steps", i, "op"]))]
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
      do: [diag("BARRIER_UNREACHABLE_KEY", at(rel, ["steps", i, "to"]))],
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
            diag("SCHEMA_VIOLATION", at(rel, ["steps", i, "npc"]), %{"error" => "invalid_value"})
          ],
          else: []

      _ ->
        []
    end
  end

  defp listener(_, _, _, _), do: []

  # Status reader 9: a named room resolves and is the step's only holder.
  defp room(rel, %{"room" => _} = s, i),
    do:
      if(s["item"] || s["npc"] || s["co_present"],
        do: [
          diag("SCHEMA_VIOLATION", at(rel, ["steps", i, "room"]), %{"error" => "invalid_value"})
        ],
        else: []
      )

  defp room(_, _, _), do: []
end
