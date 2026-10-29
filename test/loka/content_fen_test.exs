defmodule Loka.ContentFenTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row W12): the plan gate's
  # population_count names no plan, the gate takes an actor leaf, or a
  # floor exceeds day_target.
  test "a plan gate resolves its plan, reads no actor; floor at most day_target" do
    dir = Loka.ContentSource.copy("cartridges/fen_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    deer = "populations/deer.json"
    leaf = ["birth_when", "root", "item"]

    for {edits, expected} <- [
          {[{deer, &put_in(&1, leaf ++ ["plan"], "nowhere")}],
           {"UNRESOLVED_REFERENCE", "populations/deer.birth_when.root.item.plan"}},
          {[{deer, &put_in(&1, leaf, %{"op" => "has_item", "item" => "tuft"})}],
           {"SCHEMA_VIOLATION", "populations/deer.birth_when"}},
          {[{deer, &%{&1 | "floor" => 4}}], {"SCHEMA_VIOLATION", "populations/deer.floor"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
