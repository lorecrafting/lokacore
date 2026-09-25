defmodule Loka.Core.Compose do
  @moduledoc """
  StateDelta composition (04 §5.1-§5.4, 14 §R3A). `kernel/ts/src/compose.ts` is the
  TypeScript twin; both run `protocol/fixtures/composition.json`.

  Takes a committed base state and a contract-valid StateDelta. Ops apply in their semantic
  order to a proposal overlay; each op's precondition reads the overlay over the base. An op
  on a target another writer group already wrote faults `conflicting_write` (no
  last-writer-wins, no same-value coalescing). The base is never copied.

  Base state, a JSON object (absent sections are empty):

  - `"clock"`: the committed logical time;
  - `"facts"`: canonical fact MutationTarget text => FactValue (compared as opaque values);
  - `"fact_defaults"`: canonical DefinitionRef text => FactValue for unset facts;
  - `"containers"`: EntityId => its one container (03 §23); `"capacities"`: EntityId =>
    the most entities it may contain;
  - `"quests"`: QuestInstanceId => `quest`, `scope`, `state`, optional `outcome`;
  - `"choices"`: ContinuationId => the `choice.open` fields plus `status` and the
    host-assigned `opened_revision`;
  - `"jobs"`: JobId => `job`, `due_time`, `status`.

  Result: `%{"changes" => rows}`, one `%{"target", "value"}` per written MutationTarget,
  sorted by canonical target text (the rows the host commits, ADR-072; a new continuation
  lacks `opened_revision` until the host commits it), or `%{"fault" => fault}`, a fault
  DecisionResult naming the op's target when there is one. Budgets from the composition
  profile are checked first, then ops in order: conflict before precondition.

  An explicit advance is a delta with `time.advance`; its target (the last `to`) is the
  visited time for `job.complete` and the bound `job.schedule` must exceed (04 §5.4).
  Without one, both use the base clock.
  """
  alias Loka.Core.Canonical

  @profile_path Path.expand("../../../docs/spec/conformance/composition-profile.json", __DIR__)
  @external_resource @profile_path
  @profile File.read!(@profile_path)
  @limits JSON.decode!(@profile)["limits"]

  @legal %{
    "active" => ~w(objectives_complete failed abandoned),
    "objectives_complete" => ~w(resolved failed abandoned),
    "failed" => ["active"],
    "abandoned" => ["active"]
  }

  @spec compose(map(), map()) :: %{String.t() => term()}
  def compose(state, %{"ops" => ops}) do
    if over_budget?(state, ops) do
      fault("budget_exceeded", nil)
    else
      horizon = Enum.reduce(ops, state["clock"], &advance_target/2)

      case Enum.reduce_while(ops, %{}, &step(&1, &2, {state, horizon})) do
        %{"fault" => _} = f -> f
        overlay -> %{"changes" => overlay |> Enum.sort() |> Enum.map(&row/1)}
      end
    end
  end

  @doc "The MutationTarget an op writes (04 §5.1)."
  @spec target(map()) :: map()
  def target(%{"op" => "fact.assign"} = op),
    do: Map.put(Map.take(op, ~w(fact scope subject_id)), "kind", "fact")

  def target(%{"op" => "entity.transfer", "entity_id" => e}), do: containment(e)

  def target(%{"op" => "quest." <> _, "instance_id" => i}),
    do: %{"kind" => "quest", "instance_id" => i}

  def target(%{"op" => "choice." <> _, "continuation_id" => c}),
    do: %{"kind" => "choice", "continuation_id" => c}

  def target(%{"op" => "job." <> _, "job_id" => j}), do: %{"kind" => "job", "job_id" => j}
  def target(%{"op" => "time.advance"}), do: %{"kind" => "clock"}

  @doc "Canonical text of a JSON value: the identity of a target or DefinitionRef."
  @spec key(term()) :: binary()
  def key(value) do
    {:ok, text} = Canonical.encode(value)
    text
  end

  defp over_budget?(state, ops) do
    count = fn name -> Enum.count(ops, &(&1["op"] == name)) end
    pending = Enum.count(section(state, "jobs"), fn {_, j} -> j["status"] == "pending" end)
    created = count.("job.schedule")
    due = count.("job.complete")

    length(ops) > @limits["operations"] or created > @limits["created_jobs"] or
      due > @limits["due_jobs_per_advance"] or pending + created - due > @limits["pending_jobs"]
  end

  defp advance_target(%{"op" => "time.advance", "to" => to}, _), do: to
  defp advance_target(_, t), do: t

  defp step(op, overlay, {state, horizon}) do
    target = target(op)
    k = key(target)
    group = op["writer_group"]

    case overlay do
      %{^k => {other, _, _}} when other != group -> {:halt, fault("conflicting_write", target)}
      _ -> apply_op(op, target, {state, horizon, overlay}) |> write(overlay, k, group, target)
    end
  end

  defp write({:ok, value}, overlay, k, group, target),
    do: {:cont, Map.put(overlay, k, {group, target, value})}

  defp write({:error, code}, _, _, _, target), do: {:halt, fault(code, target)}

  defp apply_op(%{"op" => "fact.assign"} = op, t, ctx) do
    now = with nil <- read(t, ctx), do: get_in(elem(ctx, 0), ["fact_defaults", key(op["fact"])])
    check(now == op["expected"], op["value"])
  end

  defp apply_op(
         %{"op" => "entity.transfer", "entity_id" => e, "destination_id" => d} = op,
         t,
         ctx
       ) do
    cond do
      read(t, ctx) != op["source_id"] ->
        {:error, "precondition_failed"}

      inside?(d, e, ctx, map_size(section(elem(ctx, 0), "containers")) + 1) ->
        {:error, "containment_cycle"}

      full?(d, e, ctx) ->
        {:error, "capacity_exceeded"}

      true ->
        {:ok, d}
    end
  end

  defp apply_op(%{"op" => "quest.activate", "quest" => q, "scope" => s}, t, ctx) do
    open? = fn {_, r} ->
      r["quest"] == q and r["scope"] == s and r["state"] in ~w(active objectives_complete)
    end

    taken = Enum.any?(rows("quest", "quests", "instance_id", ctx), open?)
    check(read(t, ctx) == nil and not taken, %{"quest" => q, "scope" => s, "state" => "active"})
  end

  defp apply_op(%{"op" => "quest.transition", "from" => from, "to" => to} = op, t, ctx) do
    row = read(t, ctx)
    outcome = op["outcome"]
    outcome_ok = if to == "resolved", do: outcome != nil, else: to == "failed" or outcome == nil

    next =
      if outcome,
        do: Map.put(row || %{}, "outcome", outcome),
        else: Map.delete(row || %{}, "outcome")

    check(
      row["state"] == from and to in Map.get(@legal, from, []) and outcome_ok,
      Map.put(next, "state", to)
    )
  end

  defp apply_op(%{"op" => "choice.open"} = op, t, ctx) do
    row = Map.take(op, ~w(actor_id source beat roles choice_ids))
    check(read(t, ctx) == nil, Map.put(row, "status", "pending"))
  end

  defp apply_op(%{"op" => "choice.resolve", "choice_id" => c} = op, t, ctx) do
    row = read(t, ctx)

    check(
      row["status"] == "pending" and c in row["choice_ids"] and
        row["opened_revision"] == op["expected_revision"],
      Map.merge(row || %{}, %{"status" => "resolved", "choice_id" => c})
    )
  end

  defp apply_op(%{"op" => "choice.close"}, t, ctx) do
    row = read(t, ctx)
    check(row["status"] == "pending", Map.put(row || %{}, "status", "closed"))
  end

  defp apply_op(%{"op" => "job.schedule", "due_time" => due} = op, t, {_, horizon, _} = ctx) do
    cond do
      read(t, ctx) != nil -> {:error, "precondition_failed"}
      due <= horizon -> {:error, "nonfuture_job"}
      true -> {:ok, %{"job" => op["job"], "due_time" => due, "status" => "pending"}}
    end
  end

  defp apply_op(%{"op" => "job.complete"}, t, {_, horizon, _} = ctx) do
    row = read(t, ctx)

    check(
      row["status"] == "pending" and row["due_time"] <= horizon,
      Map.put(row || %{}, "status", "completed")
    )
  end

  defp apply_op(%{"op" => "time.advance", "from" => from, "to" => to}, t, ctx),
    do: check(read(t, ctx) == from and to > from, to)

  defp check(true, value), do: {:ok, value}
  defp check(false, _), do: {:error, "precondition_failed"}

  # The overlay's value for a target, else the base's.
  defp read(t, {state, _, overlay}) do
    case Map.fetch(overlay, key(t)) do
      {:ok, {_, _, value}} -> value
      :error -> base(t, state)
    end
  end

  defp base(%{"kind" => "fact"} = t, s), do: section(s, "facts")[key(t)]
  defp base(%{"kind" => "containment", "entity_id" => e}, s), do: section(s, "containers")[e]
  defp base(%{"kind" => "quest", "instance_id" => i}, s), do: section(s, "quests")[i]
  defp base(%{"kind" => "choice", "continuation_id" => c}, s), do: section(s, "choices")[c]
  defp base(%{"kind" => "job", "job_id" => j}, s), do: section(s, "jobs")[j]
  defp base(%{"kind" => "clock"}, s), do: s["clock"]

  # d is e or inside it. A walk longer than the containment rows means a cyclic base: fail closed.
  defp inside?(nil, _, _, _), do: false
  defp inside?(e, e, _, _), do: true
  defp inside?(_, _, _, 0), do: true
  defp inside?(d, e, ctx, n), do: inside?(read(containment(d), ctx), e, ctx, n - 1)

  defp full?(d, e, {state, _, _} = ctx) do
    case section(state, "capacities")[d] do
      nil ->
        false

      cap ->
        Enum.count(
          rows("containment", "containers", "entity_id", ctx),
          &(elem(&1, 1) == d and elem(&1, 0) != e)
        ) >= cap
    end
  end

  # ponytail: scans the whole section; add a contents/scope index when a cartridge has many rows.
  defp rows(kind, name, id, {state, _, overlay}) do
    changed = for {_, {_, %{"kind" => ^kind} = t, v}} <- overlay, into: %{}, do: {t[id], v}
    Map.merge(section(state, name), changed)
  end

  defp section(state, name), do: Map.get(state, name, %{})
  defp containment(e), do: %{"kind" => "containment", "entity_id" => e}
  defp row({_, {_, target, value}}), do: %{"target" => target, "value" => value}

  defp fault(code, nil), do: %{"fault" => %{"kind" => "fault", "code" => code}}

  defp fault(code, target),
    do: %{"fault" => %{"kind" => "fault", "code" => code, "target" => target}}
end
