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
       {"SCHEMA_VIOLATION", "reactions/level_two.steps[3]"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end

  # Breaks: the step context table drops resource.adjust from reactions (the sampler stops
  # compiling), or a reaction's step naming an undeclared resource compiles and throws at play.
  test "a reaction's resource.adjust names a declared resource", %{dir: dir} do
    missing = fn r -> put_in(r, ["steps", Access.at(2), "resource"], "nerve") end

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{"reactions/level_two.json", missing}])

    assert {"UNRESOLVED_REFERENCE", "reactions/level_two.steps[2].resource"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           ),
           inspect(diags)
  end

  # Breaks: a rule's drain compiles, and a body stands at 0 with no entity_died; or the boundary
  # moves and `by` 0 (no change, nothing to skip) is refused.
  test "a reaction's resource.adjust refuses a negative by", %{dir: dir} do
    by = fn value -> fn r -> put_in(r, ["steps", Access.at(2), "by"], value) end end

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{"reactions/level_two.json", by.(-1)}])

    assert [%{"code" => "REACTION_DRAINS_BODY", "path" => "reactions/level_two.steps[2].by"}] =
             diags

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [{"reactions/level_two.json", by.(0)}])
  end
end
