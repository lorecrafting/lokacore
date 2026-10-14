defmodule Loka.ContentRaidTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 37a; twin of the loader test in kernel/ts/test/raid.test.ts):
  # population.spawn or a day_target 0 plan (without the step) compiles under API 1.83, or the
  # step's plan is never resolved.
  test "population.spawn and a 0 target keep API 1.84; the plan resolves" do
    dir = Loka.ContentSource.copy("cartridges/raid_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    plan = &put_in(&1, ["apply", Access.at(0), "plan"], "nowhere")
    old = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.83")}
    api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

    for {edits, expected} <- [
          {[old], api},
          {[old, {"reactions/raid.json", &update_in(&1, ["apply"], fn a -> tl(a) end)}], api},
          {[{"reactions/raid.json", plan}],
           {"UNRESOLVED_REFERENCE", "reactions/raid.apply[0].plan"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
