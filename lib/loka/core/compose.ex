# size: allow 340, typed patrol, terminal quests and final birth admission share portable composition
defmodule Loka.Core.Compose do
  @moduledoc """
  StateDelta composition (04 §5.1-§5.4, 14 §R3A), twin of `kernel/ts/src/foundation/compose.ts`.
  Both run the portable composition fixtures. Contract-valid ops apply in semantic order to
  an overlay; preconditions read overlay over base. Different writer groups sharing a target
  fault `conflicting_write`. The committed base is never copied.

  Base state, a JSON object (absent sections are empty):

  - `"clock"`: required integer logical time; otherwise faults `precondition_failed` on clock;
  - `"facts"`: canonical fact MutationTarget text => FactValue (compared as opaque values);
  - `"fact_defaults"`: canonical DefinitionRef text => FactValue for unset facts;
  - `"containers"`: EntityId => its one container (03 §23); `"capacities"`: EntityId =>
    the most entities it may contain;
  - `"quests"`: QuestInstanceId => `quest`, `scope`, `state`, optional `outcome`;
  - `"choices"`: ContinuationId => the `choice.open` fields plus `status` and the
    host-assigned `opened_revision`;
  - `"jobs"`: JobId => `job`, `due_time`, `status`, optional `encounter_id`;
  - `"encounters"`: EncounterId => EncounterRow (participants, room, status, round and job);
  - `"resource_specs"`: canonical DefinitionRef => ResourceSpec (`minimum`, `maximum`, `start`,
    `gain`, optional `regen`); `"resources"`: canonical resource target => `value`, `at`, plus
    required `rate`, `remainder` for opted recovery; `current/3` reads its current value;
  - `"cooldowns"`: canonical cooldown MutationTarget text => the LogicalTime it last started;
  - `"barrier_initial"`: canonical DefinitionRef text => BarrierState for unset barriers;
    `"barriers"`: canonical barrier MutationTarget text => BarrierState;
  - `"liquid_specs"`: ItemId => immutable `capacity`, declared `kinds`;
    `"liquids"`: ItemId => exact `kind`, `quantity` row.

  Result: `%{"changes" => rows}` sorted by canonical target text, one `%{"target", "value"}`
  per target (ADR-072), or `%{"fault" => fault}` naming the failed op's target when present.
  Continuations lack `opened_revision` until commit. Budgets precede ops, conflicts precede
  preconditions. An overlay failure discards the whole proposal.

  An explicit advance is a delta with `time.advance`; its target (the last `to`) is the
  visited time for `job.complete` and the bound `job.schedule` must exceed (04 §5.4).
  """
  alias Loka.Core.Creation
  @profile_path Path.expand("../../../docs/spec/conformance/composition-profile.json", __DIR__)
  @external_resource @profile_path
  @profile File.read!(@profile_path)
  @limits @profile |> JSON.decode!() |> Map.fetch!("limits")
  @legal %{
    "active" => ~w(objectives_complete failed abandoned),
    "objectives_complete" => ~w(resolved failed abandoned),
    "failed" => ["active"],
    "abandoned" => ["active"]
  }

  # A barrier's legal transitions (room.schema.json BarrierState): open, close, lock, unlock.
  @door %{"closed" => ~w(open locked), "open" => ["closed"], "locked" => ["closed"]}
  @spec compose(map(), map()) :: %{String.t() => term()}
  def compose(state, %{"ops" => ops}, final \\ true) do
    cond do
      not is_integer(state["clock"]) ->
        fault("precondition_failed", %{"kind" => "clock"})

      over_budget?(state, ops) ->
        fault("budget_exceeded", nil)

      true ->
        result = apply_all(state, ops)

        if final and Map.has_key?(result, "changes") and not Creation.complete?(ops),
          do: fault("precondition_failed", %{"kind" => "clock"}),
          else: result
    end
  end

  defp apply_all(state, ops) do
    horizon = Enum.reduce(ops, state["clock"], &advance_target/2)

    pairs = Enum.zip(ops, Enum.drop(ops, 1) ++ [nil])

    case Enum.reduce_while(pairs, %{}, &step_pair(&1, &2, {state, horizon})) do
      %{"fault" => _} = f ->
        f

      overlay ->
        case Loka.Core.ComposeChoice.pending_at_limit(overlay) do
          nil -> %{"changes" => overlay |> Enum.sort() |> Enum.map(&row/1)}
          t -> fault("precondition_failed", t)
        end
    end
  end

  defp step_pair({op, next}, overlay, ctx) do
    if (op["op"] == "entity.create" and not Creation.initial_pair?(op, next)) or
         not repeat_pair?(op, next),
       do: {:halt, fault("precondition_failed", target(op))},
       else: step(op, overlay, ctx)
  end

  defp repeat_pair?(%{"op" => "quest.retire"} = op, %{"op" => "quest.activate"} = next),
    do:
      next["writer_group"] == op["writer_group"] and next["instance_id"] != op["instance_id"] and
        next["quest"] == op["quest"] and next["scope"] == op["scope"]

  defp repeat_pair?(%{"op" => "quest.retire"}, _), do: false
  defp repeat_pair?(_, _), do: true

  defdelegate target(op), to: Loka.Core.ComposeTarget

  @doc "Current resource value; malformed opted metadata returns nil."
  defdelegate current(row, spec, now), to: Loka.Core.Resource

  @doc "Canonical text of a JSON value: the identity of a target or DefinitionRef."
  @spec key(term()) :: binary()
  defdelegate key(value), to: Loka.Core.ComposeTarget

  defp over_budget?(state, ops) do
    count = fn name -> Enum.count(ops, &(&1["op"] == name)) end
    pending = Enum.count(section(state, "jobs"), fn {_, j} -> j["status"] == "pending" end)
    created = count.("job.schedule")
    due = count.("job.complete")

    length(ops) > @limits["operations"] or created > @limits["created_jobs"] or
      due > @limits["due_jobs_per_advance"] or
      pending + created - due - count.("job.cancel") > @limits["pending_jobs"]
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

  defp apply_op(%{"op" => "entity.create", "identity" => identity}, t, {state, _, _} = ctx),
    do: check(read(t, ctx) == nil and Creation.valid?(identity, state), identity)

  defp apply_op(
         %{"op" => "entity.transfer", "source_id" => nil} = op,
         t,
         {state, _, overlay} = ctx
       ) do
    check(read(t, ctx) == nil and Creation.initial?(op, state, overlay), op["destination_id"])
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

  defp apply_op(%{"op" => "quest.retire", "quest" => q, "scope" => s}, t, ctx) do
    row = read(t, ctx)

    check(
      row != nil and row["state"] == "resolved" and row["quest"] == q and row["scope"] == s,
      nil
    )
  end

  defp apply_op(%{"op" => "quest.activate", "quest" => q, "scope" => s} = op, t, ctx) do
    open? = fn {_, r} ->
      r["quest"] == q and r["scope"] == s and r["state"] in ~w(active objectives_complete)
    end

    taken = Enum.any?(rows("quest", "quests", "instance_id", ctx), open?)

    row =
      Map.merge(%{"quest" => q, "scope" => s, "state" => "active"}, Map.take(op, ["bindings"]))

    check(read(t, ctx) == nil and not taken, row)
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

  defp apply_op(%{"op" => "choice." <> _} = op, t, ctx),
    do:
      Loka.Core.ComposeChoice.transition(
        op,
        read(t, ctx),
        get_in(elem(ctx, 0), ["choices", op["continuation_id"]])
      )

  defp apply_op(%{"op" => "job." <> _} = op, t, {_, horizon, _} = ctx),
    do: Loka.Core.ComposeEncounter.job(op, read(t, ctx), horizon)

  defp apply_op(%{"op" => "encounter.open"} = op, t, {state, _, _} = ctx),
    do:
      Loka.Core.ComposeEncounter.open(
        op,
        read(t, ctx),
        state,
        read(containment(op["body_id"]), ctx),
        read(containment(op["npc_id"]), ctx),
        rows("encounter", "encounters", "encounter_id", ctx)
      )

  defp apply_op(%{"op" => "encounter." <> _} = op, t, ctx),
    do: Loka.Core.ComposeEncounter.change(op, read(t, ctx))

  defp apply_op(%{"op" => "patrol.transition"} = op, t, ctx),
    do: Loka.Core.ComposePatrol.transition(op, read(t, ctx))

  defp apply_op(%{"op" => "population." <> _} = op, t, ctx),
    do: Loka.Core.ComposePopulation.transition(op, read(t, ctx), ctx)

  defp apply_op(%{"op" => "escort.transition"} = op, t, ctx),
    do: Loka.Core.ComposeEscort.transition(op, read(t, ctx))

  defp apply_op(%{"op" => "liquid.set"} = op, t, {state, _, _} = ctx),
    do: Loka.Core.Liquid.compose(op, read(t, ctx), state)

  defp apply_op(%{"op" => "time.advance", "from" => from, "to" => to}, t, ctx),
    do: check(read(t, ctx) == from and to > from, to)

  defp apply_op(%{"op" => "fuel.set"} = op, t, {state, _, _} = ctx),
    do: Loka.Core.Fuel.compose(op, read(t, ctx), state)

  defp apply_op(%{"op" => "resource.adjust"} = op, t, {state, horizon, _} = ctx),
    do: Loka.Core.Resource.compose_adjustment(op, read(t, ctx), state, horizon)

  defp apply_op(%{"op" => "resource.initialize"} = op, t, ctx),
    do: Loka.Core.ComposePopulation.initialize(op, read(t, ctx), ctx)

  defp apply_op(%{"op" => "cooldown.start", "at" => at} = op, t, {state, _, _} = ctx),
    do: check(read(t, ctx) == op["from"] and at == state["clock"], at)

  defp apply_op(%{"op" => "barrier.transition", "from" => from, "to" => to} = op, t, ctx) do
    now =
      with nil <- read(t, ctx), do: section(elem(ctx, 0), "barrier_initial")[key(op["barrier"])]

    check(now == from and to in Map.get(@door, from, []), to)
  end

  defp check(true, value), do: {:ok, value}
  defp check(false, _), do: {:error, "precondition_failed"}

  defp read(t, {state, _, overlay}) do
    case Map.fetch(overlay, key(t)) do
      {:ok, {_, _, value}} -> value
      :error -> base(t, state)
    end
  end

  defp base(%{"kind" => "fuel", "item_id" => i}, s), do: section(s, "fuel")[i]
  defp base(%{"kind" => "fact"} = t, s), do: section(s, "facts")[key(t)]
  defp base(%{"kind" => "entity", "entity_id" => e}, s), do: section(s, "created")[e]
  defp base(%{"kind" => "containment", "entity_id" => e}, s), do: section(s, "containers")[e]
  defp base(%{"kind" => "quest", "instance_id" => i}, s), do: section(s, "quests")[i]
  defp base(%{"kind" => "choice", "continuation_id" => c}, s), do: section(s, "choices")[c]
  defp base(%{"kind" => "job", "job_id" => j}, s), do: section(s, "jobs")[j]
  defp base(%{"kind" => "encounter", "encounter_id" => e}, s), do: section(s, "encounters")[e]
  defp base(%{"kind" => "patrol", "quest_instance_id" => q}, s), do: section(s, "patrols")[q]

  defp base(%{"kind" => "population_" <> _} = t, s), do: Loka.Core.ComposePopulation.base(t, s)

  defp base(%{"kind" => "escort", "actor_id" => a}, s), do: section(s, "escorts")[a]
  defp base(%{"kind" => "liquid", "item_id" => i}, s), do: section(s, "liquids")[i]
  defp base(%{"kind" => "clock"}, s), do: s["clock"]
  defp base(%{"kind" => "resource"} = t, s), do: section(s, "resources")[key(t)]
  defp base(%{"kind" => "cooldown"} = t, s), do: section(s, "cooldowns")[key(t)]
  defp base(%{"kind" => "barrier"} = t, s), do: section(s, "barriers")[key(t)]

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
