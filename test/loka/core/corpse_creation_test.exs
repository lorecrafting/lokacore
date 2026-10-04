defmodule Loka.Core.CorpseCreationTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Contracts, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/corpse_creation.json"))

  # Breaks: arbitrary absent-source upsert, orphan identity, collisions, wrong owner or writer.
  test "portable creation/custody literals and independent success proof" do
    for c <- @fixture["cases"] do
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]
      observation = %{"state" => c["state"], "delta" => delta, "result" => c["expected"]}

      for check <- ~w(delta_preconditions_hold one_container_per_item),
          do: assert(Invariants.check(check, observation), c["id"])

      if c["expected"]["fault"] do
        fabricated = hd(@fixture["cases"])["expected"]

        refute Invariants.check("delta_preconditions_hold", %{
                 observation
                 | "result" => fabricated
               }),
               c["id"]
      end
    end
  end

  # Breaks: nullable unions accept wrong scalar types, missing fields/bounds or unknown data.
  test "new contract trust boundaries" do
    for c <- @fixture["contracts"],
        do: assert(Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"], c["id"])
  end
end
