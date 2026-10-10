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
end
