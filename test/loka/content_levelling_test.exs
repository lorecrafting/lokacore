defmodule Loka.ContentLevellingTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/levelling_sampler")}

  # Breaks: world.levelling or an experience.grant step under API 1.41, without attributes@1,
  # with thresholds not strictly rising (equal catches < for <=), an unknown kill NPC or level_up
  # text, or a grant without world.levelling compiles (toolbox row 4; twin of the loader rows in
  # kernel/ts/test/levelling.test.ts).
  test "levelling keeps its API floor, owner, rising thresholds and references", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    l = ["world", "levelling"]
    api = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.41")
    unlevelled = &update_in(&1, ["world"], fn w -> Map.delete(w, "levelling") end)
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

    cases = [
      {"cartridge.json", api, floor},
      {"cartridge.json", &(&1 |> api.() |> unlevelled.()), floor},
      {"cartridge.json", unlevelled, {"SCHEMA_VIOLATION", "reactions/cull_reward.apply[0].op"}},
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "attributes") end),
       {"UNDECLARED_CAPABILITY", "cartridge.world.levelling"}},
      {"cartridge.json", &put_in(&1, l ++ ["thresholds"], [30, 30]),
       {"SCHEMA_VIOLATION", "cartridge.world.levelling.thresholds[1]"}},
      {"cartridge.json", &put_in(&1, l ++ ["thresholds"], [30, 20]),
       {"SCHEMA_VIOLATION", "cartridge.world.levelling.thresholds[1]"}},
      {"cartridge.json", &put_in(&1, l ++ ["kills", Access.at(1), "npc"], "wolf"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.levelling.kills[1].npc"}},
      {"cartridge.json", &put_in(&1, l ++ ["level_up"], "levelling.missing"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.levelling.level_up"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
