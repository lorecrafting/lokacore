defmodule Loka.ContentRaidTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 37a; twin of the loader test in kernel/ts/test/raid.test.ts):
  # population.spawn compiles under API 1.83, or its plan is never resolved.
  test "population.spawn keeps API 1.84 and a resolved plan" do
    dir = Loka.ContentSource.copy("cartridges/raid_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    plan = &put_in(&1, ["apply", Access.at(0), "plan"], "nowhere")

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.83")},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {{"reactions/raid.json", plan},
           {"UNRESOLVED_REFERENCE", "reactions/raid.apply[0].plan"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
