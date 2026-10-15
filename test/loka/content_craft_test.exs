defmodule Loka.ContentCraftTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/craft_sampler")}

  @at "recipes/carve_spoon.craft"

  defp codes(dir, f) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"recipes/carve_spoon.json", f}])
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  defp part(part, key, v), do: &put_in(&1, ["craft", part, key], v)

  # Break (Homestead hs-10; twin of the loader rows in kernel/ts/test/craft.test.ts): a craft
  # compiles with a template or non-container holder, an unresolved item, holder or reason, a
  # duplicate item, or on a storylet or spell. The floor is loader_floors.json's "a craft" case.
  test "a craft needs resolved, placed holders, distinct items, a catalog reason, a station",
       %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {"SCHEMA_VIOLATION", @at <> ".consume.to"} in codes(
             dir,
             part("consume", "to", %{"in" => "template"})
           )

    assert {"SCHEMA_VIOLATION", @at <> ".yield.from"} in codes(
             dir,
             part("yield", "from", %{"in" => "item", "item" => "stick_02"})
           )

    assert {"UNRESOLVED_REFERENCE", @at <> ".consume.items[0]"} in codes(
             dir,
             part("consume", "items", ["nothing"])
           )

    assert {"UNRESOLVED_REFERENCE", @at <> ".yield.from.room"} in codes(
             dir,
             part("yield", "from", %{"in" => "room", "room" => "nowhere"})
           )

    assert {"DUPLICATE_DEFINITION", @at <> ".yield.items"} in codes(
             dir,
             part("yield", "items", ["spoon_01", "spoon_01"])
           )

    assert {"UNRESOLVED_REFERENCE", @at <> ".consume.reason"} in codes(
             dir,
             part("consume", "reason", "craft.unknown")
           )

    assert {"SCHEMA_VIOLATION", @at} in codes(
             dir,
             &Map.put(&1, "target", %{"kind" => "storylet", "rooms" => ["workshop"]})
           )

    spell = %{"kind" => "spell", "word" => "carve", "learned" => "spoon_carved"}
    assert {"SCHEMA_VIOLATION", @at} in codes(dir, &Map.put(&1, "target", spell))
  end

  # Break (hs-11; twin of the loader test in kernel/ts/test/craft.test.ts): a skill prerequisite
  # naming its own skill, or an unknown skill, compiles. The floor is loader_floors.json's
  # "a skill prerequisite" case.
  test "a skill prerequisite resolves and never names its own skill", %{dir: dir} do
    # The leaf sits under all and not, so a walker that skips nesting misses it.
    nested = fn key ->
      leaf = %{"op" => "skill_compare", "skill" => key, "at_least" => 2}
      %{"op" => "all", "items" => [%{"op" => "not", "item" => leaf}]}
    end

    naming = fn key ->
      assert {:error, diags} =
               Loka.ContentSource.compile(dir, [
                 {"skills/carving.json", &put_in(&1, ["prerequisite", "root"], nested.(key))}
               ])

      Enum.map(diags, &{&1["code"], &1["path"]})
    end

    assert {"SCHEMA_VIOLATION", "skills/carving.prerequisite"} in naming.("carving")

    assert {"UNRESOLVED_REFERENCE", "skills/carving.prerequisite.root.items[0].item.skill"} in naming.(
             "nothing"
           )
  end
end
