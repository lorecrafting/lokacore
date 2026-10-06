defmodule Loka.Core.FoodTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Invariants}
  @cases JSON.decode!(File.read!("protocol/fixtures/food_composition.json"))["cases"]
  # Breaks: terminal custody is reversible or admits nonfood/foreign/nested sources.
  test "literal terminal custody composition and independent precondition observation" do
    for c <- @cases do
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => delta,
               "result" => c["observation"]
             }) == c["holds"],
             c["id"]
    end
  end

  # Breaks: the two portable terminal guards disagree on repeated transfers with overlay custody.
  test "seeded terminal transfer proposals agree across kernels" do
    :rand.seed(:exsss, {4, 4, 4})

    cases =
      for _ <- 1..200 do
        c = Enum.random(@cases)

        %{
          "state" => c["state"],
          "delta" => %{"ops" => for(_ <- 1..Enum.random(1..4), do: Enum.random(c["ops"]))}
        }
      end

    results =
      for c <- cases do
        result = Compose.compose(c["state"], c["delta"])

        %{
          "result" => result,
          "invariants" => [
            Invariants.check("delta_preconditions_hold", Map.put(c, "result", result))
          ]
        }
      end

    path =
      Path.join(System.tmp_dir!(), "loka-food-diff-#{System.unique_integer([:positive])}.json")

    File.write!(path, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))

    try do
      {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", path])
      assert theirs == elem(Canonical.encode(results), 1)
    after
      File.rm!(path)
    end
  end
end
