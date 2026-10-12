defmodule Loka.ContentEncounterTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/encounter_sampler")}

  # Break (toolbox row 9; twin of the loader row in kernel/ts/test/encounter.test.ts): an
  # encounter plan (`chance`) compiles under API 1.73.
  test "an encounter plan needs API 1.74", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.73")}
             ])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
           ]
  end
end
