defmodule Loka.ContentPatrolTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: new short NPC/route/checkpoint/trust/quest references remain strings, compiling an artifact the loader refuses.
  test "authored patrol references expand at their own boundary" do
    assert {:ok, bytes, []} = Loka.Content.compile("cartridges/ashmere_missing_child")
    c = JSON.decode!(bytes)["cartridge"]
    q = c["quests"]["ashmere_missing_child@0.0.42:quest/watch_rounds"]

    assert q["patrol"]["npc"] == %{
             "cartridge_id" => "ashmere_missing_child",
             "cartridge_version" => "0.0.42",
             "kind" => "npc",
             "key" => "tobin"
           }

    assert Enum.map(q["patrol"]["route"], & &1["key"]) ==
             ~w(watch_post north_gate village_green east_gate village_green north_gate)

    assert Enum.all?(q["patrol"]["route"], &(&1["kind"] == "room"))

    assert Enum.map(q["patrol"]["checkpoints"], & &1["key"]) ==
             ~w(north_gate village_green east_gate watch_post)

    assert q["patrol"]["trust_fact"]["kind"] == "fact"
    d = c["dialogues"]["ashmere_missing_child@0.0.42:dialogue/tobin_watch"]
    assert d["choices"]["start"]["patrol"]["quest"] == d["choices"]["start"]["accept"]
    assert d["choices"]["continue"]["patrol"]["quest"]["kind"] == "quest"
  end

  # Breaks: source authoring installs malformed finite routes, competing location writers or ordinary reserved trust consequences.
  test "compiler refuses bounded route and patrol ownership violations", %{dir: dir} do
    mutations = [
      {"quests/watch_rounds.json", "OUTCOME_MISMATCH",
       fn q -> put_in(q, ["patrol", "initial_cursor"], 6) end},
      {"quests/watch_rounds.json", "OUTCOME_MISMATCH",
       fn q ->
         put_in(
           q,
           ["patrol", "route"],
           ~w(watch_post chapel_nave village_green east_gate village_green north_gate)
         )
       end},
      {"quests/watch_rounds.json", "OUTCOME_MISMATCH",
       fn q ->
         put_in(q, ["patrol", "checkpoints"], ~w(north_gate north_gate east_gate watch_post))
       end},
      {"quests/watch_rounds.json", "OUTCOME_MISMATCH",
       fn q -> put_in(q, ["patrol", "required"], 5) end},
      {"npcs/tobin.json", "OUTCOME_MISMATCH",
       fn n ->
         Map.put(n, "hp", %{"minimum" => 0, "maximum" => 10, "start" => 10, "gain" => 0})
       end},
      {"dialogues/tobin_watch.json", "OUTCOME_MISMATCH",
       fn d -> update_in(d, ["choices", "start"], &Map.delete(&1, "patrol")) end},
      {"reactions/start_search.json", "OUTCOME_MISMATCH",
       fn r -> put_in(r, ["apply", Access.at(0), "quest"], "watch_rounds") end},
      {"dialogues/tobin_watch.json", "RESERVED_FACT",
       fn d ->
         put_in(d, ["choices", "start", "sequence"], [
           %{"op" => "fact.assign", "fact" => "watch_gate_trusts_player", "value" => true}
         ])
       end}
    ]

    for {file, expected, change} <- mutations do
      assert {:error, diagnostics} = Loka.ContentSource.compile(dir, [{file, change}])

      assert Enum.any?(diagnostics, &(&1["code"] == expected)),
             inspect({file, expected, diagnostics})
    end
  end
end
