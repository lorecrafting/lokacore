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
end
