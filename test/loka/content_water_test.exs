defmodule Loka.ContentWaterTest do
  use ExUnit.Case, async: true

  # The cellar sampler with one inline water route: Well Lane down to a new Well Bottom.
  @water %{
    "skill" => "swim",
    "maximum_grams" => 6000,
    "entry_cost" => 10,
    "duration" => 6000,
    "warning" => "water.warning",
    "drowned" => "water.drowned",
    "routes" => [%{"surface" => "well_lane", "bottom" => "well_bottom"}]
  }

  defp cartridge(c, water) do
    c
    |> put_in(["requires", "kernel_api", "at_least"], "1.37")
    |> update_in(
      ["requires", "capabilities"],
      &Map.merge(&1, %{"water" => 1, "skills" => 1, "resource" => 1})
    )
    |> put_in(["world", "water"], water)
  end

  defp bottom(up) do
    %{
      "title" => "room.well_bottom.title",
      "description" => "room.well_bottom.description",
      "exits" => %{"up" => up}
    }
  end

  defp source(overrides) do
    Map.merge(
      %{
        "cartridge.json" => &cartridge(&1, @water),
        "skills/swim.json" => %{
          "label" => "skill.swim.label",
          "requirement" => "skill.swim.requirement",
          "qualification" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
        },
        "rooms/well_lane.json" => &put_in(&1, ["exits", "down"], %{"to" => "well_bottom"}),
        "rooms/well_bottom.json" => bottom(%{"to" => "well_lane"}),
        "text.json" =>
          &Map.merge(&1, %{
            "skill.swim.label" => "Swim",
            "skill.swim.requirement" => "Learn to swim.",
            "water.warning" => "Your lungs burn.",
            "water.drowned" => "You drown.",
            "room.well_bottom.title" => "Well Bottom",
            "room.well_bottom.description" => "Black water."
          })
      },
      overrides
    )
    |> Map.to_list()
  end

  # Breaks: water short references are not expanded, or authoring accepts a missing skill, a
  # zero duration, no water capability, a bottom whose Up leaves the route, or a barred Up.
  test "water source expands its route and refuses malformed authoring" do
    dir = Loka.ContentSource.copy("cartridges/cellar_sampler")
    assert {:ok, bytes, _} = Loka.ContentSource.compile(dir, source(%{}))
    water = JSON.decode!(bytes)["cartridge"]["world"]["water"]
    assert %{"kind" => "skill", "key" => "swim"} = water["skill"]

    assert [%{"surface" => %{"key" => "well_lane"}, "bottom" => %{"key" => "well_bottom"}}] =
             water["routes"]

    assert water["duration"] == 6000

    for {path, change} <- [
          {"cartridge.json", &cartridge(&1, %{@water | "skill" => "missing"})},
          {"cartridge.json", &cartridge(&1, %{@water | "duration" => 0})},
          {"cartridge.json",
           &(&1 |> cartridge(@water) |> pop_in(["requires", "capabilities", "water"]) |> elem(1))},
          {"rooms/well_bottom.json", bottom(%{"to" => "village_green"})},
          {"rooms/well_bottom.json", bottom(%{"to" => "well_lane", "barrier" => "trunk_lid"})}
        ] do
      assert {:error, _} = Loka.ContentSource.compile(dir, source(%{path => change})), path
    end
  end
end
