defmodule Loka.Core.KnowledgeCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Invariants}
  @cases JSON.decode!(File.read!("protocol/fixtures/knowledge_composition.json"))["cases"]

  # Breaks: actor/target identity, first-visit insertion or observation monotonicity differs on BEAM.
  test "knowledge writes and refusals match independently authored answers" do
    for c <- @cases do
      delta = %{"ops" => c["ops"]}
      result = Compose.compose(c["state"], delta)
      assert result == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => delta,
               "result" => result
             })
    end
  end

  # Break: present-null knowledge is mistaken for absence in a counterfeit successful composition.
  test "independent invariant refuses forged success over null knowledge" do
    for {bad, success} <- [
          {"null-visit-is-not-absence", "entry-records-distinct-actor-room"},
          {"null-observation-is-not-absence", "observation-retains-exact-npc-room-time"}
        ] do
      c = Enum.find(@cases, &(&1["id"] == bad))
      result = Enum.find(@cases, &(&1["id"] == success))["expected"]

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => %{"ops" => c["ops"]},
               "result" => result
             }),
             bad
    end
  end
end
