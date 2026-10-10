defmodule Loka.ContentHiddenPassageTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/hidden_sampler")}

  # Breaks: a hidden_until face under API 1.44, naming an unknown or mistyped fact, or carrying a
  # barrier compiles, or its short fact reference is not expanded (toolbox row 11; twin of the
  # loader rows in kernel/ts/test/hidden_passage.test.ts).
  test "a hidden face keeps its API floor, fact reference and no barrier", %{dir: dir} do
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])

    assert %{"kind" => "fact", "key" => "panel_found"} =
             Jason.decode!(artifact)["cartridge"]["rooms"]["hidden_sampler@0.0.1:room/hall"][
               "exits"
             ]["east"]["hidden_until"]["fact"]

    face = "rooms/hall.exits.east.hidden_until"
    door = &put_in(&1, ["exits", &2, "barrier"], "panel")

    cases = [
      {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.44")}],
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {[{"rooms/hall.json", &put_in(&1, ["exits", "east", "hidden_until", "fact"], "lost")}],
       {"UNRESOLVED_REFERENCE", face <> ".fact"}},
      {[{"rooms/hall.json", &put_in(&1, ["exits", "east", "hidden_until", "equals"], 1)}],
       {"FACT_TYPE_MISMATCH", face <> ".equals"}},
      # A well-formed door on both faces, so only the hidden face's own rule refuses it.
      {[
         {"cartridge.json", &put_in(&1, ["requires", "capabilities", "barrier"], 1)},
         {"barriers/panel.json",
          %{"keywords" => ["panel"], "short" => "detail.panel", "initial" => "open"}},
         {"rooms/hall.json", &door.(&1, "east")},
         {"rooms/study.json", &door.(&1, "west")}
       ], {"BARRIER_MISMATCH", face}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end

  # Breaks: a patrol leg or expedition edge over a hidden face compiles, so the NPC walks it or the
  # quest journal names it (twin of the loader rows in kernel/ts/test/hidden_passage.test.ts).
  test "a patrol or expedition route over a hidden face is refused" do
    dir = Loka.ContentSource.copy("cartridges/ashmere_missing_child")
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
    hide = &put_in(&1, ["exits", "west", "hidden_until"], %{"fact" => &2, "equals" => true})

    for {room, fact, path} <- [
          {"watch_post", "watch_gate_trusts_player", "quests/watch_rounds.patrol.route"},
          {"hound_run", "fen_night_survived", "quests/a_night_in_the_marsh.expedition.route"}
        ] do
      changes = [api, {"rooms/#{room}.json", &hide.(&1, fact)}]
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert [{"OUTCOME_MISMATCH", path}] == Enum.map(diags, &{&1["code"], &1["path"]})
    end
  end
end
