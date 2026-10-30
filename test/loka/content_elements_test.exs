defmodule Loka.ContentElementsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/elements_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  # Breaks (row G3): a reaction cure of an undeclared status compiles.
  test "a reaction cure names a declared status", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    cure = %{"op" => "status.cure", "status" => "wet"}
    ash = &update_in(&1, ["steps"], fn a -> a ++ [%{cure | "status" => "ash"}] end)

    assert {"UNRESOLVED_REFERENCE", "reactions/spark.steps[1].status"} in diags(dir, [
             {"reactions/spark.json", ash}
           ])
  end
end
