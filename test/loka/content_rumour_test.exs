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
  # compiles and the rule never fires) or compiles it below kernel_api 1.47 (twin of
  # rumour.test.ts).
  test "the entrant filter's NPC and its 1.47 floor are checked" do
    dir = Loka.ContentSource.copy("cartridges/rumour_sampler")
    ghost = {@tells, &put_in(&1, ["on", "npc"], "ghost")}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [ghost])
    assert {"UNRESOLVED_REFERENCE", "reactions/tells_innkeeper.on.npc"} in codes(diags)

    assert {:error, diags} = Loka.ContentSource.compile(dir, plain())
    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in codes(diags)

    unfiltered = {@tells, &update_in(&1, ["on"], fn on -> Map.delete(on, "npc") end)}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, plain() ++ [unfiltered])
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
end
