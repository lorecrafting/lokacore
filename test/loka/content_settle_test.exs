defmodule Loka.ContentSettleTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/settle_sampler")}

  # Break (Settle S3-1; twin of the loader test in kernel/ts/test/settle.test.ts): a narrate line
  # whose text key is not in the catalog compiles.
  test "a narrate text key resolves in the text catalog", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    missing = &put_in(&1, ["apply", Access.at(0), "text"], "settle.missing")

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{"reactions/arrival_line.json", missing}])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"UNRESOLVED_REFERENCE", "reactions/arrival_line.apply[0].text"}
           ]
  end

  # Break: the narrate check reads a rejected catalog (:unknown) as a map, so compile raises
  # instead of reporting only the text.json error.
  test "a rejected text catalog reports the catalog, not the narrate line", %{dir: dir} do
    bad = {"text.json", &Map.put(&1, "settle.arrival_line", 7)}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [bad])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", ~s(text["settle.arrival_line"])}
           ]
  end

  # Break (Settle S4-1; twin of the loader test in kernel/ts/test/settle.test.ts): a plan move
  # names an unknown plan, also names an NPC, or names no room, and compiles. The guard is a
  # placed NPC (the raider is a spawn template, refused at .npc on its own).
  test "a plan move names a known plan and a room, never an NPC", %{dir: dir} do
    guard =
      Map.delete(JSON.decode!(File.read!(Path.join(dir, "npcs/raider.json"))), "spawn_template")

    at = "reactions/band_out.apply[0].plan"

    refused = fn edit ->
      step = &update_in(&1, ["apply", Access.at(0)], edit)
      changes = [{"npcs/guard.json", guard}, {"reactions/band_out.json", step}]
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      Enum.map(diags, &{&1["code"], &1["path"]})
    end

    assert refused.(&Map.put(&1, "plan", "nobody")) == [{"UNRESOLVED_REFERENCE", at}]
    assert refused.(&Map.put(&1, "npc", "guard")) == [{"SCHEMA_VIOLATION", at}]
    assert refused.(&Map.delete(&1, "room")) == [{"SCHEMA_VIOLATION", at}]
  end
end
