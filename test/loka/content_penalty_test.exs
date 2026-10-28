defmodule Loka.ContentPenaltyTest do
  use ExUnit.Case, async: true

  @dir "cartridges/penalty_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/penalty_sampler_hash.json"))
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
  defp edit(file, path, v), do: {file, &put_in(&1, path, v)}
  defp drop(file, path), do: {file, &(pop_in(&1, path) |> elem(1))}

  # Breaks: world.death.penalty, the brute, the yard or the tail dropped or reshaped in the
  # artifact (protocol/fixtures/penalty_sampler_hash.json; the TS twin is
  # kernel/ts/test/penalty.test.ts).
  test "penalty_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks (row 47): the compiler admits an experience penalty without world.levelling, an
  # unknown narration key, or world.death.penalty below kernel_api 1.109.
  test "penalty refusals match the TS loader" do
    dir = Loka.ContentSource.copy(@dir)
    path = "cartridge.world.death.penalty.experience"

    for {edits, expected} <- [
          {[drop("cartridge.json", ["world", "levelling"]), {"reactions/cull_reward.json", nil}],
           [{"SCHEMA_VIOLATION", path}]},
          {[
             edit(
               "cartridge.json",
               ["world", "death", "penalty", "experience", "narration"],
               "death.nope"
             )
           ], [{"UNRESOLVED_REFERENCE", path <> ".narration"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == expected
    end
  end

  # Breaks (loka-3w3q): the compiler admits a fall or waking line naming no text key (the
  # kernel_api 1.117 floor is a protocol/fixtures/loader_floors.json case).
  test "death narration refusals match the TS loader" do
    dir = Loka.ContentSource.copy(@dir)
    api = edit("cartridge.json", ["requires", "kernel_api", "at_least"], "1.117")

    for field <- ~w(player_died woke) do
      lines = edit("cartridge.json", ["world", "death", "narration"], %{field => "death.nope"})
      assert {:error, diags} = Loka.ContentSource.compile(dir, [api, lines])

      assert pairs(diags) == [
               {"UNRESOLVED_REFERENCE", "cartridge.world.death.narration." <> field}
             ]
    end
  end
end
