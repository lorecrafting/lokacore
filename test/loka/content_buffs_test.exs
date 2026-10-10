defmodule Loka.ContentBuffsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/buffs_sampler")}

  # Breaks: a status.apply naming an unknown NPC, a spawn template or an item too, or an npc step
  # under kernel_api 1.46, compiles (the compiler twin of the TypeScript loader's row 42 checks);
  # or the short `npc` reference is not expanded (the sampler fails to compile).
  test "row 42 status.apply npc keeps its boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    rule = "reactions/song_listener.json"
    at = "reactions/song_listener.apply[0].npc"
    step = fn f -> &update_in(&1, ["apply", Access.at(0)], f) end
    # Leave the npc step as the only 1.46 field: no modifies, no npc_present.
    tick = &(&1 |> Map.delete("modifies") |> Map.put("per_tick", 1))

    cases = [
      {[{rule, step.(&Map.put(&1, "npc", "ghost"))}], {"UNRESOLVED_REFERENCE", at}},
      {[{"npcs/listener.json", &Map.put(&1, "spawn_template", true)}], {"SCHEMA_VIOLATION", at}},
      {[{rule, step.(&Map.put(&1, "item", "lute"))}], {"SCHEMA_VIOLATION", at}},
      {[
         {"statuses/might.json", tick},
         {"statuses/inspired.json", tick},
         {rule, &Map.delete(&1, "when")},
         {"reactions/song_traveller.json", &Map.delete(&1, "when")},
         {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
       ], {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
