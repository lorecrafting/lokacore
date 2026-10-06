defmodule Loka.ContentDeerTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Breaks: the compiler leaves local deer plan links as short strings that the loader cannot resolve.
  test "deer plan and bundle short references expand", %{tmp_dir: _dir} do
    assert {:ok, bytes, []} = Loka.Content.compile("cartridges/ashmere_missing_child")
    cartridge = JSON.decode!(bytes)["cartridge"]
    id = "ashmere_missing_child@0.0.37:population/willow_deer"
    plan = cartridge["populations"][id]

    assert plan["home"] == %{
             "cartridge_id" => "ashmere_missing_child",
             "cartridge_version" => "0.0.37",
             "kind" => "room",
             "key" => "willow_shade"
           }

    assert plan["bundle"]["key"] == "willow_deer"
  end

  # Breaks: a deer plan compiles with missing flight narration or an untyped hound/hide bundle.
  test "invalid sight narration and role pair refuse source", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    plan_path = Path.join(dir, "populations/willow_deer.json")
    bundle_path = Path.join(dir, "population_bundles/willow_deer.json")
    plan = plan_path |> File.read!() |> JSON.decode!()
    bundle = bundle_path |> File.read!() |> JSON.decode!()

    File.write!(
      plan_path,
      JSON.encode!(update_in(plan, ["sight", "narration"], &Map.delete(&1, "south")))
    )

    assert {:error, ds} = Loka.Content.compile(dir)
    assert Enum.any?(ds, &(&1["path"] == "populations/willow_deer.sight.narration"))
    File.write!(plan_path, JSON.encode!(plan))
    File.write!(bundle_path, JSON.encode!(Map.put(bundle, "loot_role", "pelt")))
    assert {:error, ds} = Loka.Content.compile(dir)

    assert Enum.any?(
             ds,
             &(&1["path"] == "population_bundles/willow_deer.loot_role" or
                 &1["path"] == "populations/willow_deer.bundle")
           )
  end

  # Breaks: a hound sight plan compiles even though saved sight validation requires deer provenance.
  test "sight cannot attach to the hound and pelt role pair", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "populations/fen_hounds.json")
    plan = path |> File.read!() |> JSON.decode!()

    sight = %{
      "delay" => 300,
      "narration" => %{
        "east" => "combat.deer_fled_east",
        "west" => "combat.deer_fled_west"
      }
    }

    File.write!(path, JSON.encode!(Map.put(plan, "sight", sight)))
    assert {:error, ds} = Loka.Content.compile(dir)
    assert Enum.any?(ds, &(&1["path"] == "populations/fen_hounds.sight.narration"))
  end
end
