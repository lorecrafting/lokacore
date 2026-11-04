defmodule Loka.ContentDeathTest do
  use ExUnit.Case, async: true

  # Breaks: source-only short refs or unsupported template custody survive into a broken artifact.
  @tag :tmp_dir
  test "corpse source validates the same content boundaries as the loader", %{tmp_dir: dir} do
    File.cp_r!("cartridges/cellar_sampler", dir)
    manifest_path = Path.join(dir, "cartridge.json")
    item_path = Path.join(dir, "items/player_corpse.json")
    child_path = Path.join(dir, "items/lantern.json")
    m = JSON.decode!(File.read!(manifest_path))
    i = JSON.decode!(File.read!(item_path))
    child = JSON.decode!(File.read!(child_path))

    for {name, manifest, item, lantern} <- [
          {"missing capability",
           update_in(m, ["requires", "capabilities"], &Map.delete(&1, "death")), i, child},
          {"unknown shrine", put_in(m, ["world", "death", "shrine"], "missing"), i, child},
          {"ordinary item", put_in(m, ["world", "death", "player_corpse"], "lantern"), i, child},
          {"same template", put_in(m, ["world", "death", "npc_corpse"], "player_corpse"), i,
           child},
          {"held template", m, i,
           Map.put(child, "location", %{"in" => "item", "item" => "player_corpse"})},
          {"noncontainer", m, Map.delete(i, "container"), child},
          {"capacity", m, Map.put(i, "capacity", 1), child},
          {"slot", m, Map.put(i, "slot", "cloak"), child},
          {"barrier", m, Map.put(i, "barrier", "trunk_lid"), child},
          {"restoration bounds", put_in(m, ["world", "death", "restore", "hp"], 11), i, child}
        ] do
      for {path, value} <- [{manifest_path, manifest}, {item_path, item}, {child_path, lantern}],
          do: File.write!(path, JSON.encode!(value))

      assert {:error, _} = Loka.Content.compile(dir), name
    end
  end

  # Breaks (owner decision 2026-11-02): a corpse decay admitted without the job runner (schedule@1)
  # or the consumed holder its corpse moves to (food@1).
  test "corpse decay needs schedule and food" do
    dir = Loka.ContentSource.copy("cartridges/cellar_sampler")
    path = "cartridge.world.death.player_corpse_decay"
    decay = {"cartridge.json", &put_in(&1, ["world", "death", "player_corpse_decay"], 60)}

    no_schedule =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "schedule") end)}

    for {edits, expected} <- [
          {[decay], [{"UNDECLARED_CAPABILITY", path, "food"}]},
          {[decay, no_schedule],
           [{"UNDECLARED_CAPABILITY", path, "food"}, {"UNDECLARED_CAPABILITY", path, "schedule"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)

      assert for(
               d <- diags,
               d["path"] == path,
               do: {d["code"], d["path"], d["data"]["capability"]}
             ) == expected
    end
  end
end
