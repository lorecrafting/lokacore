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
  # Breaks: a barrier.set to locked on a barrier without key_item compiles (named or by tag), or one with a
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

    test "barrier.set to locked needs a key_item", %{dir: dir} do
      lockout = {"BARRIER_UNREACHABLE_KEY", "reactions/fire_spreads.apply[1].to"}
      assert lockout in diags(dir, [door("locked", %{"tag" => "burnable"})])
      assert lockout in diags(dir, [door("locked", %{"barrier" => "store_door"})])
      keyed = {"barriers/store_door.json", &Map.put(&1, "key_item", "anvil")}

      assert {:ok, _, _} =
               Loka.ContentSource.compile(dir, [keyed, door("locked", %{"tag" => "burnable"})])

      # A keyless burnable barrier on no exit (a lid) is out of a tag's reach.
      File.write!(
        Path.join(dir, "barriers/stray.json"),
        JSON.encode!(%{
          "keywords" => ["stray"],
          "short" => "barrier.store_door.short",
          "initial" => "closed",
          "tags" => ["burnable"]
        })
      )

      assert {:ok, _, _} =
               Loka.ContentSource.compile(dir, [keyed, door("locked", %{"tag" => "burnable"})])

      # loka-kgd.103: only the trigger room's exits, when it names one.
      entering = fn room ->
        {"reactions/fire_spreads.json",
         &Map.put(&1, "on", %{"event" => "entity_entered_room", "room" => room})}
      end

      locked = door("locked", %{"tag" => "burnable"})
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [entering.("the_fold"), locked])
      assert lockout in diags(dir, [entering.("smithy"), locked])

      assert {"UNRESOLVED_REFERENCE", "reactions/fire_spreads.apply[1].barrier"} in diags(dir, [
               door("open", %{"barrier" => "gate"})
             ])
    end
  end

  # loka-kgd.79, twin of the loader rows in kernel/ts/test/showcase_combat.test.ts. Breaks: an
  # attacker filter names a spawn template or an NPC the cartridge lacks.
  describe "attacker filter" do
    setup do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

    defp gore(dir, npc),
      do:
        Loka.ContentSource.compile(dir, [
          {"reactions/boar_gore.json", &put_in(&1, ["on", "attacker"], npc)}
        ])

    defp codes({:error, ds}), do: Enum.map(ds, &{&1["code"], &1["path"]})

    test "needs an authored NPC", %{dir: dir} do
      at = "reactions/boar_gore.on.attacker"
      assert {:ok, _, _} = gore(dir, "boar")

      assert {"SCHEMA_VIOLATION", at} in codes(gore(dir, "goblin"))
      assert {"UNRESOLVED_REFERENCE", at} in codes(gore(dir, "wolf"))
    end
  end
end
