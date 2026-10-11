defmodule Loka.ContentShowcaseTest do
  # The toolbox showcase (docs/SHOWCASE.md); its compiled answer is
  # protocol/fixtures/toolbox_showcase_hash.json, which kernel/ts/test/showcase_fixture.ts loads.
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/toolbox_showcase_hash.json"))

  # Breaks: a short source reference stays unexpanded, a touch link is missing (a warning), or the
  # source drifts from the bytes the district walkthroughs run on.
  test "the showcase source compiles to its pinned answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/toolbox_showcase") == {:ok, expected, []}
  end

  # Row W22 fire (Beads loka-kgd.96; twin of the loader rows in kernel/ts/test/showcase_fire.test.ts).
  # Breaks: a barrier.set step or a co_present tag compiles under API 1.55 (each alone); a
  # barrier.set to locked on a barrier without key_item compiles (named or by tag), or one with a
  # key_item is refused; a barrier.set naming no barrier compiles.
  describe "fire" do
    setup do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

    defp diags(dir, edits) do
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    defp spread(edit), do: {"reactions/fire_spreads.json", &update_in(&1, ["apply"], edit)}

    defp door(to, by),
      do: spread(&List.replace_at(&1, 1, Map.merge(%{"op" => "barrier.set", "to" => to}, by)))

    test "barrier.set and co_present tag need API 1.56; to locked needs a key_item", %{dir: dir} do
      at155 = [
        {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.55")},
        {"reactions/kindle.json", nil}
      ]

      untagged = spread(&List.update_at(&1, 0, fn s -> Map.delete(s, "tag") end))
      no_door = spread(&List.delete_at(&1, 1))
      api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, at155 ++ [untagged, no_door])
      assert api in diags(dir, at155 ++ [untagged])
      assert api in diags(dir, at155 ++ [no_door])

      lockout = {"BARRIER_UNREACHABLE_KEY", "reactions/fire_spreads.apply[1].to"}
      assert lockout in diags(dir, [door("locked", %{"tag" => "burnable"})])
      assert lockout in diags(dir, [door("locked", %{"barrier" => "store_door"})])
      keyed = {"barriers/store_door.json", &Map.put(&1, "key_item", "anvil")}

      assert {:ok, _, _} =
               Loka.ContentSource.compile(dir, [keyed, door("locked", %{"tag" => "burnable"})])

      assert {"UNRESOLVED_REFERENCE", "reactions/fire_spreads.apply[1].barrier"} in diags(dir, [
               door("open", %{"barrier" => "gate"})
             ])
    end
  end
end
