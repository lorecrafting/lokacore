defmodule Loka.ContentTargetsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/targets_sampler")}

  # Breaks (toolbox row 6b): allies
  # name a spawn template, an NPC without an attack or nothing, or lack their narration.
  test "allies keep their authored fighters and narration", %{dir: dir} do
    combat = ["world", "combat"]

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, combat ++ ["allies"], ["goblin"])},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.allies[0]"}},
          {{"npcs/guard.json", &Map.delete(&1, "attack")},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.allies[0]"}},
          {{"cartridge.json", &put_in(&1, combat ++ ["allies"], ["nobody"])},
           {"UNRESOLVED_REFERENCE", "cartridge.world.combat.allies[0]"}},
          {{"cartridge.json", &(pop_in(&1, combat ++ ["narration", "ally_miss"]) |> elem(1))},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.ally_miss"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
