defmodule Loka.ContentTimeTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 10): the compiler drops a barrier's opens_when, leaves a short reference
  # inside it unexpanded, skips its policy's owner check, accepts a sky phase the lunar cuts do
  # not name, or accepts opens_when or sky below kernel_api 1.45.
  test "opens_when reaches the artifact; sky names a lunar phase; both need 1.45" do
    dir = Loka.ContentSource.copy("cartridges/time_sampler")
    gate = fn root -> &put_in(&1, ["opens_when", "root"], root) end
    other = %{"op" => "barrier_state", "barrier" => "moon_door", "equals" => "open"}

    assert {:ok, artifact, _} =
             Loka.ContentSource.compile(dir, [{"barriers/hour_door.json", gate.(other)}])

    barriers = JSON.decode!(artifact)["cartridge"]["barriers"]

    assert barriers["time_sampler@0.0.1:barrier/moon_door"]["opens_when"]["root"] ==
             %{"op" => "sky", "lunar" => "full"}

    assert barriers["time_sampler@0.0.1:barrier/hour_door"]["opens_when"]["root"]["barrier"] == %{
             "cartridge_id" => "time_sampler",
             "cartridge_version" => "0.0.1",
             "kind" => "barrier",
             "key" => "moon_door"
           }

    drop = &update_in(&1, ["requires", "capabilities"], fn m -> Map.delete(m, "calendar") end)
    api = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.44")
    moon = "barriers/moon_door.opens_when.root"

    cases = [
      {"barriers/moon_door.json", gate.(%{"op" => "sky", "lunar" => "half"}),
       {"SCHEMA_VIOLATION", moon <> ".lunar"}},
      {"cartridge.json", drop, {"UNDECLARED_CAPABILITY", moon <> ".op"}},
      {"cartridge.json", api,
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
