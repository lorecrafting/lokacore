defmodule Loka.ContentFearTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/fear_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  # Breaks (toolbox row W21): a co_present step also names its holder, or a fear status without
  # per_tick (the sampler's afraid) is refused.
  test "co_present names no holder", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    for {field, key} <- [{"npc", "guard"}, {"item", "ear"}] do
      named = &put_in(&1, ["steps", Access.at(0), field], key)
      path = "reactions/leader_fell.steps[0].#{field}"
      assert {"SCHEMA_VIOLATION", path} in diags(dir, [{"reactions/leader_fell.json", named}])
    end
  end
end
