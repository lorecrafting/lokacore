defmodule Loka.ContentClimbTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/climb_sampler")}

  # Breaks: a climb face under API 1.44 or naming an unknown item or fell text compiles, or its
  # short item reference is not expanded (toolbox row 30; twin of the loader rows in
  # kernel/ts/test/climb.test.ts; hp is a default pool in a source, so no pool row).
  test "a climb face keeps its API floor and its item and text references", %{dir: dir} do
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])

    assert %{"kind" => "item", "key" => "rope"} =
             Jason.decode!(artifact)["cartridge"]["rooms"]["climb_sampler@0.0.1:room/clifftop"][
               "exits"
             ]["down"]["climb"]["item"]

    face = "rooms/clifftop.exits.down.climb"
    climb = &put_in(&1, ["exits", "down", "climb", &2], &3)

    cases = [
      {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.44")}],
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {[{"rooms/clifftop.json", &climb.(&1, "item", "vine")}],
       {"UNRESOLVED_REFERENCE", face <> ".item"}},
      {[{"rooms/clifftop.json", &climb.(&1, "fell", "narration.slip")}],
       {"UNRESOLVED_REFERENCE", face <> ".fell"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end

  # Breaks: a patrol leg over a climb face compiles, so the leader walks it (twin of the loader
  # row in kernel/ts/test/climb.test.ts).
  test "a patrol route over a climb face is refused" do
    dir = Loka.ContentSource.copy("cartridges/ashmere_missing_child")
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
    climb = %{"item" => "brass_key", "damage" => 1, "fell" => "action.bandage"}
    face = {"rooms/watch_post.json", &put_in(&1, ["exits", "west", "climb"], climb)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [api, face])

    assert [{"OUTCOME_MISMATCH", "quests/watch_rounds.patrol.route"}] ==
             Enum.map(diags, &{&1["code"], &1["path"]})
  end
end
