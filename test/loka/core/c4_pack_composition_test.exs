defmodule Loka.Core.C4PackCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/c4_pack_composition.json"))

  defp state(name) do
    case @fixture["states"][name] do
      %{"extends" => parent, "edits" => edits} ->
        Enum.reduce(edits, state(parent), fn edit, rows ->
          update_in(rows, [edit["section"]], &Map.put(&1 || %{}, edit["key"], edit["value"]))
        end)

      base ->
        base
    end
  end

  # Breaks: pack admission accepts a foreign plan member or a roster beyond its plan cap.
  test "literal exact pack admission and refusals agree with both independent guards" do
    for c <- @fixture["cases"] do
      state = state(c["state"])
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(state, delta) == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => state,
               "delta" => delta,
               "result" => c["expected"]
             }),
             c["id"]

      if c["counterfeit"] do
        refute Invariants.check("delta_preconditions_hold", %{
                 "state" => state,
                 "delta" => delta,
                 "result" => c["counterfeit"]
               }),
               c["id"]
      end
    end
  end
end
