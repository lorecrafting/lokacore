defmodule Loka.ContentScarsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/scars_sampler")}

  defp diags(dir, file, change) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  # Breaks (row W8; twin of the loader rows in kernel/ts/test/scars.test.ts): a permanent status
  # compiles under kernel_api 1.48 or with a per_tick, or one modifying an attribute the derived
  # hp maximum reads compiles (loka-kgd.50).
  test "a permanent status keeps its floor, never ticks, never moves the hp maximum", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.47")

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api"} in diags(
             dir,
             "cartridge.json",
             api
           )

    assert {"SCHEMA_VIOLATION", "statuses/scar.per_tick"} in diags(
             dir,
             "statuses/scar.json",
             &Map.put(&1, "per_tick", -1)
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
