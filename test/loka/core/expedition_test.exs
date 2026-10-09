defmodule Loka.Core.ExpeditionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Contracts, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/expedition.json"))

  # Breaks: the Elixir composer accepts a stale expected row, a rebound instance, a cursor
  # jump, a reused attempt, a second shelter or a restart after completion.
  test "expedition composition matches literal lifecycle and refusal rows" do
    for c <- @fixture["cases"] do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]
    end
  end

  # Breaks: the Elixir precondition replay skips expedition rows, reads the wrong prior row, or
  # trusts a counterfeit success over a stale expected row.
  test "expedition preconditions replay against the prior row" do
    for c <- @fixture["cases"] do
      observation = %{"state" => c["state"], "delta" => %{"ops" => c["ops"]}}

      assert Invariants.check(
               "delta_preconditions_hold",
               Map.put(observation, "result", c["expected"])
             ),
             c["id"]

      if c["id"] == "stale expected row" do
        [op] = c["ops"]

        forged = %{
          "changes" => [%{"target" => c["expected"]["fault"]["target"], "value" => op["value"]}]
        }

        refute Invariants.check(
                 "delta_preconditions_hold",
                 Map.put(observation, "result", forged)
               )
      end
    end
  end
end
