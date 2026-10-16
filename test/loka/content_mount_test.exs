defmodule Loka.ContentMountTest do
  use ExUnit.Case, async: true

  @dir "cartridges/mount_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/mount_sampler_hash.json"))
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
  defp edit(file, path, v), do: {file, &put_in(&1, path, v)}
  defp drop(file, path), do: {file, &(pop_in(&1, path) |> elem(1))}

  # Breaks: world.mount, the riding fact or the horse's mount dropped or reshaped in the artifact
  # (protocol/fixtures/mount_sampler_hash.json; the TS twin is kernel/ts/test/mount.test.ts).
  test "mount_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks (row 43b): the compiler admits a mount without world.mount or on a spawn template, a
  # riding fact that is no pair fact or names nothing, or world.mount below kernel_api 1.108.
  test "mount refusals match the TS loader" do
    dir = Loka.ContentSource.copy(@dir)
    horse = "npcs/horse.json"

    for {edits, expected} <- [
          {[drop("cartridge.json", ["world", "mount"])],
           [{"SCHEMA_VIOLATION", "npcs/horse.mount"}]},
          {[edit(horse, ["spawn_template"], true)], [{"SCHEMA_VIOLATION", "npcs/horse.mount"}]},
          {[drop("facts.json", ["facts", "riding", "per_subject"])],
           [{"SCHEMA_VIOLATION", "cartridge.world.mount.riding"}]},
          {[edit("cartridge.json", ["world", "mount", "riding"], "nope")],
           [{"UNRESOLVED_REFERENCE", "cartridge.world.mount.riding"}]},
          {[edit("cartridge.json", ["requires", "kernel_api", "at_least"], "1.107")],
           [{"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == expected
    end
  end
end
