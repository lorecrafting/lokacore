defmodule Loka.ContentNeedsTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row G13): the compiler accepts a liquid's cures below kernel_api 1.46, naming no
  # status.
  test "a liquid's cures need 1.46 and name declared statuses" do
    dir = Loka.ContentSource.copy("cartridges/needs_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
    # Without the clock_hour reaction (row W25, 1.46) only the cure needs 1.46.
    entry = %{"event" => "entity_entered_room", "room" => "flats"}
    hour = {"reactions/parched_hour.json", &Map.put(&1, "on", entry)}
    uncured = {"liquids/water.json", &Map.delete(&1, "cures")}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api, hour, uncured])
    assert {:error, diags} = Loka.ContentSource.compile(dir, [api, hour])
    assert "KERNEL_API_RANGE_INVALID" in Enum.map(diags, & &1["code"]), inspect(diags)

    assert {:error, [%{"code" => "UNRESOLVED_REFERENCE", "path" => path}]} =
             Loka.ContentSource.compile(dir, [
               {"liquids/water.json", &Map.put(&1, "cures", ["thirsty", "scurvy"])}
             ])

    assert path == "liquids/water.cures[1]"
  end
end
