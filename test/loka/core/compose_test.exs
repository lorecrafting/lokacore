defmodule Loka.Core.ComposeTest do
  # Expected values are hand-written in protocol/fixtures/composition.json, decoded with the
  # stdlib JSON so they never pass through the code under test.
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}

  @fixture JSON.decode!(File.read!("protocol/fixtures/composition.json"))
  @limits JSON.decode!(File.read!("docs/spec/conformance/composition-profile.json"))["limits"]
  @registered for i <- JSON.decode!(File.read!("protocol/invariants.json")),
                  i["implemented_in"] == "elixir_and_typescript",
                  do: i["id"]
  @compose_invariants ~w(one_container_per_item containment_acyclic no_last_writer_wins
                         delta_preconditions_hold fault_discards_whole_proposal
                         fault_codes_are_evaluation_faults)

  # Fixture states list facts as rows; the kernel reads them indexed by canonical text.
  defp index(state) do
    state
    |> Map.update("facts", %{}, &Map.new(&1, fn r -> {Compose.key(r["target"]), r["value"]} end))
    |> Map.update(
      "fact_defaults",
      %{},
      &Map.new(&1, fn r -> {Compose.key(r["fact"]), r["value"]} end)
    )
  end

  defp state(name), do: index(Map.get_lazy(@fixture["states"], name, fn -> built(name) end))

  @hub "10000000-0000-4000-8000-000000000000"
  @room "20000000-0000-4000-8000-000000000000"
  @bram %{
    "cartridge_id" => "lantern",
    "cartridge_version" => "0.1.0",
    "kind" => "schedule",
    "key" => "bram"
  }

  # Boundary cases too long to list in the fixture (65 ops, 1,024 queued jobs, 40 rows): the
  # inputs are built from a pattern here; each expected value is still hand-written.
  defp cases, do: @fixture["cases"] ++ [budget_first(), final_queue(), sorted_rows()]

  defp budget_first,
    do: %{
      "id" => "budget-before-first-op-fault",
      "state" => "base",
      "ops" => [schedule(uuid("d1", 0), 30) | for(n <- 1..64, do: schedule(uuid("f2", n)))],
      "expected" => budget()
    }

  defp final_queue,
    do: %{
      "id" => "pending-jobs-bound-is-the-final-queue",
      "state" => "full_queue",
      "ops" => [schedule(uuid("f1", 0), 20), complete(uuid("f0", 1))],
      "expected" => %{
        "changes" => [
          %{"target" => job(uuid("f0", 1)), "value" => queued(3, "completed")},
          %{"target" => job(uuid("f1", 0)), "value" => queued(20, "pending")}
        ]
      }
    }

  defp sorted_rows,
    do: %{
      "id" => "changes-sorted-by-target-over-32-rows",
      "state" => "crowd",
      "ops" => for(n <- 40..1//-1, do: transfer(uuid("e0", n))),
      "expected" => %{
        "changes" =>
          for(n <- 1..40, do: %{"target" => containment(uuid("e0", n)), "value" => @room})
      }
    }

  defp built("full_queue"),
    do: %{"clock" => 6, "jobs" => Map.new(1..1024, &{uuid("f0", &1), queued(3, "pending")})}

  defp built("crowd"),
    do: %{"clock" => 0, "containers" => Map.new(1..40, &{uuid("e0", &1), @hub})}

  defp uuid(prefix, n),
    do: "#{prefix}000000-0000-4000-8000-" <> String.pad_leading("#{n}", 12, "0")

  defp queued(due, status), do: %{"job" => @bram, "due_time" => due, "status" => status}
  defp job(id), do: %{"kind" => "job", "job_id" => id}
  defp containment(e), do: %{"kind" => "containment", "entity_id" => e}

  defp transfer(e),
    do: %{
      "op" => "entity.transfer",
      "writer_group" => 0,
      "entity_id" => e,
      "source_id" => @hub,
      "destination_id" => @room
    }

  defp holds_all(state, delta, result) do
    for id <- @compose_invariants,
        !Invariants.check(id, %{"state" => state, "delta" => delta, "result" => result}),
        do: id
  end

  test "composition known answers" do
    for c <- cases() do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      result = Compose.compose(state(c["state"]), delta)
      assert result == c["expected"], c["id"]
      assert holds_all(state(c["state"]), delta, result) == [], c["id"]

      case result do
        %{"fault" => f} ->
          assert Contracts.validate("DecisionResult", f) == :ok, c["id"]

        %{"changes" => rows} ->
          for r <- rows, do: assert(Contracts.validate("MutationTarget", r["target"]) == :ok)
      end
    end
  end

  # The smallest host model of 04 §5.1 / 03 §15: publish only after a confirmed commit.
  defp publish(%{"kind" => "accepted", "events" => es}, %{
         "status" => "committed",
         "revision" => n
       }),
       do: for(e <- es, do: %{"committed_revision" => n, "event" => e})

  defp publish(_, _), do: []

  test "proposed events are published only after a confirmed commit" do
    for c <- @fixture["publication"] do
      assert Contracts.validate("DecisionResult", c["decision"]) == :ok, c["id"]
      assert publish(c["decision"], c["commit"]) == c["published"], c["id"]
      obs = Map.take(c, ~w(decision commit published))
      assert Invariants.check("no_proposed_event_escapes", obs), c["id"]
    end
  end

  # A sequenced boundary (04 §5.1, 03 §15; 14 Gate R3), test-only: compose, commit, and only
  # on a confirmed commit adopt the changes and then deliver the events. Commit, adoption and
  # delivery are observed as messages in order. R6 replaces this with the real authority.
  defp step(state, ops, events, status) do
    case Compose.compose(state, %{"ops" => ops}) do
      %{"changes" => rows} ->
        send(self(), {:commit, status})
        if status == "committed", do: observe(rows, events)

      %{"fault" => _} ->
        :ok
    end
  end

  defp observe(rows, events) do
    send(self(), {:adopted, rows})
    for e <- events, do: send(self(), {:delivered, e})
  end

  defp history(seen \\ []) do
    receive do
      m -> history([m | seen])
    after
      0 -> Enum.reverse(seen)
    end
  end

  test "failed or unknown commits and faults adopt and deliver nothing; a commit adopts, then delivers" do
    by_id = &Enum.find(@fixture[&1], fn c -> c["id"] == &2 end)
    ok = by_id.("cases", "explicit-sequence-across-kinds")
    bad = by_id.("cases", "conflict-fact-opposite-groups")

    [_ | _] =
      events = by_id.("publication", "committed-publishes-committed-events")["decision"]["events"]

    base = state("base")

    step(base, ok["ops"], events, "failed")
    step(base, ok["ops"], events, "unknown")
    step(base, bad["ops"], events, "committed")
    assert history() == [{:commit, "failed"}, {:commit, "unknown"}]

    step(base, ok["ops"], events, "committed")
    delivered = for e <- events, do: {:delivered, e}

    assert history() == [
             {:commit, "committed"},
             {:adopted, ok["expected"]["changes"]} | delivered
           ]
  end

  test "invariant checks known answers, a holding and a violated case per invariant checked in both kernels" do
    for c <- @fixture["invariants"] do
      obs = Map.update(c["observation"], "state", nil, &state/1)
      assert Invariants.check(c["id"], obs) == c["holds"], "#{c["id"]}: #{c["note"]}"
    end

    covered = for c <- @fixture["invariants"], uniq: true, do: {c["id"], c["holds"]}
    for id <- @registered, holds <- [true, false], do: assert({id, holds} in covered, id)
  end

  defp jobs(n, due),
    do: Map.new(1..n//1, &{job_id(&1), %{"due_time" => due, "status" => "pending"}})

  defp job_id(n), do: uuid("d0", n)

  defp schedule(id, due \\ 100),
    do: %{
      "op" => "job.schedule",
      "writer_group" => 0,
      "job_id" => id,
      "job" => @bram,
      "due_time" => due
    }

  defp complete(id), do: %{"op" => "job.complete", "writer_group" => 0, "job_id" => id}

  defp over?(state, ops),
    do: Compose.compose(Map.put(state, "clock", 6), %{"ops" => ops}) == budget()

  defp changes(state, ops),
    do: Compose.compose(Map.put(state, "clock", 6), %{"ops" => ops})["changes"]

  defp budget, do: %{"fault" => %{"kind" => "fault", "code" => "budget_exceeded"}}

  test "composition-profile budgets: at the limit composes with the expected changes, one over faults" do
    advance = fn n ->
      for t <- 6..(5 + n),
          do: %{"op" => "time.advance", "writer_group" => 0, "from" => t, "to" => t + 1}
    end

    ops = @limits["operations"]

    assert changes(%{}, advance.(ops)) == [
             %{"target" => %{"kind" => "clock"}, "value" => 6 + ops}
           ]

    assert over?(%{}, advance.(ops + 1))

    created = @limits["created_jobs"]
    assert length(changes(%{}, for(n <- 1..created, do: schedule(job_id(n))))) == created
    assert over?(%{}, for(n <- 1..(created + 1), do: schedule(job_id(n))))

    pending = @limits["pending_jobs"]

    assert [%{"value" => %{"status" => "pending"}}] =
             changes(%{"jobs" => jobs(pending - 1, 100)}, [schedule(job_id(pending))])

    assert over?(%{"jobs" => jobs(pending, 100)}, [schedule(job_id(pending + 1))])

    due = @limits["due_jobs_per_advance"]

    assert length(changes(%{"jobs" => jobs(due, 1)}, for(n <- 1..due, do: complete(job_id(n))))) ==
             due

    assert over?(%{"jobs" => jobs(due + 1, 1)}, for(n <- 1..(due + 1), do: complete(job_id(n))))
  end

  # Review #49 N1. Breaks: a stored resource row without `at` raising out of compose (the
  # TypeScript twin faults precondition_failed on it).
  test "a malformed resource row faults instead of raising" do
    ref = %{
      "cartridge_id" => "c",
      "cartridge_version" => "1.0.0",
      "kind" => "resource",
      "key" => "hp"
    }

    t = %{"kind" => "resource", "resource" => ref, "entity_id" => "e"}
    spec = %{"minimum" => 0, "maximum" => 9, "start" => 9, "gain" => 1}

    state = %{
      "clock" => 7300,
      "resource_specs" => %{Compose.key(ref) => spec},
      "resources" => %{Compose.key(t) => %{"value" => 3}}
    }

    op = %{"op" => "resource.adjust", "writer_group" => 0, "resource" => ref, "entity_id" => "e"}

    assert Compose.compose(state, %{"ops" => [Map.merge(op, %{"from" => 3, "to" => 2})]}) ==
             %{"fault" => %{"kind" => "fault", "code" => "precondition_failed", "target" => t}}
  end

  # Review #50 A3/N1: the twin kernels agree on malformed barrier states (kernel/ts/test/
  # compose.test.ts has the same cases). Breaks: a stored false read as unset (the initial state
  # then used), or a from-state outside the legal table accepted.
  test "a malformed barrier state faults precondition_failed" do
    barrier = %{
      "cartridge_id" => "c",
      "cartridge_version" => "1.0.0",
      "kind" => "barrier",
      "key" => "d"
    }

    t = %{"kind" => "barrier", "barrier" => barrier}
    fault = %{"fault" => %{"kind" => "fault", "code" => "precondition_failed", "target" => t}}

    op =
      &%{
        "op" => "barrier.transition",
        "writer_group" => 0,
        "barrier" => barrier,
        "from" => &1,
        "to" => "open"
      }

    at = &%{"clock" => 0, "barrier_initial" => %{Compose.key(barrier) => &1}}

    stored = Map.put(at.("closed"), "barriers", %{Compose.key(t) => false})
    assert Compose.compose(stored, %{"ops" => [op.("closed")]}) == fault
    assert Compose.compose(at.("toString"), %{"ops" => [op.("toString")]}) == fault
  end

  # Seeded random deltas over a small id pool (so conflicts and failed preconditions are
  # common) through both kernels: canonical bytes and invariant results must match.
  @peer "kernel/ts/test/differential_peer.ts"
  test "differential: Elixir and TypeScript compose identically" do
    :rand.seed(:exsss, {5, 5, 5})
    pool = for c <- cases(), c["state"] in ~w(base pools), op <- c["ops"], do: op
    cases = for _ <- 1..1000, do: random_case(pool)

    ours =
      for %{"state" => s, "delta" => d} <- cases do
        result = Compose.compose(s, d)

        invariants =
          for id <- @compose_invariants,
              do: Invariants.check(id, %{"state" => s, "delta" => d, "result" => result})

        assert Enum.all?(invariants), inspect(d)
        %{"result" => result, "invariants" => invariants}
      end

    path =
      Path.join(System.tmp_dir!(), "loka-differential-#{System.unique_integer([:positive])}.json")

    File.write!(path, JSON.encode!(%{"ids" => @compose_invariants, "cases" => cases}))
    {theirs, 0} = System.cmd("node", [@peer, path])
    File.rm!(path)
    assert theirs == elem(Canonical.encode(ours), 1)
    faults = Enum.frequencies_by(ours, &get_in(&1, ["result", "fault", "code"]))
    assert map_size(faults) >= 6, "generator too narrow: #{inspect(faults)}"
  end

  @base @fixture["states"]["base"]
  defp pick(list), do: Enum.random(list)

  defp random_case(pool) do
    state =
      index(%{
        @base
        | "clock" => pick([pick(0..10), 3599, 3600, 7300]),
          "capacities" => Map.new(@base["capacities"], fn {e, _} -> {e, pick(0..1)} end),
          "facts" => Enum.take(@base["facts"], pick(0..1)),
          "barriers" => Enum.take(@base["barriers"], pick(0..1)) |> Map.new()
      })

    %{
      "state" => state,
      "delta" => %{"ops" => for(_ <- 1..pick(0..4)//1, do: random_op(pool, state))}
    }
  end

  @ents Map.keys(@base["containers"]) ++ [@hub]

  defp random_op(pool, state),
    do: vary(%{pick(pool) | "writer_group" => pick([0, 0, 0, 1, 2])}, state)

  defp vary(%{"op" => "entity.transfer", "entity_id" => e} = op, s) do
    here = s["containers"][e]
    %{op | "source_id" => pick([here, here, pick(@ents)]), "destination_id" => pick(@ents)}
  end

  defp vary(%{"op" => "time.advance"} = op, s),
    do: %{op | "from" => pick([s["clock"], pick(0..10)]), "to" => pick(0..20)}

  defp vary(%{"op" => "job.schedule"} = op, _), do: %{op | "due_time" => pick(0..30)}

  defp vary(%{"op" => "cooldown.start"} = op, s), do: %{op | "at" => pick([s["clock"], 6])}

  @doors ~w(open closed locked)
  defp vary(%{"op" => "barrier.transition"} = op, _),
    do: %{op | "from" => pick(@doors), "to" => pick(@doors)}

  # Often the current value, so adjustments pass and chain; `to` sometimes out of bounds.
  defp vary(%{"op" => "resource.adjust"} = op, s) do
    spec = s["resource_specs"][Compose.key(op["resource"])]

    now =
      spec && Compose.current(s["resources"][Compose.key(Compose.target(op))], spec, s["clock"])

    from = pick([now || 0, now || 0, pick(0..90)])
    %{op | "from" => from, "to" => from + pick(-12..3)}
  end

  defp vary(op, _), do: op
end
