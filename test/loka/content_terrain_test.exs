defmodule Loka.ContentTerrainTest do
  use ExUnit.Case, async: true

  @dir "cartridges/terrain_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/terrain_sampler_hash.json"))
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
  defp world(path, v), do: {"cartridge.json", &put_in(&1, ["world", "movement" | path], v)}

  # Breaks: world.movement.terrain or a room's road or marsh tag dropped or reshaped in the
  # artifact (protocol/fixtures/terrain_sampler_hash.json; the TS twin is terrain.test.ts).
  test "terrain_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks (row 43a): the compiler admits a terrain key outside the Tag vocabulary, a percent
  # or over 1000 (the TS loader refuses them too).
  test "terrain keys are tags, percents 0..1000" do
    dir = Loka.ContentSource.copy(@dir)

    for {edits, expected} <- [
          {[world(["terrain"], %{"lava" => 50})],
           [{"SCHEMA_VIOLATION", "cartridge.world.movement.terrain.lava"}]},
          {[world(["terrain"], %{"road" => 1001})],
           [{"SCHEMA_VIOLATION", "cartridge.world.movement.terrain.road"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == expected
    end

    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [world(["terrain"], %{"road" => 0})])
  end
end
