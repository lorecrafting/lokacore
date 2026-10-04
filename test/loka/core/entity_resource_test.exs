defmodule Loka.Core.EntityResourceTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Contracts, Invariants}

  # Breaks: pool-only/entity-only lookup, required-row healing or partial adoption.
  test "entity-resource literals and independent preconditions" do
    fixture = JSON.decode!(File.read!("protocol/fixtures/entity_resource.json"))

    for c <- fixture["cases"] do
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]
      observation = %{"state" => c["state"], "delta" => delta, "result" => c["expected"]}
      assert Invariants.check("delta_preconditions_hold", observation), c["id"]

      if c["expected"]["fault"] do
        false_success = %{
          "changes" => [
            %{
              "target" => c["expected"]["fault"]["target"],
              "value" => %{"value" => 5, "at" => 64800}
            }
          ]
        }

        refute Invariants.check("delta_preconditions_hold", %{
                 observation
                 | "result" => false_success
               }),
               c["id"]
      end
    end
  end

  # Breaks: a missing required property, escaped numeric bounds, or unknown NPC HP field.
  test "NPC HP schema trust-boundary literals" do
    fixture = JSON.decode!(File.read!("protocol/fixtures/entity_resource.json"))

    for c <- fixture["contracts"],
        do: assert(Contracts.validate("NpcHp", c["value"]) == :ok == c["valid"], c["id"])
  end
end
