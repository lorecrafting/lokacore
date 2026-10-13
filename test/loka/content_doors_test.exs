defmodule Loka.ContentDoorsTest do
  use ExUnit.Case, async: true

  # Toolbox row W26 (mechanics.md NPCs use doors; cartridge.md NPC door declarations).
  @ref %{"cartridge_id" => "doors_sampler", "cartridge_version" => "0.0.1", "kind" => "room"}

  # Breaks: the compiler does not split a source walking hour {room, walks} into the hour's room
  # and a one-case schedule_cases entry, or splits a plain hour too.
  test "a source walking hour compiles to its room and a one-case schedule_cases entry" do
    dir = Loka.ContentSource.copy("cartridges/doors_sampler")
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    thief = Jason.decode!(artifact)["cartridge"]["npcs"]["doors_sampler@0.0.1:npc/thief"]
    hut = Map.put(@ref, "key", "hut")
    assert thief["daily_schedule"]["8"] == hut
    assert thief["daily_schedule"]["10"] == Map.put(@ref, "key", "yard")
    assert thief["schedule_cases"] == %{"8" => [%{"room" => hut, "walks" => true}]}
  end

  # Breaks: the compiler's 1.81 floor for walks is missing or 1.80, on a schedule case or on a
  # population plan (twin of doors.test.ts), a walking hour's room is not resolved, or its walks
  # is not true.
  test "walks needs kernel_api 1.81 and a walking hour's room resolves" do
    dir = Loka.ContentSource.copy("cartridges/doors_sampler")
    api = fn m -> put_in(m, ["requires", "kernel_api", "at_least"], "1.80") end
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"cartridge.json", api}])
    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in codes(diags)

    moor = &put_in(&1, ["daily_schedule", "8", "room"], "moor")
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"npcs/thief.json", moor}])
    assert {"UNRESOLVED_REFERENCE", "npcs/thief.daily_schedule.8.room"} in codes(diags)

    stays = &put_in(&1, ["daily_schedule", "8", "walks"], false)
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"npcs/thief.json", stays}])
    assert {"SCHEMA_VIOLATION", "npcs/thief.daily_schedule.8.walks"} in codes(diags)

    bandits = Loka.ContentSource.copy("cartridges/encounter_sampler")
    walks = &Map.put(&1, "walks", true)

    assert {:error, diags} =
             Loka.ContentSource.compile(bandits, [{"populations/bandits.json", walks}])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in codes(diags)
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
end
