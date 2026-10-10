defmodule Loka.ContentQuestHintsTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row W23, twin of kernel/ts/test/quest_hints.test.ts): the compiler accepts
  # hints out of order, hints without the real_elapsed time policy, hints below kernel_api 1.46 or a
  # hint text with no catalog entry.
  test "hints ascend, need real time and 1.46, and resolve their text" do
    dir = Loka.ContentSource.copy("cartridges/quest_sampler")
    hints = "quests/find_key.journal.hints"
    active = ["journal", "hints", "active"]

    cases = [
      {[{"quests/find_key.json", &put_in(&1, active ++ [Access.at(1), "after"], 10)}],
       {"SCHEMA_VIOLATION", hints <> ".active"}},
      {[{"cartridge.json", &Map.delete(&1, "time_policy")}], {"INVALID_TIME_POLICY", hints}},
      {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}],
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {[{"quests/find_key.json", &put_in(&1, active ++ [Access.at(0), "text"], "quest.nope")}],
       {"UNRESOLVED_REFERENCE", hints <> ".active[0].text"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row W23 action tip): a tip text with no catalog entry, an authored fact or
  # recipe write of the engine's seen_tip_<key>, a tip below kernel_api 1.46 or without fact@1, or
  # a tipped recipe key too long for seen_tip_ in a 64-character Key, accepted.
  test "a recipe tip resolves, owns seen_tip_<key>, needs 1.46 and fact@1 and a short key" do
    dir = Loka.ContentSource.copy("cartridges/quest_sampler")
    recipe = "recipes/search_floor.json"
    seen = %{"op" => "fact.assign", "fact" => "seen_tip_search_floor", "value" => true}
    long = String.duplicate("s", 56)
    spec = %{"version" => 1, "value_type" => %{"type" => "bool", "default" => false}}
    spec = Map.merge(spec, %{"scopes" => ["player"], "meaning" => "authored"})

    cases = [
      {[{recipe, &Map.put(&1, "tip", "tip.nope")}],
       {"UNRESOLVED_REFERENCE", "recipes/search_floor.tip"}},
      {[{"facts.json", &put_in(&1, ["facts", "seen_tip_search_floor"], spec)}],
       {"RESERVED_FACT", "facts.facts.seen_tip_search_floor"}},
      {[{recipe, &put_in(&1, ["outcomes", "success", "sequence"], [seen])}],
       {"RESERVED_FACT", "recipes/search_floor.outcomes.success.sequence[0].fact"}},
      {[
         {"quests/find_key.json", &(pop_in(&1, ["journal", "hints"]) |> elem(1))},
         {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
       ], {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {[{"cartridge.json", &(pop_in(&1, ["requires", "capabilities", "fact"]) |> elem(1))}],
       {"UNDECLARED_CAPABILITY", "recipes/search_floor.tip"}},
      {[
         {recipe, nil},
         {"recipes/#{long}.json", dir |> Path.join(recipe) |> File.read!() |> JSON.decode!()}
       ], {"SCHEMA_VIOLATION", "recipes/#{long}.key"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
