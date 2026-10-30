defmodule Loka.ContentBuffsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/buffs_sampler")}

  # Breaks: a status.apply naming an unknown NPC, a spawn template or an item too, compiles (the compiler twin of the TypeScript loader's row 42 checks);
  # or the short `npc` reference is not expanded (the sampler fails to compile).
  test "row 42 status.apply npc keeps its boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    rule = "reactions/song_listener.json"
    at = "reactions/song_listener.steps[0].npc"
    step = fn f -> &update_in(&1, ["steps", Access.at(0)], f) end

    cases = [
      {[{rule, step.(&Map.put(&1, "npc", "ghost"))}], {"UNRESOLVED_REFERENCE", at}},
      {[{"npcs/listener.json", &Map.put(&1, "spawn_template", true)}], {"SCHEMA_VIOLATION", at}},
      {[{rule, step.(&Map.put(&1, "item", "lute"))}], {"SCHEMA_VIOLATION", at}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
