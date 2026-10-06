defmodule Loka.Core.PopulationCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}
  @cases JSON.decode!(File.read!("protocol/fixtures/population_composition.json"))["cases"]

  # Breaks: stale prior slots, illegal replacement and cross-writer writes are accepted.
  test "population rows match independent literal composition answers" do
    for c <- @cases do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]

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
end
