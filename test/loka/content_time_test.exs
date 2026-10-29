defmodule Loka.ContentTimeTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 10): the compiler drops a barrier's opens_when, leaves a short reference
  # inside it unexpanded, skips its policy's owner check, accepts a sky phase the lunar cuts do
  # not name.
  test "opens_when reaches the artifact; sky names a lunar phase" do
    dir = Loka.ContentSource.copy("cartridges/time_sampler")
    gate = fn root -> &put_in(&1, ["opens_when"], root) end
    other = %{"op" => "barrier_state", "barrier" => "moon_door", "equals" => "open"}

    assert {:ok, artifact, _} =
             Loka.ContentSource.compile(dir, [{"barriers/hour_door.json", gate.(other)}])

    barriers = JSON.decode!(artifact)["cartridge"]["barriers"]

    assert barriers["time_sampler@0.0.1:barrier/moon_door"]["opens_when"] ==
             %{"op" => "sky", "lunar" => "full"}

    assert barriers["time_sampler@0.0.1:barrier/hour_door"]["opens_when"]["barrier"] == %{
             "cartridge_id" => "time_sampler",
             "cartridge_version" => "0.0.1",
             "kind" => "barrier",
             "key" => "moon_door"
           }

    drop = &update_in(&1, ["requires", "capabilities"], fn m -> Map.delete(m, "calendar") end)
    moon = "barriers/moon_door.opens_when"

    cases = [
      {[{"barriers/moon_door.json", gate.(%{"op" => "sky", "lunar" => "half"})}],
       {"SCHEMA_VIOLATION", moon <> ".lunar"}},
      {[{"cartridge.json", drop}], {"UNDECLARED_CAPABILITY", moon <> ".op"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks: a keyed barrier's expand clause rewrites key_item only, so a short reference inside
  # its opens_when stays a bare string (the loader then rejects the artifact).
  test "a keyed barrier's opens_when references expand" do
    m = %{"id" => "c", "version" => "1.0.0"}
    root = %{"op" => "barrier_state", "barrier" => "gate", "equals" => "open"}
    door = %{"key_item" => "key", "opens_when" => root}
    out = Loka.Content.Checks.expand(door, m)
    ref = &%{"cartridge_id" => "c", "cartridge_version" => "1.0.0", "kind" => &1, "key" => &2}
    assert out["key_item"] == ref.("item", "key")
    assert out["opens_when"]["barrier"] == ref.("barrier", "gate")
  end
end
