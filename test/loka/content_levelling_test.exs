defmodule Loka.ContentLevellingTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/levelling_sampler")}

  # Breaks: world.levelling or an experience.grant step without attribute@1,
  # with thresholds not strictly rising (equal catches < for <=), an unknown kill NPC or level_up
  # text, or a grant without world.levelling compiles; a level_reached rule without world.levelling,
  # with a level no threshold reaches (1, or one past the top) or with a grant compiles, or an
  # unfiltered one is refused (toolbox row 4).
  test "levelling keeps its owner, rising thresholds and references", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [
               {"reactions/level_three.json",
                &update_in(&1, ["on"], fn on -> Map.delete(on, "level") end)}
             ])

    l = ["world", "levelling"]
    unlevelled = &update_in(&1, ["world"], fn w -> Map.delete(w, "levelling") end)

    cases = [
      {"cartridge.json", unlevelled, {"SCHEMA_VIOLATION", "reactions/cull_reward.steps[0].op"}},
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "attribute") end),
       {"UNDECLARED_CAPABILITY", "cartridge.world.levelling"}},
      {"cartridge.json", &put_in(&1, l ++ ["thresholds"], [30, 30]),
       {"SCHEMA_VIOLATION", "cartridge.world.levelling.thresholds[1]"}},
      {"cartridge.json", &put_in(&1, l ++ ["thresholds"], [30, 20]),
       {"SCHEMA_VIOLATION", "cartridge.world.levelling.thresholds[1]"}},
      {"cartridge.json", &put_in(&1, l ++ ["kills", Access.at(1), "npc"], "wolf"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.levelling.kills[1].npc"}},
      {"cartridge.json", &put_in(&1, l ++ ["level_up"], "levelling.missing"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.levelling.level_up"}},
      {"cartridge.json", &put_in(&1, l ++ ["gained"], "levelling.missing"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.levelling.gained"}},
      {"cartridge.json", unlevelled, {"SCHEMA_VIOLATION", "reactions/level_two.on.event"}},
      {"reactions/level_two.json", &put_in(&1, ["on", "level"], 1),
       {"SCHEMA_VIOLATION", "reactions/level_two.on.level"}},
      {"reactions/level_two.json", &put_in(&1, ["on", "level"], 4),
       {"SCHEMA_VIOLATION", "reactions/level_two.on.level"}},
      {"reactions/level_two.json",
       &update_in(&1, ["steps"], fn s -> s ++ [%{"op" => "experience.grant", "amount" => 1}] end),
       {"SCHEMA_VIOLATION", "reactions/level_two.steps[2]"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
