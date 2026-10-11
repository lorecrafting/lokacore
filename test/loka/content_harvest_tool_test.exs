defmodule Loka.ContentHarvestToolTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/harvest_sampler")}

  # Break (toolbox row 19; twin of the loader row in kernel/ts/test/harvest_tool.test.ts): a
  # harvest tool gate compiles under API 1.51.
  test "a harvest tool needs API 1.52", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.51")}
             ])

    assert {"KERNEL_API_RANGE_INVALID", "rooms/mine.details.seam.harvest"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end
end
