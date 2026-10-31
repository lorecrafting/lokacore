defmodule Loka.ContentScarsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/scars_sampler")}

  defp diags(dir, file, change) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  # Breaks (row W8): a permanent status with or without a per_tick, or without an expired line, is refused
  # (loka-rn3b), or one ticking 0, or a timed one without an expired line, compiles, or one
  # modifying an attribute the derived hp maximum reads compiles (loka-kgd.50).
  test "a permanent status may tick and omit expired, never moves the hp maximum", %{dir: dir} do
    no_expired = &update_in(&1, ["narration"], fn n -> Map.delete(n, "expired") end)
    ticking = &(&1 |> Map.put("per_tick", -1) |> no_expired.())
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [{"statuses/scar.json", ticking}])
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [{"statuses/scar.json", no_expired}])

    assert {"SCHEMA_VIOLATION", "statuses/scar.per_tick"} in diags(
             dir,
             "statuses/scar.json",
             &Map.put(&1, "per_tick", 0)
           )

    assert {"SCHEMA_VIOLATION", "statuses/scar.narration.expired"} in diags(
             dir,
             "statuses/scar.json",
             &(&1 |> ticking.() |> Map.put("duration", 600))
           )

    derived = Loka.ContentSource.copy("cartridges/derived_sampler")
    con = &put_in(&1, ["modifies", Access.at(0), "attribute"], "con")
    lasting = &(&1 |> con.() |> Map.put("duration", "permanent"))
    floor = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.48")
    assert {:ok, _, _} = Loka.ContentSource.compile(derived, [{"statuses/might.json", con}])

    assert {:error, diags} =
             Loka.ContentSource.compile(derived, [
               {"statuses/might.json", lasting},
               {"cartridge.json", floor}
             ])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", "statuses/might.modifies[0].attribute"}
           ]
  end
end
