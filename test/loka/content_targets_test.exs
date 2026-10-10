defmodule Loka.ContentTargetsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/targets_sampler")}

  # Breaks: world.combat.target_choice compiles under API 1.47 (toolbox row 6a; twin of the
  # loader row in kernel/ts/test/targets.test.ts).
  test "target choice keeps its API floor", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.47")}
             ])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end

  # Breaks (toolbox row 6b; twin of the loader rows in kernel/ts/test/targets.test.ts): allies
  # compile under API 1.47, name a spawn template, an NPC without an attack or nothing, or lack
  # their narration.
  test "allies keep their API floor, authored fighters and narration", %{dir: dir} do
    combat = ["world", "combat"]

    for {edit, expected} <- [
          {{"cartridge.json",
            &(&1
              |> put_in(["requires", "kernel_api", "at_least"], "1.47")
              |> pop_in(combat ++ ["target_choice"])
              |> elem(1))},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
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
