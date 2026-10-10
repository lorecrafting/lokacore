defmodule Loka.ContentDamageTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/damage_sampler")}

  # Breaks: the compiler skips the kernel_api 1.44 floor at one G2 site (a player, NPC or weapon
  # attack's kind or crit, an NPC's resistances), so an older-API cartridge with them compiles (toolbox row
  # G2; twin of the loader rows in kernel/ts/test/damage.test.ts).
  test "damage kinds, crits and resistances need kernel_api 1.44", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    player = ["world", "combat", "player_attack"]
    old = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.43")
    plain = &(&1 |> old.() |> update_in(player, fn p -> Map.drop(p, ~w(kind crit)) end))
    no_resist = {"npcs/wight.json", &Map.delete(&1, "resistances")}

    cases = [
      [
        {"cartridge.json",
         &(&1 |> old.() |> update_in(player, fn p -> Map.delete(p, "crit") end))},
        no_resist
      ],
      [
        {"cartridge.json",
         &(&1 |> old.() |> update_in(player, fn p -> Map.delete(p, "kind") end))},
        no_resist
      ],
      [{"cartridge.json", plain}],
      [
        {"cartridge.json", plain},
        {"npcs/wight.json",
         &(&1 |> Map.delete("resistances") |> put_in(["attack", "kind"], "cold"))}
      ],
      # The weapon's skill does not resolve (another diagnostic); the floor still reports.
      [
        {"cartridge.json", plain},
        no_resist,
        {"items/iron_sword.json",
         &Map.put(&1, "weapon", %{
           "skill" => "swords",
           "attack" => %{"chance" => 50, "damage_min" => 1, "damage_max" => 1, "kind" => "cold"}
         })}
      ]
    ]

    for changes <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)

      assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in Enum.map(
               diags,
               &{&1["code"], &1["path"]}
             ),
             inspect(diags)
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [{"cartridge.json", plain}, no_resist])
  end
end
