defmodule Loka.ContentRumourTest do
  use ExUnit.Case, async: true

  @tells "reactions/tells_innkeeper.json"
  # Row W2's own 1.47 uses removed, so only the entrant filter needs the floor.
  defp plain,
    do: [
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.46")},
      {"facts.json",
       &update_in(&1, ["facts", "knows_mill"], fn f -> Map.delete(f, "per_subject") end)},
      {"dialogues/innkeeper_mill.json",
       &put_in(&1, ["policy", "root"], %{"op" => "all", "items" => []})},
      {@tells,
       fn r ->
         r
         |> update_in(["when", "root"], &Map.delete(&1, "npc"))
         |> update_in(["apply"], fn [a] -> [Map.delete(a, "npc")] end)
       end}
    ]

  # Breaks (toolbox row W3): the compiler skips the entrant filter's reference (a misspelt NPC
  # or a spawn template compiles and the rule never fires) or compiles it below kernel_api 1.47 (twin of
  # rumour.test.ts).
  test "the entrant filter's NPC and its 1.47 floor are checked" do
    dir = Loka.ContentSource.copy("cartridges/rumour_sampler")
    ghost = {@tells, &put_in(&1, ["on", "npc"], "ghost")}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [ghost])
    assert {"UNRESOLVED_REFERENCE", "reactions/tells_innkeeper.on.npc"} in codes(diags)

    template = {"npcs/ada.json", &Map.put(&1, "spawn_template", true)}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [template])
    assert {"SCHEMA_VIOLATION", "reactions/tells_innkeeper.on.npc"} in codes(diags)

    assert {:error, diags} = Loka.ContentSource.compile(dir, plain())
    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in codes(diags)

    unfiltered = {@tells, &update_in(&1, ["on"], fn on -> Map.delete(on, "npc") end)}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, plain() ++ [unfiltered])
  end

  # Breaks: a consequence op's kernel_api floor dropped from @floors, so a cartridge below it
  # compiles and an older host faults at runtime (twin of rumour.test.ts). Called directly: any
  # sampler below these floors trips other features' floors first. quest.activate's 1.8 has no
  # row: quest_resolved, its only trigger the loader and compiler accept, has the same floor.
  test "each consequence op is refused just below its kernel_api floor" do
    registry = "protocol/capability_registry.json" |> File.read!() |> JSON.decode!()

    refused = fn op, v, event ->
      m = %{"requires" => %{"kernel_api" => %{"at_least" => v}, "capabilities" => %{}}}
      rule = %{"on" => %{"event" => event}, "apply" => [%{"op" => op}]}
      defs = %{"reaction" => %{"r" => {"reactions/r", [], rule}}}

      Loka.Content.Reactions.check(m, defs, {nil, %{}}, registry)
      |> Enum.any?(&(&1["code"] == "KERNEL_API_RANGE_INVALID"))
    end

    for {op, floor} <- [{"quest.resolve", 12}, {"quest.fail", 12}, {"population.suppress", 35}],
        do:
          assert(
            {op, refused.(op, "1.#{floor - 1}", "fact_changed"),
             refused.(op, "1.#{floor}", "fact_changed")} == {op, true, false}
          )

    # the quest_resolved trigger's own 1.8 floor, the one quest.activate's missing row relies on
    assert {refused.("fact.assign", "1.7", "quest_resolved"),
            refused.("fact.assign", "1.8", "quest_resolved")} == {true, false}
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
end
