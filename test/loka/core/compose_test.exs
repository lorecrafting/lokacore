# size: allow 525, patrol, liquid, expedition rows and authored gain share the existing randomized differential pool
defmodule Loka.Core.ComposeTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}

  @fixture JSON.decode!(File.read!("protocol/fixtures/composition.json"))
  @invariant_cases @fixture["invariants"] ++
                     JSON.decode!(File.read!("protocol/fixtures/liquid_composition.json"))[
                       "invariants"
                     ]
  @limits JSON.decode!(File.read!("docs/spec/conformance/composition-profile.json"))["limits"]
  @registered for i <- JSON.decode!(File.read!("protocol/invariants.json")),
                  i["implemented_in"] == "elixir_and_typescript",
                  do: i["id"]
  @compose_invariants ~w(one_container_per_item containment_acyclic no_last_writer_wins
                         delta_preconditions_hold fault_discards_whole_proposal
                         fault_codes_are_evaluation_faults)

  defp index(state) do
    state
    |> Map.update("facts", %{}, &Map.new(&1, fn r -> {Compose.key(r["target"]), r["value"]} end))
    |> Map.update(
      "fact_defaults",
      %{},
      &Map.new(&1, fn r -> {Compose.key(r["fact"]), r["value"]} end)
    )
  end

  defp state(s) when is_map(s), do: s

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

  test "invariant checks known answers, a holding and a violated case per invariant checked in both kernels" do
    for c <- @invariant_cases do
      obs = Map.update(c["observation"], "state", nil, &state/1)
      assert Invariants.check(c["id"], obs) == c["holds"], "#{c["id"]}: #{c["note"]}"
    end

    covered = for c <- @invariant_cases, uniq: true, do: {c["id"], c["holds"]}
    for id <- @registered, holds <- [true, false], do: assert({id, holds} in covered, id)
  end

  # Breaks: delta_preconditions_hold accepts an invalid success when it checks only from-values.
  test "invalid successful deltas fail their independent precondition check" do
    refute Invariants.check("delta_preconditions_hold", %{
             "state" => %{},
             "delta" => %{"ops" => []},
             "result" => %{"changes" => []}
           })

    ids = ~w(choice-resolve-not-offered choice-resolve-wrong-revision
             quest-transition-skips-objectives-complete quest-activate-while-open-in-scope
             capacity-all-or-nothing transfer-into-descendant
             resource-below-minimum-never-clamps time-advance-not-later
             job-schedule-at-current-time job-complete-not-due
             barrier-lock-while-open cooldown-start-at-not-base-clock)

    for id <- ids do
      c = Enum.find(@fixture["cases"], &(&1["id"] == id))
      assert c, id

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => state(c["state"]),
               "delta" => %{"ops" => c["ops"]},
               "result" => %{"changes" => []}
             }) == false,
             id
    end
  end

  # Breaks: an optimized cycle walk checks only moved rows, or skips capacity.
  test "containment checks deep chains, untouched cycles and untouched capacity" do
    chain = Map.new(1..5000, &{"n#{&1}", "n#{&1 + 1}"})

    holds =
      &Invariants.check("containment_acyclic", %{"state" => &1, "result" => %{"changes" => []}})

    assert holds.(%{"containers" => chain})
    refute holds.(%{"containers" => Map.put(chain, "n5001", "n4999")})
    refute holds.(%{"containers" => %{"a" => "box", "b" => "box"}, "capacities" => %{"box" => 1}})
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

  # Seeded small-pool deltas exercise conflicts, authored gain and preconditions across both kernels.
  @peer "kernel/ts/test/differential_peer.ts"
  test "differential: Elixir and TypeScript compose identically" do
    for c <- JSON.decode!(File.read!("protocol/fixtures/corpse_creation.json"))["cases"],
        do: differential([%{"state" => c["state"], "delta" => %{"ops" => c["ops"]}}])

    knowledge = JSON.decode!(File.read!("protocol/fixtures/knowledge_composition.json"))["cases"]
    expedition = JSON.decode!(File.read!("protocol/fixtures/expedition.json"))["cases"]

    for c <- knowledge ++ expedition,
        do: differential([%{"state" => c["state"], "delta" => %{"ops" => c["ops"]}}])

    :rand.seed(:exsss, {5, 5, 5})
    patrol = JSON.decode!(File.read!("protocol/fixtures/patrol.json"))["cases"]

    pool =
      for(c <- cases(), c["state"] in ~w(base pools), op <- c["ops"], do: op) ++
        for c <- patrol ++ knowledge ++ expedition, op <- c["ops"], do: op

    ours = differential(for _ <- 1..1000, do: random_case(pool))
    faults = Enum.frequencies_by(ours, &get_in(&1, ["result", "fault", "code"]))
    assert map_size(faults) >= 6, "generator too narrow: #{inspect(faults)}"
  end

  # Break: kernels disagree on real simulator deltas (resources, barriers, fact defaults).
  test "differential on 300 simulator proposals" do
    {out, 0} = System.cmd("node", ["kernel/ts/test/sim_sample.ts", "300"])
    ours = differential(JSON.decode!(out))
    assert length(ours) == 300
    assert Enum.all?(ours, &Map.has_key?(&1["result"], "changes"))
  end

  defp differential(cases) do
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
    ours
  end

  @base Map.update!(@fixture["states"]["base"], "resource_specs", fn specs ->
          Map.new(specs, fn {ref, spec} ->
            {ref, Map.put(spec, "gain_every", 100)}
          end)
        end)
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

  defp vary(%{"op" => "patrol.transition"} = op, s),
    do:
      Map.put(
        op,
        "expected",
        pick([op["expected"], nil, get_in(s, ["patrols", op["quest_instance_id"]])])
      )

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

  # Breaks: old-rate settlement, fraction retention/cap reset, zero rate, unsafe absence or malformed metadata.
  test "opted recovery literal rows and independent metadata replay" do
    fixture = JSON.decode!(File.read!("protocol/fixtures/resource_recovery.json"))

    for c <- fixture["cases"] do
      spec = c["spec"] || fixture["spec"]
      resources = if c["row"] == nil, do: %{}, else: %{Compose.key(fixture["target"]) => c["row"]}

      state = %{
        "clock" => c["clock"],
        "resource_specs" => %{Compose.key(fixture["resource"]) => spec},
        "resources" => resources
      }

      ops =
        Enum.map(
          c["ops"],
          &Map.merge(
            %{
              "op" => "resource.adjust",
              "writer_group" => 0,
              "resource" => fixture["resource"],
              "entity_id" => fixture["target"]["entity_id"]
            },
            &1
          )
        )

      ops =
        if c["advance"] == nil,
          do: ops,
          else:
            ops ++
              [
                %{
                  "op" => "time.advance",
                  "writer_group" => 0,
                  "from" => c["clock"],
                  "to" => c["advance"]
                }
              ]

      delta = %{"ops" => ops}
      assert Compose.compose(state, delta) == c["expected"], c["id"]
      observation = %{"state" => state, "delta" => delta, "result" => c["expected"]}
      assert Invariants.check("delta_preconditions_hold", observation), c["id"]

      case c["expected"] do
        %{"fault" => _} ->
          fake = %{
            "changes" => [
              %{
                "target" => fixture["target"],
                "value" => %{"value" => 0, "at" => c["clock"], "rate" => 2, "remainder" => 0}
              }
            ]
          }

          refute Invariants.check("delta_preconditions_hold", %{observation | "result" => fake}),
                 c["id"]

        %{"changes" => [row | _]} ->
          fake = %{"changes" => [put_in(row, ["value", "remainder"], -1)]}

          refute Invariants.check("delta_preconditions_hold", %{observation | "result" => fake}),
                 c["id"]

          if c["query"] do
            assert Compose.current(row["value"], spec, c["query"]["at"]) == c["query"]["value"],
                   c["id"]
          end
      end
    end
  end

  # Breaks: independent replay accepts an unauthored stored rate when the next rate is authored.
  test "independent recovery replay rejects an unauthored stored rate" do
    fixture = JSON.decode!(File.read!("protocol/fixtures/resource_recovery.json"))
    row = %{"value" => 0, "at" => 64800, "rate" => 3, "remainder" => 0}

    state = %{
      "clock" => 64803,
      "resource_specs" => %{Compose.key(fixture["resource"]) => fixture["spec"]},
      "resources" => %{Compose.key(fixture["target"]) => row}
    }

    delta = %{
      "ops" => [
        %{
          "op" => "resource.adjust",
          "writer_group" => 0,
          "resource" => fixture["resource"],
          "entity_id" => fixture["target"]["entity_id"],
          "from" => 0,
          "to" => 0,
          "next_rate" => 2
        }
      ]
    }

    # Without stored-rate validation, 3 elapsed ticks at rate 3 yield value 0 and remainder 9.
    forged = %{"value" => 0, "at" => 64803, "rate" => 2, "remainder" => 9}
    result = %{"changes" => [%{"target" => fixture["target"], "value" => forged}]}
    observation = %{"state" => state, "delta" => delta, "result" => result}
    refute Invariants.check("delta_preconditions_hold", observation)
  end

  # Breaks: optional recovery schemas accept omitted table fields, unsafe/negative rates or malformed intervals.
  test "recovery schema trust-boundary literals" do
    fixture = JSON.decode!(File.read!("protocol/fixtures/resource_recovery.json"))

    for c <- fixture["contracts"] do
      errors =
        Enum.map(c["errors"], &%{path: &1["path"], code: String.to_existing_atom(&1["code"])})

      expected = if errors == [], do: :ok, else: {:error, errors}
      assert Contracts.validate(c["contract"], c["value"]) == expected, c["id"]
    end
  end
end
