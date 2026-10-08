# size: allow 340, patrol, water, bleed and character pairing join precondition replay
defmodule Loka.Core.Invariants do
  @moduledoc "Pure portable invariants: composition, resolution and host outcomes; unknown IDs raise."
  alias Loka.Core.Compose
  @registry_path Path.expand("../../../protocol/error_registry.json", __DIR__)
  @external_resource @registry_path
  @registry File.read!(@registry_path)
  @evaluation_faults for e <- JSON.decode!(@registry),
                         e["category"] == "evaluation_fault",
                         do: e["code"]
  @legal %{
    "active" => ~w(objectives_complete failed abandoned),
    "objectives_complete" => ~w(resolved failed abandoned),
    "failed" => ["active"],
    "abandoned" => ["active"]
  }
  @door %{"closed" => ~w(open locked), "open" => ["closed"], "locked" => ["closed"]}
  @spec check(String.t(), map()) :: boolean()
  def check("patrol_transitions_hold", %{"state" => s, "delta" => %{"ops" => ops}, "result" => r}),
      do: Map.has_key?(r, "fault") or Loka.Core.InvariantsPatrol.holds?(s, ops, r)

  def check("one_container_per_item", %{"state" => s, "result" => r} = observation) do
    ops = get_in(observation, ["delta", "ops"]) || []
    Loka.Core.InvariantsCreation.custody?(s, ops, r)
  end

  def check("liquid_rows_valid", %{"state" => s, "result" => r}),
    do: Loka.Core.InvariantsLiquid.rows_valid?(s, r)

  def check("containment_acyclic", %{"state" => s, "result" => r}) do
    final = Map.merge(Map.get(s, "containers", %{}), Map.new(moved(r)))
    counts = Enum.frequencies(Map.values(final))

    acyclic?(final) and
      Enum.all?(Map.get(s, "capacities", %{}), fn {c, cap} -> Map.get(counts, c, 0) <= cap end)
  end

  def check("no_last_writer_wins", %{"delta" => %{"ops" => ops}, "result" => r}) do
    groups = Enum.group_by(ops, &Compose.key(Compose.target(&1)), & &1["writer_group"])
    Map.has_key?(r, "fault") or Enum.all?(groups, fn {_, gs} -> length(Enum.uniq(gs)) == 1 end)
  end

  # Replay success preconditions independently of Compose.compose/2, including cross-target
  # overlays for containment and quest scope. A fault vacuously holds this success-only check.
  def check("delta_preconditions_hold", %{"state" => s, "delta" => %{"ops" => ops}, "result" => r}) do
    Map.has_key?(r, "fault") or preconditions_hold?(s, ops, r)
  end

  def check("fault_discards_whole_proposal", %{"result" => r}) do
    case r do
      %{"fault" => f} -> map_size(r) == 1 and Map.keys(f) -- ~w(kind code target) == []
      %{"changes" => _} -> map_size(r) == 1
    end
  end

  def check("fault_codes_are_evaluation_faults", %{"result" => r}) do
    case r do
      %{"fault" => %{"code" => code}} -> code in @evaluation_faults
      _ -> true
    end
  end

  def check("target_candidates_ordered", %{"resolution" => r}) do
    case r do
      %{"kind" => "ambiguous", "candidate_ids" => ids} ->
        ids |> Enum.chunk_every(2, 1, :discard) |> Enum.all?(fn [a, b] -> a < b end)

      _ ->
        true
    end
  end

  def check("no_proposed_event_escapes", %{"decision" => d, "commit" => c, "published" => p}) do
    allowed =
      case {d, c} do
        {%{"kind" => "accepted", "events" => es}, %{"status" => "committed", "revision" => n}} ->
          for e <- es, do: %{"committed_revision" => n, "event" => e}

        _ ->
          []
      end

    Enum.all?(p, &(&1 in allowed))
  end

  defp moved(r) do
    for %{"target" => %{"kind" => "containment", "entity_id" => e}, "value" => c} <-
          Map.get(r, "changes", []),
        do: {e, c}
  end

  defp preconditions_hold?(s, ops, result) do
    is_integer(s["clock"]) and entity_preconditions?(s, ops, result) and
      Loka.Core.InvariantsEscort.holds?(s, ops, result) and
      Loka.Core.InvariantsPatrol.holds?(s, ops, result) and
      Loka.Core.InvariantsWater.holds?(s, ops, result) and
      Loka.Core.InvariantsLiquid.holds?(s, ops, result) and
      Loka.Core.InvariantsFood.holds?(s, ops) and
      retirements_hold?(ops) and replay_preconditions(s, ops, result)
  end

  defp entity_preconditions?(s, ops, result) do
    Loka.Core.InvariantsKnowledge.holds?(s, ops, result) and
      Loka.Core.InvariantsCreation.holds?(s, ops, result) and
      Loka.Core.InvariantsEncounter.holds?(s, ops, result) and
      Loka.Core.InvariantsPopulation.holds?(s, ops, result)
  end

  defp replay_preconditions(s, ops, result) do
    horizon =
      Enum.reduce(ops, s["clock"], fn op, at ->
        if op["op"] == "time.advance", do: op["to"], else: at
      end)

    containers = Map.get(s, "containers", %{})
    quests = Map.get(s, "quests", %{})

    replay =
      Enum.reduce_while(ops, {%{}, containers, quests, %{}}, &replay_op(&1, s, horizon, &2))

    case replay do
      false ->
        false

      {_, _, _, resources} ->
        Enum.all?(resources, &written?(&1, result))
    end
  end

  defp written?({k, expected}, result),
    do:
      Enum.any?(result["changes"], &(Compose.key(&1["target"]) == k and &1["value"] == expected))

  defp replay_op(%{"op" => "water.transition"}, _, _, ctx), do: {:cont, ctx}
  defp replay_op(%{"op" => "patrol.transition"}, _, _, ctx), do: {:cont, ctx}
  defp replay_op(%{"op" => "population." <> _}, _, _, ctx), do: {:cont, ctx}

  defp replay_op(%{"op" => kind}, _, _, ctx)
       when kind in ~w(crow.transition expedition.transition resource.initialize visit.record observation.record),
       do: {:cont, ctx}

  defp replay_op(%{"op" => "liquid.set"}, _, _, ctx), do: {:cont, ctx}
  defp replay_op(%{"op" => "escort.transition"}, _, _, ctx), do: {:cont, ctx}
  defp replay_op(%{"op" => "encounter." <> _}, _, _, ctx), do: {:cont, ctx}
  defp replay_op(%{"op" => "job." <> _}, _, _, ctx), do: {:cont, ctx}

  defp replay_op(op, s, horizon, {seen, containers, quests, resources}) do
    k = Compose.key(Compose.target(op))

    if op["op"] == "resource.adjust" do
      before = Map.get_lazy(resources, k, fn -> get_in(s, ["resources", k]) end)

      case Loka.Core.InvariantsResource.resource_after(op, s, before, horizon) do
        nil -> {:halt, false}
        after_row -> {:cont, {seen, containers, quests, Map.put(resources, k, after_row)}}
      end
    else
      replay_legacy(op, s, k, {seen, containers, quests, resources})
    end
  end

  defp replay_legacy(op, s, k, {seen, containers, quests, resources}) do
    {need, give} = link(op)
    before = Map.get_lazy(seen, k, fn -> initial(op, s) end)

    if before == need and extra?(op, s, containers, quests) do
      {:cont,
       {Map.put(seen, k, give), moved_container(op, containers), moved_quest(op, quests),
        if(op["op"] == "fuel.set", do: Map.put(resources, k, give), else: resources)}}
    else
      {:halt, false}
    end
  end

  # Mark each path once; a deep chain is linear in the number of rows.
  defp acyclic?(final) do
    Enum.reduce_while(final, MapSet.new(), fn {e, _}, done ->
      case walk(e, final, done, MapSet.new()) do
        :cycle -> {:halt, false}
        path -> {:cont, MapSet.union(done, path)}
      end
    end) != false
  end

  defp walk(e, final, done, path) do
    cond do
      not Map.has_key?(final, e) or MapSet.member?(done, e) -> path
      MapSet.member?(path, e) -> :cycle
      true -> walk(final[e], final, done, MapSet.put(path, e))
    end
  end

  defp extra?(%{"op" => "fuel.set"} = op, s, _, _),
    do: Loka.Core.InvariantsFuel.valid?(op, s)

  defp extra?(%{"op" => "entity.transfer"} = op, s, containers, _) do
    d = op["destination_id"]
    e = op["entity_id"]
    cap = get_in(s, ["capacities", d])
    held = Enum.count(containers, fn {x, c} -> x != e and c == d end)
    not inside?(d, e, containers, MapSet.new()) and (cap == nil or held < cap)
  end

  defp extra?(%{"op" => "quest.retire"} = op, _, _, quests) do
    q = quests[op["instance_id"]]

    q != nil and q["state"] == "resolved" and q["quest"] == op["quest"] and
      q["scope"] == op["scope"]
  end

  defp extra?(%{"op" => "quest.activate"} = op, _, _, quests) do
    Enum.all?(quests, fn {_, q} ->
      q["quest"] != op["quest"] or q["scope"] != op["scope"] or
        q["state"] not in ~w(active objectives_complete)
    end)
  end

  defp extra?(%{"op" => "quest.transition"} = op, _, _, _) do
    to = op["to"]
    outcome = op["outcome"]

    to in Map.get(@legal, op["from"], []) and
      if(to == "resolved", do: outcome != nil, else: to == "failed" or outcome == nil)
  end

  defp extra?(%{"op" => "choice.resolve"} = op, s, _, _) do
    row = get_in(s, ["choices", op["continuation_id"]]) || %{}

    op["choice_id"] in Map.get(row, "choice_ids", []) and
      row["opened_revision"] == op["expected_revision"]
  end

  defp extra?(%{"op" => "time.advance"} = op, _, _, _), do: op["to"] > op["from"]

  defp extra?(%{"op" => "cooldown.start"} = op, s, _, _), do: op["at"] == s["clock"]

  defp extra?(%{"op" => "barrier.transition"} = op, _, _, _),
    do: op["to"] in Map.get(@door, op["from"], [])

  defp extra?(_, _, _, _), do: true

  defp inside?(nil, _, _, _), do: false

  defp inside?(at, e, containers, path) do
    at == e or MapSet.member?(path, at) or
      inside?(containers[at], e, containers, MapSet.put(path, at))
  end

  defp moved_container(%{"op" => "entity.transfer"} = op, containers),
    do: Map.put(containers, op["entity_id"], op["destination_id"])

  defp moved_container(_, containers), do: containers

  defp moved_quest(%{"op" => "quest.retire"} = op, quests),
    do: Map.delete(quests, op["instance_id"])

  defp moved_quest(%{"op" => "quest.activate"} = op, quests),
    do:
      Map.put(
        quests,
        op["instance_id"],
        Map.take(op, ~w(quest scope)) |> Map.put("state", "active")
      )

  defp moved_quest(%{"op" => "quest.transition"} = op, quests),
    do: Map.update!(quests, op["instance_id"], &Map.put(&1, "state", op["to"]))

  defp moved_quest(_, quests), do: quests

  # Each op reads one value of its target and leaves another: the fact value, the container,
  # the quest state, the continuation or job status, the clock.
  defp link(%{"op" => "fact.assign"} = op), do: {op["expected"], op["value"]}
  defp link(%{"op" => "character.select"} = op), do: {nil, op["value"]}
  defp link(%{"op" => "bleed.transition"} = op), do: {op["expected"], op["value"]}
  defp link(%{"op" => "entity.create", "identity" => i}), do: {nil, i}
  defp link(%{"op" => "entity.transfer"} = op), do: {op["source_id"], op["destination_id"]}
  defp link(%{"op" => "quest.retire"}), do: {"resolved", nil}
  defp link(%{"op" => "quest.activate"}), do: {nil, "active"}
  defp link(%{"op" => "quest.transition"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "choice.open"}), do: {nil, "pending"}
  defp link(%{"op" => "choice.resolve"}), do: {"pending", "resolved"}
  defp link(%{"op" => "choice.attempt"}), do: {"pending", "pending"}
  defp link(%{"op" => "choice.close"}), do: {"pending", "closed"}
  defp link(%{"op" => "time.advance"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "fuel.set"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "resource.adjust"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "cooldown.start"} = op), do: {op["from"], op["at"]}
  defp link(%{"op" => "barrier.transition"} = op), do: {op["from"], op["to"]}

  defp initial(%{"op" => "fact.assign"} = op, s) do
    with nil <- get_in(s, ["facts", Compose.key(Compose.target(op))]),
         do: get_in(s, ["fact_defaults", Compose.key(op["fact"])])
  end

  defp initial(%{"op" => "character.select", "character_id" => id}, s),
    do: get_in(s, ["characters", id])

  defp initial(%{"op" => "entity.create", "identity" => i}, s),
    do: get_in(s, ["created", i["id"]])

  defp initial(%{"op" => "entity.transfer", "entity_id" => e}, s),
    do: get_in(s, ["containers", e])

  defp initial(%{"op" => "bleed.transition", "body_id" => b}, s),
    do: get_in(s, ["bleeds", b])

  defp initial(%{"op" => "quest." <> _, "instance_id" => i}, s),
    do: get_in(s, ["quests", i, "state"])

  defp initial(%{"op" => "choice." <> _, "continuation_id" => c}, s),
    do: get_in(s, ["choices", c, "status"])

  defp initial(%{"op" => "fuel.set", "item_id" => i}, s), do: get_in(s, ["fuel", i])
  defp initial(%{"op" => "time.advance"}, s), do: s["clock"]

  defp initial(%{"op" => "cooldown.start"} = op, s),
    do: get_in(s, ["cooldowns", Compose.key(Compose.target(op))])

  defp initial(%{"op" => "barrier.transition"} = op, s) do
    with nil <- get_in(s, ["barriers", Compose.key(Compose.target(op))]),
         do: get_in(s, ["barrier_initial", Compose.key(op["barrier"])])
  end

  defp retirements_hold?(ops) do
    ops
    |> Enum.chunk_every(2, 1, [])
    |> Enum.all?(fn
      [%{"op" => "quest.retire"} = op, %{"op" => "quest.activate"} = next] ->
        next["writer_group"] == op["writer_group"] and next["instance_id"] != op["instance_id"] and
          next["quest"] == op["quest"] and next["scope"] == op["scope"]

      [%{"op" => "quest.retire"} | _] ->
        false

      _ ->
        true
    end)
  end
end
