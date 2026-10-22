defmodule Loka.ContentTransportsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/fast_travel_sampler")}

  # Breaks: a missing or unpaired reciprocal route, bound money, forged action or bypass exit enters compiled source.
  test "compiler refuses invalid transport authoring", %{dir: dir} do
    for change <- [
          {"transports/south_road.json", &Map.put(&1, "destination", "missing")},
          {"transports/south_road.json", &Map.put(&1, "reverse", "south_road")},
          {"transports/north_road.json", &Map.put(&1, "recipient", "missing")},
          {"npcs/carter.json", &Map.delete(&1, "resource_starts")},
          {"rooms/north_post.json", &put_in(&1, ["exits", "west"], %{"to" => "south_post"})},
          {"actions/ride_south.json", &Map.put(&1, "input", [])},
          {"transports/south_road.json", nil}
        ] do
      assert {:error, _} = Loka.ContentSource.compile(dir, [change]), elem(change, 0)
    end
  end
end
