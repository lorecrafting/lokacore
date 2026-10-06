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

  # Breaks: pack admission accepts a foreign member, or a flight stamp names the unselected hound.
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

  # Breaks: final flight proof is applied to a lawful prefix before encounter closure.
  test "a legal transfer and stamp compose before their round exit is appended" do
    c =
      Enum.find(
        @fixture["cases"],
        &(&1["id"] == "flight-stamp-requires-same-group-encounter-exit")
      )

    assert Compose.compose(state(c["state"]), %{"ops" => c["ops"]}, false) == c["counterfeit"]
  end
end
