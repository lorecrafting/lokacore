defmodule Loka.ContentWaterTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @source "cartridges/ashmere_missing_child"

  # Breaks: water short references are not expanded, or authoring accepts missing owners/skill/paired free exits.
  test "water source expands real paired routes and refuses malformed authoring", %{tmp_dir: dir} do
    {:ok, bytes, _} = Loka.Content.compile(@source)
    c = JSON.decode!(bytes)["cartridge"]
    assert c["world"]["water"]["skill"]["kind"] == "skill"
    assert c["world"]["water"]["skill"]["key"] == "swim"

    assert Enum.map(c["world"]["water"]["routes"], & &1["bottom"]["key"]) == [
             "well_bottom",
             "pool_bottom"
           ]

    assert c["world"]["water"]["duration"] == 6000
    File.cp_r!(@source, dir)

    for {path, change} <- [
          {"cartridge.json", &put_in(&1, ["world", "water", "skill"], "missing")},
          {"cartridge.json", &put_in(&1, ["world", "water", "duration"], 0)},
          {"cartridge.json",
           &update_in(&1, ["requires", "capabilities"], fn caps -> Map.delete(caps, "water") end)},
          {"rooms/well_bottom.json", &put_in(&1, ["exits", "up", "to"], "village_green")},
          {"rooms/pool_bottom.json", &put_in(&1, ["exits", "up", "barrier"], "trunk_lid")}
        ] do
      original = @source |> Path.join(path) |> File.read!() |> JSON.decode!()
      target = Path.join(dir, path)
      File.write!(target, JSON.encode!(change.(original)))
      assert {:error, _} = Loka.Content.compile(dir), path
      File.write!(target, JSON.encode!(original))
    end
  end
end
