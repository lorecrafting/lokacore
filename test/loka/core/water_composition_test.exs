defmodule Loka.Core.WaterCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}
  @cases JSON.decode!(File.read!("protocol/fixtures/water_composition.json"))["cases"]

  # Breaks: stale prior water rows, wrong generation/body/custody and cross-writer writes are accepted.
  test "water rows match independent literal composition answers" do
    for c <- @cases do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]

      if c["prefix_expected"],
        do: assert(Compose.compose(c["state"], delta, false) == c["prefix_expected"], c["id"])

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => delta,
               "result" => c["expected"]
             }),
             c["id"]
    end
  end

  # Breaks: independent precondition checks accept forged successful jobs with incomplete binding tuples.
  test "independent job invariant rejects partial actor/body/generation success" do
    good = Enum.find(@cases, &(&1["id"] == "bound-expiry-occurrence"))

    for c <- @cases, String.starts_with?(c["id"], "missing-job-binding-") do
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
    cases = Enum.map(@cases, &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})
    :rand.seed(:exsss, {6, 6000, 70800})
    literal = hd(@cases)

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
    input = Path.join(dir, "water.json")
    File.write!(input, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))

    expected =
      Enum.map(@cases, &%{"result" => &1["expected"], "invariants" => [true]}) ++
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

    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
  end
end
