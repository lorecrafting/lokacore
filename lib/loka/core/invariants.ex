defmodule Loka.Core.Invariants do
  @moduledoc """
  Pure checks for the invariants `protocol/invariants.json` assigns to `r3_pr5`, by id
  (docs/ROADMAP.md, verification harness). `kernel/ts/src/invariants.ts` is the TypeScript
  twin; both run the `"invariants"` cases of
  `protocol/fixtures/composition.json`.

  `check(id, observation)` is true when the invariant holds. Observation fields:

  - `"state"`, `"delta"`, `"result"`: a base state, a StateDelta and its
    `Loka.Core.Compose.compose/2` result;
  - `"resolution"`: a TargetResolution;
  - `"decision"`, `"commit"`, `"published"`: a DecisionResult, the host's commit outcome
    (`%{"status" => "committed", "revision" => n}`, `"failed"` or `"unknown"`) and what the
    host published. An unknown id raises.
  """
  alias Loka.Core.Compose

  @registry_path Path.expand("../../../protocol/error_registry.json", __DIR__)
  @external_resource @registry_path
  @registry File.read!(@registry_path)
  @evaluation_faults for e <- JSON.decode!(@registry),
                         e["category"] == "evaluation_fault",
                         do: e["code"]

  @spec check(String.t(), map()) :: boolean()
  def check("one_container_per_item", %{"state" => s, "result" => r}) do
    moved = moved(r)
    ids = Enum.map(moved, &elem(&1, 0))
    containers = Map.get(s, "containers", %{})

    ids == Enum.uniq(ids) and
      Enum.all?(moved, fn {e, c} -> is_binary(c) and Map.has_key?(containers, e) end)
  end

  def check("containment_acyclic", %{"state" => s, "result" => r}) do
    final = Map.merge(Map.get(s, "containers", %{}), Map.new(moved(r)))
    counts = Enum.frequencies(Map.values(final))

    Enum.all?(final, fn {e, c} -> not loops?(c, e, final, map_size(final)) end) and
      Enum.all?(Map.get(s, "capacities", %{}), fn {c, cap} -> Map.get(counts, c, 0) <= cap end)
  end

  def check("no_last_writer_wins", %{"delta" => %{"ops" => ops}, "result" => r}) do
    groups = Enum.group_by(ops, &Compose.key(Compose.target(&1)), & &1["writer_group"])
    Map.has_key?(r, "fault") or Enum.all?(groups, fn {_, gs} -> length(Enum.uniq(gs)) == 1 end)
  end

  # Checks only the read -> write value chain per target (fact value, container, quest state,
  # continuation or job status, clock, current resource value, cooldown start, barrier state), not capacity, revision, cycle or time bounds.
  def check("delta_preconditions_hold", %{"state" => s, "delta" => %{"ops" => ops}, "result" => r}) do
    Map.has_key?(r, "fault") or
      Enum.reduce_while(ops, %{}, fn op, seen ->
        k = Compose.key(Compose.target(op))
        {need, give} = link(op)
        before = Map.get_lazy(seen, k, fn -> initial(op, s) end)
        if before == need, do: {:cont, Map.put(seen, k, give)}, else: {:halt, false}
      end) != false
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

  # Walking up from e's container reaches e, or runs longer than there are rows (a cycle).
  defp loops?(nil, _, _, _), do: false
  defp loops?(e, e, _, _), do: true
  defp loops?(_, _, _, 0), do: true
  defp loops?(c, e, final, n), do: loops?(final[c], e, final, n - 1)

  # Each op reads one value of its target and leaves another: the fact value, the container,
  # the quest state, the continuation or job status, the clock.
  defp link(%{"op" => "fact.assign"} = op), do: {op["expected"], op["value"]}
  defp link(%{"op" => "entity.transfer"} = op), do: {op["source_id"], op["destination_id"]}
  defp link(%{"op" => "quest.activate"}), do: {nil, "active"}
  defp link(%{"op" => "quest.transition"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "choice.open"}), do: {nil, "pending"}
  defp link(%{"op" => "choice.resolve"}), do: {"pending", "resolved"}
  defp link(%{"op" => "choice.close"}), do: {"pending", "closed"}
  defp link(%{"op" => "job.schedule"}), do: {nil, "pending"}
  defp link(%{"op" => "job.complete"}), do: {"pending", "completed"}
  defp link(%{"op" => "time.advance"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "resource.adjust"} = op), do: {op["from"], op["to"]}
  defp link(%{"op" => "cooldown.start"} = op), do: {op["from"], op["at"]}
  defp link(%{"op" => "barrier.transition"} = op), do: {op["from"], op["to"]}

  defp initial(%{"op" => "fact.assign"} = op, s) do
    with nil <- get_in(s, ["facts", Compose.key(Compose.target(op))]),
         do: get_in(s, ["fact_defaults", Compose.key(op["fact"])])
  end

  defp initial(%{"op" => "entity.transfer", "entity_id" => e}, s),
    do: get_in(s, ["containers", e])

  defp initial(%{"op" => "quest." <> _, "instance_id" => i}, s),
    do: get_in(s, ["quests", i, "state"])

  defp initial(%{"op" => "choice." <> _, "continuation_id" => c}, s),
    do: get_in(s, ["choices", c, "status"])

  defp initial(%{"op" => "job." <> _, "job_id" => j}, s), do: get_in(s, ["jobs", j, "status"])
  defp initial(%{"op" => "time.advance"}, s), do: s["clock"]

  defp initial(%{"op" => "resource.adjust"} = op, s) do
    spec = get_in(s, ["resource_specs", Compose.key(op["resource"])])
    row = get_in(s, ["resources", Compose.key(Compose.target(op))])
    spec && Compose.current(row, spec, s["clock"])
  end

  defp initial(%{"op" => "cooldown.start"} = op, s),
    do: get_in(s, ["cooldowns", Compose.key(Compose.target(op))])

  defp initial(%{"op" => "barrier.transition"} = op, s) do
    with nil <- get_in(s, ["barriers", Compose.key(Compose.target(op))]),
         do: get_in(s, ["barrier_initial", Compose.key(op["barrier"])])
  end
end
