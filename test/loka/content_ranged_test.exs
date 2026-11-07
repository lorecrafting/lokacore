defmodule Loka.ContentRangedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ranged_sampler")}

  # Breaks (toolbox row 17): a ranged
  # weapon compiles without shot_hit or shot_miss, with an unknown ammo pool or (Swings,
  # loka-kgd.200) with more than one swing.
  test "ranged weapons keep their narration and a known pool", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    narration = ["world", "combat", "narration"]

    for {edit, expected} <- [
          {{"cartridge.json", &(pop_in(&1, narration ++ ["shot_hit"]) |> elem(1))},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.shot_hit"}},
          {{"cartridge.json", &(pop_in(&1, narration ++ ["shot_miss"]) |> elem(1))},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.shot_miss"}},
          {{"items/bow.json", &put_in(&1, ~w(weapon ranged ammo), "quivers")},
           {"UNRESOLVED_REFERENCE", "items/bow.weapon.ranged.ammo"}},
          {{"items/bow.json", &put_in(&1, ~w(weapon attack attacks), 2)},
           {"SCHEMA_VIOLATION", "items/bow.weapon.attack.attacks"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    one = &put_in(&1, ~w(weapon attack attacks), 1)
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [{"items/bow.json", one}])
    # the explain row, not the generic schema words, tells the swing refusal
    two = &put_in(&1, ~w(weapon attack attacks), 2)
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"items/bow.json", two}])
    assert Enum.any?(Loka.Content.Explain.lines(diags, dir), &(&1 =~ "shoots once a round"))
  end
end
