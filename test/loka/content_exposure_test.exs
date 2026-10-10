defmodule Loka.ContentExposureTest do
  use ExUnit.Case, async: true

  @conditions ~w(chilled overheated soaked windburnt)

  # Breaks (toolbox row W25): the compiler accepts a wearing leaf with no clock_hour reaction, or a
  # clock_hour reaction with no wearing leaf, below kernel_api 1.46.
  test "a wearing leaf or a clock_hour reaction needs 1.46" do
    dir = Loka.ContentSource.copy("cartridges/exposure_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
    entry = %{"event" => "entity_entered_room", "room" => "fell"}
    leaf_only = for c <- @conditions, do: {"reactions/#{c}_hour.json", &Map.put(&1, "on", entry)}

    clock_only =
      for c <- @conditions,
          kind <- ~w(enter hour),
          do: {"reactions/#{c}_#{kind}.json", &Map.delete(&1, "when")}

    for changes <- [leaf_only, clock_only] do
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, changes)
      assert {:error, diags} = Loka.ContentSource.compile(dir, [api | changes])

      assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in Enum.map(
               diags,
               &{&1["code"], &1["path"]}
             ),
             inspect(diags)
    end
  end
end
