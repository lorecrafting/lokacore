defmodule Loka.ContentSchedulesTest do
  use ExUnit.Case, async: true

  @ref %{"cartridge_id" => "schedule_sampler", "cartridge_version" => "0.0.1", "kind" => "room"}

  # Breaks (toolbox row W10): the compiler does not split a source case list into the hour's
  # fallback room and schedule_cases, or leaves a case's room or condition unexpanded.
  test "a source hour [case, ..., room] compiles to its fallback room and schedule_cases" do
    dir = Loka.ContentSource.copy("cartridges/schedule_sampler")
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    maud = Jason.decode!(artifact)["cartridge"]["npcs"]["schedule_sampler@0.0.1:npc/maud"]
    assert maud["daily_schedule"]["8"] == Map.put(@ref, "key", "garden")
    assert maud["daily_schedule"]["12"] == Map.put(@ref, "key", "cottage")

    assert [%{"room" => green, "goal" => "npc.maud.goal_green", "when" => w}] =
             maud["schedule_cases"]["8"]

    assert green == Map.put(@ref, "key", "green")
    assert w["root"]["fact"]["kind"] == "fact"
    refute Map.has_key?(maud["schedule_cases"], "12")
  end

  # Breaks: the compiler skips a case list's rooms, goal texts or conditions (an unknown one
  # compiles and fails at load), accepts the fallback before a case, or accepts a case list
  # below kernel_api 1.47 (twin of schedule_cases.test.ts).
  test "a case list's references, texts, order and the 1.47 floor are checked" do
    dir = Loka.ContentSource.copy("cartridges/schedule_sampler")
    hour = &update_in(&1, ["daily_schedule", "8"], &2)
    case0 = fn f -> &hour.(&1, fn [c, r] -> [f.(c), r] end) end

    rows = [
      {case0.(&Map.put(&1, "room", "moor")), "UNRESOLVED_REFERENCE", "8[0].room"},
      {&hour.(&1, fn [c, _] -> [c, "moor"] end), "UNRESOLVED_REFERENCE", "8[1]"},
      {case0.(&Map.put(&1, "goal", "npc.maud.gone")), "UNRESOLVED_REFERENCE", "8[0].goal"},
      {case0.(&put_in(&1, ["when", "root", "fact"], "ghost")), "UNRESOLVED_REFERENCE",
       "8[0].when.root.fact"},
      {&hour.(&1, fn [c, r] -> [r, c] end), "SCHEMA_VIOLATION", "8"}
    ]

    for {change, code, path} <- rows do
      path = "npcs/maud.daily_schedule." <> path
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{"npcs/maud.json", change}])
      assert Enum.any?(diags, &(&1["code"] == code and &1["path"] == path)), inspect(diags)
    end

    api = fn m -> put_in(m, ["requires", "kernel_api", "at_least"], "1.46") end
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"cartridge.json", api}])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end
end
