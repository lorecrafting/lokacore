defmodule Loka.ContentDeerTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: the compiler leaves local deer plan links as short strings that the loader cannot resolve.
  test "deer plan and bundle short references expand" do
    assert {:ok, bytes, []} = Loka.Content.compile("cartridges/ashmere_missing_child")
    cartridge = JSON.decode!(bytes)["cartridge"]
    id = "ashmere_missing_child@0.0.42:population/willow_deer"
    plan = cartridge["populations"][id]

    assert plan["home"] == %{
             "cartridge_id" => "ashmere_missing_child",
             "cartridge_version" => "0.0.42",
             "kind" => "room",
             "key" => "willow_shade"
           }

    assert plan["bundle"]["key"] == "willow_deer"
  end

  # Breaks: a deer plan compiles with missing flight narration or an untyped hound/hide bundle.
  test "invalid sight narration and role pair refuse source", %{dir: dir} do
    assert {:error, ds} =
             Loka.ContentSource.compile(dir, [
               {"populations/willow_deer.json",
                &update_in(&1, ["sight", "narration"], fn n -> Map.delete(n, "south") end)}
             ])

    assert Enum.any?(ds, &(&1["path"] == "populations/willow_deer.sight.narration"))

    assert {:error, ds} =
             Loka.ContentSource.compile(dir, [
               {"population_bundles/willow_deer.json", &Map.put(&1, "loot_role", "pelt")}
             ])

    assert Enum.any?(
             ds,
             &(&1["path"] == "population_bundles/willow_deer.loot_role" or
                 &1["path"] == "populations/willow_deer.bundle")
           )
  end

  # Breaks: a hound sight plan compiles even though saved sight validation requires deer provenance.
  test "sight cannot attach to the hound and pelt role pair", %{dir: dir} do
    sight = %{
      "delay" => 300,
      "narration" => %{
        "east" => "combat.deer_fled_east",
        "west" => "combat.deer_fled_west"
      }
    }

    assert {:error, ds} =
             Loka.ContentSource.compile(dir, [
               {"populations/fen_hounds.json", &Map.put(&1, "sight", sight)}
             ])

    assert Enum.any?(ds, &(&1["path"] == "populations/fen_hounds.sight.narration"))
  end
end
