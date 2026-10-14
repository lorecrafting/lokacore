defmodule Loka.ContentRaidTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 37a; twin of the loader test in kernel/ts/test/raid.test.ts):
  # population.spawn (with targets 1) or a day_target 0 plan (without the step) compiles under
  # API 1.83, or the step's plan is never resolved.
  test "population.spawn and a 0 target keep API 1.84; the plan resolves" do
    dir = Loka.ContentSource.copy("cartridges/raid_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    plan = &put_in(&1, ["apply", Access.at(0), "plan"], "nowhere")
    old = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.83")}
    api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    # Without row FD1's aftershock and stamp, which need 1.88 on their own.
    unstamped = &update_in(&1, ["apply"], fn a -> Enum.drop(a, -1) end)
    old = [old, {"reactions/aftershock.json", nil}, {"reactions/raid.json", unstamped}]

    for {edits, expected} <- [
          {old ++
             [{"populations/raiders.json", &%{&1 | "day_target" => 1, "night_target" => 1}}],
           api},
          {old ++ [{"reactions/raid.json", &update_in(&1, ["apply"], fn a -> tl(a) end)}], api},
          {[{"reactions/raid.json", plan}],
           {"UNRESOLVED_REFERENCE", "reactions/raid.apply[0].plan"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row FD1; twin of the loader test in kernel/ts/test/raid.test.ts): `after`,
  # fact.stamp or time_since compiles under API 1.87; a delayed rule keeps a step that reads its
  # event; a stamp or time_since names a fact that cannot hold every clock value; a rule with
  # `after` and no steps compiles under 1.87.
  test "after, fact.stamp and time_since keep API 1.88 and an unbounded int fact" do
    dir = Loka.ContentSource.copy("cartridges/raid_sampler")
    api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    old = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.87")}
    unstamped = {"reactions/raid.json", &update_in(&1, ["apply"], fn a -> Enum.drop(a, -1) end)}
    since = %{"op" => "time_since", "fact" => "raided_at", "at_least" => 600}
    leaf = &put_in(&1, ["when", "root"], %{"op" => "not", "item" => since})
    move = %{"op" => "item.move", "room" => "village"}

    for {edits, expected} <- [
          {[old, unstamped], api},
          {[old, unstamped, {"reactions/aftershock.json", nil}, {"reactions/calm.json", leaf}],
           api},
          {[old, {"reactions/aftershock.json", nil}], api},
          {[old, unstamped, {"reactions/aftershock.json", &%{&1 | "apply" => []}}], api},
          {[{"reactions/aftershock.json", &update_in(&1, ["apply"], fn a -> a ++ [move] end)}],
           {"SCHEMA_VIOLATION", "reactions/aftershock.apply[1].op"}},
          {[{"reactions/raid.json", &put_in(&1, ["apply", Access.at(2), "fact"], "aftershocks")}],
           {"SCHEMA_VIOLATION", "reactions/raid.apply[2].fact"}},
          {[
             {"reactions/calm.json", &put_in(&1, ["when", "root"], %{since | "fact" => "raided"})}
           ], {"SCHEMA_VIOLATION", "reactions/calm.when.root.fact"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
