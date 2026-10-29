defmodule Loka.ContentDeerTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/shoo_sampler")}

  # Breaks: the compiler leaves local deer plan links as short strings that the loader cannot resolve.
  test "deer plan short references expand" do
    assert {:ok, bytes, []} = Loka.Content.compile("cartridges/shoo_sampler")
    cartridge = JSON.decode!(bytes)["cartridge"]
    id = "shoo_sampler@0.0.1:population/willow_deer"
    plan = cartridge["populations"][id]

    assert plan["home"] == %{
             "cartridge_id" => "shoo_sampler",
             "cartridge_version" => "0.0.1",
             "kind" => "room",
             "key" => "willow_shade"
           }

    assert {plan["npc"]["kind"], plan["npc"]["key"], plan["corpse"]["kind"]} ==
             {"npc", "willow_deer", "item"}
  end

  # Breaks: a deer plan compiles with missing flight narration.
  test "invalid sight narration refuses source", %{dir: dir} do
    assert {:error, ds} =
             Loka.ContentSource.compile(dir, [
               {"populations/willow_deer.json",
                &update_in(&1, ["sight", "narration"], fn n -> Map.delete(n, "south") end)}
             ])

    assert Enum.any?(ds, &(&1["path"] == "populations/willow_deer.sight.narration"))
  end

  # Breaks: a sight plan compiles on a bundle without the deer/hide roles (the crow's), though saved
  # sight validation requires deer provenance.
  test "sight cannot attach to a bundle without the deer and hide roles", %{dir: dir} do
    sight = %{
      "delay" => 300,
      "narration" => %{
        "south" => "combat.deer_fled_south",
        "north" => "combat.deer_fled_north"
      }
    }

    assert {:error, ds} =
             Loka.ContentSource.compile(dir, [
               {"populations/crow.json", &Map.put(&1, "sight", sight)}
             ])

    assert Enum.any?(ds, &(&1["path"] == "populations/crow.sight.narration"))
  end
end
