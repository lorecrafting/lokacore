defmodule Loka.Core.FixtureCompositionTest do
  # Every case of the fixtures listed below composes to its literal "expected" (and its
  # "prefix_expected" without the closing checks), validates as a StateDelta, satisfies the
  # independent precondition guard, and the guard refuses its "counterfeit" or
  # "counterfeit_success". A string "state" names a fixture "states" row, which may extend another.
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}

  defp fixture(name), do: JSON.decode!(File.read!("protocol/fixtures/#{name}.json"))

  @character JSON.decode!(File.read!("protocol/fixtures/character_composition.json"))
  @knowledge JSON.decode!(File.read!("protocol/fixtures/knowledge_composition.json"))["cases"]
  @crow JSON.decode!(File.read!("protocol/fixtures/crow_composition.json"))["cases"] ++
          JSON.decode!(File.read!("protocol/fixtures/crow_review_composition.json"))["cases"]
  @water JSON.decode!(File.read!("protocol/fixtures/water_composition.json"))["cases"]
  @c4 JSON.decode!(File.read!("protocol/fixtures/c4_pack_composition.json"))
  @suppression JSON.decode!(File.read!("protocol/fixtures/population_suppression.json"))["cases"]
  @population JSON.decode!(File.read!("protocol/fixtures/population_composition.json"))["cases"] ++
                @suppression
  @ids ~w(one_container_per_item containment_acyclic no_last_writer_wins delta_preconditions_hold
          fault_discards_whole_proposal fault_codes_are_evaluation_faults)
  @encounter JSON.decode!(File.read!("protocol/fixtures/encounter_composition.json"))

  for {group, names} <- [
        crow: ~w(crow_composition crow_review_composition),
        water: ~w(water_composition),
        population: ~w(population_composition population_suppression),
        c4_pack: ~w(c4_pack_composition),
        encounter: ~w(encounter_composition),
        knowledge: ~w(knowledge_composition)
      ] do
    # Breaks: a composer, the prefix composer or the independent precondition guard disagrees
    # with an independently authored literal answer, or the guard accepts a counterfeit success.
    test "#{group} composition matches the literal fixture answers" do
      for name <- unquote(names) do
        fixture = fixture(name)
        for c <- fixture["cases"], do: literal(state(fixture, c["state"]), c)
      end
    end
  end

  defp literal(state, c) do
    delta = %{"ops" => c["ops"]}
    assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
    assert Compose.compose(state, delta) == c["expected"], c["id"]

    if prefix = c["prefix_expected"],
      do: assert(Compose.compose(state, delta, false) == prefix, c["id"])

    observation = %{"state" => state, "delta" => delta, "result" => c["expected"]}
    assert Invariants.check("delta_preconditions_hold", observation), c["id"]

    if counterfeit = c["counterfeit"] || c["counterfeit_success"] do
      refute Invariants.check("delta_preconditions_hold", %{observation | "result" => counterfeit}),
             c["id"]
    end
  end

  defp state(fixture, name) when is_binary(name) do
    case fixture["states"][name] do
      %{"extends" => parent, "edits" => edits} ->
        Enum.reduce(edits, state(fixture, parent), fn edit, rows ->
          update_in(rows, [edit["section"]], &Map.put(&1 || %{}, edit["key"], edit["value"]))
        end)

      base ->
        base
    end
  end

  defp state(_fixture, state), do: state

  defp agree(dir, ids, cases, expected) do
    input = Path.join(dir, "cases.json")
    File.write!(input, JSON.encode!(%{"ids" => ids, "cases" => cases}))
    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
  end

  # Breaks: the new character target writes no portable row or permits a second selection.
  test "character selection's one-row and refusal answers are portable" do
    c = @character
    assert Compose.compose(c["state"], c["delta"]) == c["expected"]
    [op] = c["delta"]["ops"]
    selected = put_in(c, ["state", "characters"], %{op["character_id"] => op["value"]})
    assert Compose.compose(selected["state"], c["delta"]) == c["repeat"]
  end

  # Breaks: an existing malformed null character row is mistaken for an absent selection.
  test "present null character row refuses selection" do
    c = @character
    [op] = c["delta"]["ops"]
    state = Map.put(c["state"], "characters", %{op["character_id"] => nil})
    assert Compose.compose(state, c["delta"]) == c["present_null"]
  end

  # Break: present-null knowledge is mistaken for absence in a counterfeit successful composition.
  test "independent invariant refuses forged success over null knowledge" do
    for {bad, success} <- [
          {"null-visit-is-not-absence", "entry-records-distinct-actor-room"},
          {"null-observation-is-not-absence", "observation-retains-exact-npc-room-time"}
        ] do
      c = Enum.find(@knowledge, &(&1["id"] == bad))
      result = Enum.find(@knowledge, &(&1["id"] == success))["expected"]

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => %{"ops" => c["ops"]},
               "result" => result
             }),
             bad
    end
  end

  # Break: the invariant accepts a counterfeit write of a skipped, stale-based or first-visit count.
  test "independent invariant refuses forged counted visits" do
    for bad <- ~w(visit-count-cannot-skip stale-visit-from-refuses first-visit-has-no-count) do
      c = Enum.find(@knowledge, &(&1["id"] == bad))
      [op] = c["ops"]

      forged = %{
        "changes" => [%{"target" => c["expected"]["fault"]["target"], "value" => op["value"]}]
      }

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => %{"ops" => c["ops"]},
               "result" => forged
             }),
             bad
    end
  end

  # Breaks: an invariant accepts a claimed success without the crow row.
  test "crow invariant rejects counterfeit success" do
    c = hd(@crow)

    refute Invariants.check("delta_preconditions_hold", %{
             "state" => c["state"],
             "delta" => %{"ops" => c["ops"]},
             "result" => %{"changes" => []}
           })
  end

  # Breaks: requiredUnless accepts only its first alternative or accepts no binding.
  test "crow-only job cancellation validates, unbound cancellation does not" do
    op = %{
      "op" => "job.cancel",
      "writer_group" => 0,
      "job_id" => "44444444-4444-4444-8444-444444444444",
      "crow_member_id" => "11111111-1111-4111-8111-111111111111",
      "crow_generation" => 1
    }

    assert Contracts.validate("DeltaOp", op) == :ok

    assert {:error, _} =
             Contracts.validate("DeltaOp", Map.drop(op, ~w(crow_member_id crow_generation)))
  end

  # Breaks: a crow-bound job without a closed phase passes the portable wire validator.
  test "crow-bound schedule requires its closed phase" do
    c = Enum.find(@crow, &(&1["id"] == "schedule-phase-bound-crow-job"))
    op = hd(c["ops"])

    assert %{"fault" => %{"code" => "precondition_failed"}} =
             Compose.compose(c["state"], %{"ops" => [Map.delete(op, "crow_phase")]})

    assert {:error, _} = Contracts.validate("DeltaOp", %{op | "crow_phase" => "paused_return"})
  end

  # Breaks: the portable kernels differ despite both having checked literal cases.
  @tag :tmp_dir
  test "crow deltas agree across kernels", %{tmp_dir: dir} do
    cases = Enum.map(@crow, &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})
    expected = Enum.map(@crow, &%{"result" => &1["expected"], "invariants" => [true]})
    agree(dir, ["delta_preconditions_hold"], cases, expected)
  end

  # Breaks: independent precondition checks accept forged successful jobs with incomplete binding tuples.
  test "independent job invariant rejects partial actor/body/generation success" do
    good = Enum.find(@water, &(&1["id"] == "bound-expiry-occurrence"))

    for c <- @water, String.starts_with?(c["id"], "missing-job-binding-") do
      missing = String.replace_prefix(c["id"], "missing-job-binding-", "")

      fake =
        update_in(good["expected"], ["changes", Access.at(0), "value"], &Map.delete(&1, missing))

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => %{"ops" => c["ops"]},
               "result" => fake
             })
    end
  end

  # Breaks: portable kernels differ despite literal individual answers.
  @tag :tmp_dir
  test "water deltas agree across kernels", %{tmp_dir: dir} do
    cases = Enum.map(@water, &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})
    :rand.seed(:exsss, {6, 6000, 70800})
    literal = hd(@water)

    randomized =
      for _ <- 1..200 do
        generation = :rand.uniform(1000)

        active =
          literal["ops"] |> hd() |> Map.fetch!("value") |> Map.put("generation", generation + 1)

        prior =
          Map.merge(active, Map.new(~w(room_id entered_at deadline job_id), &{&1, nil}))
          |> Map.put("generation", generation)

        actor = hd(literal["ops"])["actor_id"]
        state = Map.put(literal["state"], "water", %{actor => prior})
        op = hd(literal["ops"]) |> Map.put("expected", prior) |> Map.put("value", active)

        op =
          if rem(generation, 2) == 0,
            do: put_in(op, ["value", "generation"], generation),
            else: op

        %{"state" => state, "delta" => %{"ops" => [op]}}
      end

    cases = cases ++ randomized

    expected =
      Enum.map(@water, &%{"result" => &1["expected"], "invariants" => [true]}) ++
        Enum.map(randomized, fn c ->
          result = Compose.compose(c["state"], c["delta"])

          %{
            "result" => result,
            "invariants" => [
              Invariants.check("delta_preconditions_hold", %{
                "state" => c["state"],
                "delta" => c["delta"],
                "result" => result
              })
            ]
          }
        end)

    agree(dir, ["delta_preconditions_hold"], cases, expected)
  end

  # Breaks: final flight proof is applied to a lawful prefix before encounter closure.
  test "a legal transfer and stamp compose before their round exit is appended" do
    c =
      Enum.find(
        @c4["cases"],
        &(&1["id"] == "flight-stamp-requires-same-group-encounter-exit")
      )

    assert Compose.compose(state(@c4, c["state"]), %{"ops" => c["ops"]}, false) ==
             c["counterfeit"]
  end

  # Break: the kernels' encounter or pack composers or guards disagree on a mixed delta (toolbox
  # row 6c; compose_test.exs's random pool and the simulator sample carry no encounter op).
  @tag :tmp_dir
  test "random mixes of pack ops compose identically in both kernels", %{tmp_dir: dir} do
    :rand.seed(:exsss, {6, 6, 6})
    pool = for c <- @c4["cases"], op <- c["ops"], do: op
    wobble = &%{&1 | "writer_group" => Enum.random([0, 0, 1])}

    cases =
      for _ <- 1..300 do
        c = Enum.random(@c4["cases"])
        own = Enum.take_random(c["ops"], Enum.random(1..length(c["ops"])))
        ops = Enum.map(own ++ Enum.take_random(pool, Enum.random(0..1)), wobble)
        %{"state" => state(@c4, c["state"]), "delta" => %{"ops" => ops}}
      end

    ours =
      for input <- cases do
        result = Compose.compose(input["state"], input["delta"])
        assert Enum.all?(@ids, &Invariants.check(&1, Map.put(input, "result", result)))
        %{"result" => result, "invariants" => List.duplicate(true, length(@ids))}
      end

    agree(dir, @ids, cases, ours)

    results = Enum.frequencies_by(ours, &(get_in(&1, ["result", "fault", "code"]) || :ok))
    assert Map.get(results, :ok, 0) >= 15 and map_size(results) >= 3, inspect(results)
  end

  # Breaks: portable kernels differ despite literal individual answers.
  @tag :tmp_dir
  test "population deltas agree across kernels", %{tmp_dir: dir} do
    cases = Enum.map(@population, &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})
    expected = Enum.map(@population, &%{"result" => &1["expected"], "invariants" => [true]})
    agree(dir, ["delta_preconditions_hold"], cases, expected)
  end

  # Breaks: nonliteral suppression deadlines/generations drift between portable CAS and replay.
  @tag :tmp_dir
  test "randomized suppression rows agree after literal oracle checks", %{tmp_dir: dir} do
    :rand.seed(:exsss, {9, 40, 2026})

    cases =
      for _ <- 1..120 do
        c = Enum.random(@suppression)
        offset = :rand.uniform(100_000)
        bump = :rand.uniform(100)

        change = fn row ->
          case row["suppression"] do
            nil ->
              row

            suppression ->
              suppression = Map.update!(suppression, "generation", &(&1 + bump))

              suppression =
                Map.update!(suppression, "ends_at", &if(is_nil(&1), do: nil, else: &1 + offset))

              Map.put(row, "suppression", suppression)
          end
        end

        state =
          update_in(
            c["state"],
            ["population_plans"],
            &Map.new(&1, fn {k, v} -> {k, change.(v)} end)
          )

        ops =
          Enum.map(
            c["ops"],
            &(&1 |> Map.update!("expected", change) |> Map.update!("value", change))
          )

        %{"state" => state, "delta" => %{"ops" => ops}}
      end

    expected =
      Enum.map(cases, fn %{"state" => state, "delta" => delta} ->
        result = Compose.compose(state, delta)

        assert Invariants.check("delta_preconditions_hold", %{
                 "state" => state,
                 "delta" => delta,
                 "result" => result
               })

        %{"result" => result, "invariants" => [true]}
      end)

    assert Enum.any?(expected, &Map.has_key?(&1["result"], "changes"))
    assert Enum.any?(expected, &Map.has_key?(&1["result"], "fault"))
    agree(dir, ["delta_preconditions_hold"], cases, expected)
  end

  # Break: valid preconditions conceal omitted/miswritten encounter and job rows.
  test "independent replay verifies every written lifecycle row" do
    for c <- @encounter["cases"], c["expected"]["changes"] do
      changes =
        Enum.map(c["expected"]["changes"], fn change ->
          case change["target"]["kind"] do
            "encounter" ->
              update_in(change, ["value", "round"], &(&1 + 1))

            "job" ->
              put_in(change, ["value", "encounter_id"], "ffffffff-0000-4000-8000-000000000000")

            _ ->
              change
          end
        end)

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => state(@encounter, c["state"]),
               "delta" => %{"ops" => c["ops"]},
               "result" => %{"changes" => changes}
             }),
             c["id"]
    end
  end

  # Break: cancellation fails to free a pending-job budget slot for a replacement.
  test "cancelling a future job frees one slot in a full queue" do
    first = "aaaaaaaa-0000-4000-8000-000000000001"
    encounter = "00000006-0000-4000-8000-000000000000"
    next = "00000008-0000-4000-8000-000000000000"

    job = %{
      "cartridge_id" => "lantern",
      "cartridge_version" => "0.1.0",
      "kind" => "npc",
      "key" => "wolf"
    }

    queued = %{"job" => job, "due_time" => 20, "status" => "pending", "encounter_id" => encounter}

    jobs =
      for i <- 1..1024,
          into: %{},
          do:
            {"aaaaaaaa-0000-4000-8000-" <> String.pad_leading(Integer.to_string(i), 12, "0"),
             queued}

    ops = [
      %{
        "op" => "job.cancel",
        "writer_group" => 0,
        "job_id" => first,
        "encounter_id" => encounter
      },
      %{
        "op" => "job.schedule",
        "writer_group" => 0,
        "job_id" => next,
        "job" => job,
        "due_time" => 30,
        "encounter_id" => encounter
      }
    ]

    assert Compose.compose(%{"clock" => 10, "jobs" => jobs}, %{"ops" => ops}) == %{
             "changes" => [
               %{
                 "target" => %{"kind" => "job", "job_id" => next},
                 "value" => %{
                   "job" => job,
                   "due_time" => 30,
                   "status" => "pending",
                   "encounter_id" => encounter
                 }
               },
               %{
                 "target" => %{"kind" => "job", "job_id" => first},
                 "value" => %{
                   "job" => job,
                   "due_time" => 20,
                   "status" => "cancelled",
                   "encounter_id" => encounter
                 }
               }
             ]
           }
  end

  # Break: due-time settlement ignores explicit at, escapes the advance, or settles backwards.
  test "resource delivery times match literals and independent preconditions" do
    times = JSON.decode!(File.read!("protocol/fixtures/resource_delivery_time.json"))

    for c <- times["cases"] do
      state = state(times, c["state"])
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(state, delta) == c["expected"], c["id"]
      observation = %{"state" => state, "delta" => delta, "result" => c["expected"]}
      assert Invariants.check("delta_preconditions_hold", observation), c["id"]

      counterfeit =
        c["counterfeit"] ||
          update_in(c["expected"], ["changes", Access.at(0), "value", "at"], &(&1 + 1))

      refute Invariants.check("delta_preconditions_hold", %{observation | "result" => counterfeit}),
             c["id"]
    end
  end

  # Break: portable encounter or delivery-time semantics diverge between kernels.
  @tag :tmp_dir
  test "encounter and resource delivery fixtures agree across kernels", %{tmp_dir: dir} do
    for name <- ~w(encounter_composition resource_delivery_time) do
      fixture = JSON.decode!(File.read!("protocol/fixtures/#{name}.json"))

      cases =
        for c <- fixture["cases"],
            do: %{
              "state" => state(fixture, c["state"]),
              "delta" => %{"ops" => c["ops"]}
            }

      expected =
        for {c, input} <- Enum.zip(fixture["cases"], cases) do
          assert Compose.compose(input["state"], input["delta"]) == c["expected"], c["id"]
          observation = Map.put(input, "result", c["expected"])
          assert Enum.all?(@ids, &Invariants.check(&1, observation)), c["id"]
          %{"result" => c["expected"], "invariants" => List.duplicate(true, length(@ids))}
        end

      agree(dir, @ids, cases, expected)
    end
  end
end
