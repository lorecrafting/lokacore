defmodule Loka.ContentRumourTest do
  use ExUnit.Case, async: true

  @tells "reactions/tells_innkeeper.json"

  # Breaks (toolbox row W3): the compiler skips the entrant filter's reference (a misspelt NPC
  # or a spawn template compiles and the rule never fires; twin
  # of rumour.test.ts).
  test "the entrant filter's NPC is checked" do
    dir = Loka.ContentSource.copy("cartridges/rumour_sampler")
    ghost = {@tells, &put_in(&1, ["on", "npc"], "ghost")}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [ghost])
    assert {"UNRESOLVED_REFERENCE", "reactions/tells_innkeeper.on.npc"} in codes(diags)

    template = {"npcs/ada.json", &Map.put(&1, "spawn_template", true)}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [template])
    assert {"SCHEMA_VIOLATION", "reactions/tells_innkeeper.on.npc"} in codes(diags)
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
end
