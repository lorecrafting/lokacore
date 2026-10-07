defmodule Loka.Core.PopulationCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}
  @prior JSON.decode!(File.read!("protocol/fixtures/population_composition.json"))["cases"]

  @suppression JSON.decode!(File.read!("protocol/fixtures/population_suppression.json"))["cases"]
  @cases @prior ++ @suppression

  # Breaks: stale prior slots, illegal replacement and cross-writer writes are accepted.
  test "population rows match independent literal composition answers" do
    for c <- @cases do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]

      if c["counterfeit_success"] do
        refute Invariants.check("delta_preconditions_hold", %{
                 "state" => c["state"],
                 "delta" => delta,
                 "result" => c["counterfeit_success"]
               }),
               c["id"]
      end

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

  # Breaks: portable kernels differ despite literal individual answers.
  @tag :tmp_dir
  test "population deltas agree across kernels", %{tmp_dir: dir} do
    cases = Enum.map(@cases, &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})
    input = Path.join(dir, "population.json")
    File.write!(input, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))
    expected = Enum.map(@cases, &%{"result" => &1["expected"], "invariants" => [true]})
    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
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
    input = Path.join(dir, "suppression.json")
    File.write!(input, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))
    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
  end
end
