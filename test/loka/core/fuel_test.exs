defmodule Loka.Core.FuelTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Invariants, Canonical}
  @fixture JSON.decode!(File.read!("protocol/fixtures/fuel_composition.json"))
  # Break: the portable replacement accepts stale, malformed, undeclared or conflicting fuel writes.
  test "literal fuel replacements and independent preconditions" do
    for c <- @fixture["cases"] do
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => delta,
               "result" => c["expected"]
             }),
             c["id"]
    end
  end

  # Break: either kernel uses a different prior-row, bounds or writer-conflict interpretation.
  test "fuel portable differential" do
    cases =
      for c <- @fixture["cases"], do: %{"state" => c["state"], "delta" => %{"ops" => c["ops"]}}

    expected =
      for c <- @fixture["cases"], do: %{"result" => c["expected"], "invariants" => [true]}

    path = Path.join(System.tmp_dir!(), "loka-fuel-#{System.unique_integer([:positive])}.json")

    try do
      File.write!(path, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))
      {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", path])
      assert theirs == elem(Canonical.encode(expected), 1)
    after
      File.rm!(path)
    end
  end
end
