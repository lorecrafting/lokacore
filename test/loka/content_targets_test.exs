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

  # Break: an ally with an engage line compiles silently, though its line never plays; or the
  # warning fires for an ally without one.
  test "an ally with an engage line warns and still compiles", %{dir: dir} do
    engage = fn n ->
      Map.put(n, "disposition", %{
        "hostile" => %{"op" => "all", "items" => []},
        "engage" => "npc.guard.engage"
      })
    end

    edits = [
      {"npcs/guard.json", engage},
      {"text.json", &Map.put(&1, "npc.guard.engage", "x")},
      {"cartridge.json", &put_in(&1, ["requires", "capabilities", "policy"], 1)}
    ]

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, edits)

    assert [{"warning", "ALLY_ENGAGE_UNUSED", "cartridge.world.combat.allies[0]"}] ==
             for(
               %{"code" => "ALLY_ENGAGE_UNUSED"} = w <- warnings,
               do: {w["severity"], w["code"], w["path"]}
             )

    assert {:ok, _, plain} = Loka.ContentSource.compile(dir, [])
    refute Enum.any?(plain, &(&1["code"] == "ALLY_ENGAGE_UNUSED"))
  end
end
