defmodule Loka.ContentRecapTest do
  use ExUnit.Case, async: true

  # Break (toolbox row W27): the compiler accepts the away recap threshold below kernel_api 1.47.
  test "time_policy.recap_after_minutes needs kernel_api 1.47" do
    dir = Loka.ContentSource.copy("cartridges/recap_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = fn m -> put_in(m, ["requires", "kernel_api", "at_least"], "1.46") end
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"cartridge.json", api}])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end
end
