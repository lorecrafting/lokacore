defmodule Loka.ContentFearTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/fear_sampler")}

  # Breaks (toolbox row W21; twin of the loader row in kernel/ts/test/fear.test.ts): a fear status
  # compiles under API 1.48, or one without per_tick is refused.
  test "a fear status keeps its API floor and may omit per_tick", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.48")}
             ])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end
end
