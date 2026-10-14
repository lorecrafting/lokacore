defmodule Loka.ContentFenTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row W12; twin of the loader test in kernel/ts/test/fen.test.ts): the plan gate's
  # population_count compiles under API 1.85 or names no plan, the gate takes an actor leaf, or a
  # floor exceeds day_target.
  test "a plan gate keeps API 1.86, resolves its plan, reads no actor; floor at most day_target" do
    dir = Loka.ContentSource.copy("cartridges/fen_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    deer = "populations/deer.json"
    leaf = ["birth_when", "root", "item"]
    old = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.85")}

    for {edits, expected} <- [
          {[old], {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
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
