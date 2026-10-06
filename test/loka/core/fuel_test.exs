defmodule Loka.Core.FuelTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Invariants, Canonical}
  @fixture JSON.decode!(File.read!("protocol/fixtures/fuel_composition.json"))
  @base hd(@fixture["cases"])
  @op hd(@base["ops"])
  @item @op["item_id"]
  @specs Map.values(@base["state"]["fuel_specs"])
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

    :rand.seed(:exsss, {17, 23, 41})
    randomized = for _ <- 1..200, do: random_input()

    ours =
      for input <- randomized do
        result = Compose.compose(input["state"], input["delta"])
        observation = Map.put(input, "result", result)

        %{
          "result" => result,
          "invariants" => [Invariants.check("delta_preconditions_hold", observation)]
        }
      end

    cases = cases ++ randomized
    expected = expected ++ ours

    path = Path.join(System.tmp_dir!(), "loka-fuel-#{System.unique_integer([:positive])}.json")

    try do
      File.write!(path, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))
      {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", path])
      assert theirs == elem(Canonical.encode(expected), 1)
    after
      File.rm!(path)
    end
  end

  defp random_input do
    capacity = :rand.uniform(50)

    spec =
      Enum.at(@specs, :rand.uniform(2) - 1)
      |> Map.merge(%{"capacity" => capacity, "initial" => 0})

    row = %{
      "remaining" => :rand.uniform(capacity + 1) - 1,
      "at" => :rand.uniform(101) - 1,
      "lit" => spec["kind"] == "source" and :rand.uniform(2) == 1
    }

    from =
      if :rand.uniform(3) == 1, do: Map.put(row, "remaining", row["remaining"] + 1), else: row

    to = %{
      "remaining" => :rand.uniform(capacity + 3) - 2,
      "at" => 98 + :rand.uniform(3),
      "lit" => :rand.uniform(2) == 1
    }

    op = Map.merge(@op, %{"from" => from, "to" => to})

    %{
      "state" => %{"clock" => 100, "fuel_specs" => %{@item => spec}, "fuel" => %{@item => row}},
      "delta" => %{"ops" => [op]}
    }
  end
end
