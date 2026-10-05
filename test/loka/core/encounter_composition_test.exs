defmodule Loka.Core.EncounterCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/encounter_composition.json"))

  # Breaks: identity/location guards, stale rounds/jobs, lost binding or future cancellation rejected.
  test "encounter and bound job composition matches portable literal rows" do
    for c <- @fixture["cases"] do
      state = @fixture["states"][c["state"]]
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(state, delta) == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => state,
               "delta" => delta,
               "result" => c["expected"]
             }),
             c["id"]
    end
  end

  # Break: success-only proof accepts fabricated matching rows despite failed guards.
  test "independent encounter preconditions reject matching counterfeit success" do
    for c <- @fixture["cases"], c["counterfeit"] do
      refute Invariants.check("delta_preconditions_hold", %{
               "state" => @fixture["states"][c["state"]],
               "delta" => %{"ops" => c["ops"]},
               "result" => c["counterfeit"]
             }),
             c["id"]
    end
  end

  # Break: valid preconditions conceal omitted/miswritten encounter and job rows.
  test "independent replay verifies every written lifecycle row" do
    for c <- @fixture["cases"], c["expected"]["changes"] do
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
               "state" => @fixture["states"][c["state"]],
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
      state = times["states"][c["state"]]
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
  test "encounter and resource delivery fixtures agree across kernels" do
    ids =
      ~w(one_container_per_item containment_acyclic no_last_writer_wins
             delta_preconditions_hold fault_discards_whole_proposal fault_codes_are_evaluation_faults)

    for name <- ~w(encounter_composition resource_delivery_time) do
      fixture = JSON.decode!(File.read!("protocol/fixtures/#{name}.json"))

      cases =
        for c <- fixture["cases"],
            do: %{
              "state" => fixture["states"][c["state"]],
              "delta" => %{"ops" => c["ops"]}
            }

      expected =
        for {c, input} <- Enum.zip(fixture["cases"], cases) do
          assert Compose.compose(input["state"], input["delta"]) == c["expected"], c["id"]
          observation = Map.put(input, "result", c["expected"])
          assert Enum.all?(ids, &Invariants.check(&1, observation)), c["id"]
          %{"result" => c["expected"], "invariants" => List.duplicate(true, length(ids))}
        end

      path =
        Path.join(System.tmp_dir!(), "loka-encounter-#{System.unique_integer([:positive])}.json")

      try do
        File.write!(path, JSON.encode!(%{"ids" => ids, "cases" => cases}))
        {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", path])
        assert theirs == elem(Canonical.encode(expected), 1)
      after
        File.rm!(path)
      end
    end
  end
end
