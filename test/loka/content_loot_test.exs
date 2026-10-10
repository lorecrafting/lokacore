defmodule Loka.ContentLootTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/loot_sampler")}

  # Breaks: drops under API 1.42, without world.death, naming an item the NPC does not hold, a
  # repeated item or an unknown item compile (toolbox row 8; twin of the loader rows in
  # kernel/ts/test/loot.test.ts).
  test "drops keep their API floor, death settings, held distinct items and references", %{
    dir: dir
  } do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    coin = ["drops", Access.at(1), "item"]

    cases = [
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.42"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {"cartridge.json", &update_in(&1, ["world"], fn w -> Map.delete(w, "death") end),
       {"SCHEMA_VIOLATION", "npcs/rat.drops"}},
      {"npcs/rat.json", &put_in(&1, coin, "tail"), {"SCHEMA_VIOLATION", "npcs/rat.drops[1]"}},
      {"npcs/rat.json", &put_in(&1, coin, "bone"),
       {"UNRESOLVED_REFERENCE", "npcs/rat.drops[1].item"}},
      {"items/coin.json", &put_in(&1, ["location"], %{"in" => "room", "room" => "pit"}),
       {"SCHEMA_VIOLATION", "npcs/rat.drops[1]"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
