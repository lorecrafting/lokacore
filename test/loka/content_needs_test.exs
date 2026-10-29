defmodule Loka.ContentNeedsTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row G13): the compiler accepts a liquid's cures naming no status.
  test "a liquid's cures name declared statuses" do
    dir = Loka.ContentSource.copy("cartridges/needs_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:error, [%{"code" => "UNRESOLVED_REFERENCE", "path" => path}]} =
             Loka.ContentSource.compile(dir, [
               {"liquids/water.json", &Map.put(&1, "cures", ["thirsty", "scurvy"])}
             ])

    assert path == "liquids/water.cures[1]"
  end
end
