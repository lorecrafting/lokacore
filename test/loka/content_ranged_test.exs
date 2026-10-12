defmodule Loka.ContentRangedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ranged_sampler")}

  # Breaks (toolbox row 17; twin of the loader rows in kernel/ts/test/ranged.test.ts): a ranged
  # weapon compiles under API 1.66, without shot_hit or shot_miss, or with an unknown ammo pool.
  test "ranged weapons keep their API floor, narration and a known pool", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    narration = ["world", "combat", "narration"]

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.66")},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {{"cartridge.json", &(pop_in(&1, narration ++ ["shot_hit"]) |> elem(1))},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.shot_hit"}},
          {{"cartridge.json", &(pop_in(&1, narration ++ ["shot_miss"]) |> elem(1))},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.shot_miss"}},
          {{"items/bow.json", &put_in(&1, ~w(weapon ranged ammo), "quivers")},
           {"UNRESOLVED_REFERENCE", "items/bow.weapon.ranged.ammo"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
