defmodule Loka.ContentQuestHintsTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row W23, twin of kernel/ts/test/quest_hints.test.ts): the compiler accepts
  # hints out of order, an empty hints object, hints without the real_elapsed time policy or
  # a hint text with no catalog entry.
  test "hints ascend, need real time and resolve their text" do
    dir = Loka.ContentSource.copy("cartridges/quest_sampler")
    hints = "quests/find_key.journal.hints"
    active = ["journal", "hints", "active"]

    cases = [
      {[{"quests/find_key.json", &put_in(&1, active ++ [Access.at(1), "after"], 10)}],
       {"SCHEMA_VIOLATION", hints <> ".active"}},
      {[{"quests/find_key.json", &put_in(&1, ["journal", "hints"], %{})}],
       {"SCHEMA_VIOLATION", hints}},
      {[{"cartridge.json", &Map.delete(&1, "time_policy")}], {"INVALID_TIME_POLICY", hints}},
      {[{"quests/find_key.json", &put_in(&1, active ++ [Access.at(0), "text"], "quest.nope")}],
       {"UNRESOLVED_REFERENCE", hints <> ".active[0].text"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row W23 action tip): a tip text with no catalog entry, an authored fact or
  # scripted action write of the engine's seen_tip_<key>, a tip without fact@1, or
  # a tipped scripted action key too long for seen_tip_ in a 64-character Key, accepted.
  test "a scripted action tip resolves, owns seen_tip_<key>, needs fact@1 and a short key" do
    dir = Loka.ContentSource.copy("cartridges/quest_sampler")
    scripted = "actions/search_floor.json"
    seen = %{"op" => "fact.assign", "fact" => "seen_tip_search_floor", "value" => true}
    long = String.duplicate("s", 56)
    spec = %{"version" => 1, "value_type" => %{"type" => "bool", "default" => false}}
    spec = Map.merge(spec, %{"scopes" => ["player"], "meaning" => "authored"})

    cases = [
      {[{scripted, &Map.put(&1, "tip", "tip.nope")}],
       {"UNRESOLVED_REFERENCE", "actions/search_floor.tip"}},
      {[{"facts.json", &put_in(&1, ["facts", "seen_tip_search_floor"], spec)}],
       {"RESERVED_FACT", "facts.facts.seen_tip_search_floor"}},
      {[{scripted, &put_in(&1, ["outcomes", "success", "sequence"], [seen])}],
       {"RESERVED_FACT", "actions/search_floor.outcomes.success.sequence[0].fact"}},
      {[{"cartridge.json", &(pop_in(&1, ["requires", "capabilities", "fact"]) |> elem(1))}],
       {"UNDECLARED_CAPABILITY", "actions/search_floor.tip"}},
      {[
         {scripted, nil},
         {"actions/#{long}.json", dir |> Path.join(scripted) |> File.read!() |> JSON.decode!()}
       ], {"SCHEMA_VIOLATION", "actions/#{long}.key"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    # Break: a malformed facts.json crashes the tip's fact synthesis instead of reporting.
    assert {:error, [_ | _]} = Loka.ContentSource.compile(dir, [{"facts.json", %{"facts" => []}}])
  end
end
