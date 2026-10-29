defmodule Loka.ContentCalendarTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(path, fun),
    do: File.write!(path, path |> File.read!() |> JSON.decode!() |> fun.() |> JSON.encode!())

  # Breaks: the compiler emits a calendar whose period or schedule cannot be consumed safely.
  test "compiler rejects malformed authored periods and out-of-day schedules", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ferry_sampler", dir)

    update(Path.join(dir, "dialogues/bram.json"), fn d ->
      update_in(d, ["choices"], &Map.new(&1, fn {c, o} -> {c, Map.delete(o, "story_point")} end))
    end)

    manifest = Path.join(dir, "cartridge.json")

    update(
      manifest,
      &put_in(&1, ["calendar"], %{
        "start" => 0,
        "units_per_hour" => 100,
        "hours_per_day" => 10,
        "subdivisions_per_hour" => 10,
        "solar" => [%{"at" => 100, "phase" => "dawn"}, %{"at" => 800, "phase" => "night"}]
      })
    )

    npc = Path.join(dir, "npcs/bram.json")
    update(npc, &put_in(&1, ["daily_schedule"], %{"2" => "ferry_landing"}))
    assert {:ok, _, []} = Loka.Content.compile(dir)

    update(manifest, &put_in(&1, ["calendar", "solar", Access.at(1), "at"], 100))
    assert {:error, errors} = Loka.Content.compile(dir)
    assert Enum.any?(errors, &(&1["code"] == "SCHEMA_VIOLATION"))

    update(manifest, &put_in(&1, ["calendar", "solar", Access.at(1), "at"], 800))
    update(npc, &put_in(&1, ["daily_schedule", "10"], "ferry_landing"))
    assert {:error, errors} = Loka.Content.compile(dir)
    assert Enum.any?(errors, &(&1["code"] == "SCHEMA_VIOLATION"))

    # A repeated lunar phase or an hour that subdivisions do not divide is refused too.
    update(npc, &put_in(&1, ["daily_schedule"], %{"2" => "ferry_landing"}))
    phases = [%{"at" => 0, "phase" => "new"}, %{"at" => 40, "phase" => "new"}]
    lunar = %{"origin" => 0, "period" => 80, "phases" => phases}
    update(manifest, &put_in(&1, ["calendar", "lunar"], lunar))
    assert {:error, errors} = Loka.Content.compile(dir)

    assert Enum.map(errors, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", "cartridge.calendar.lunar.phases[1]"}
           ]

    update(manifest, &put_in(&1, ["calendar", "lunar", "phases", Access.at(1), "phase"], "full"))
    update(manifest, &put_in(&1, ["calendar", "units_per_hour"], 101))
    assert {:error, errors} = Loka.Content.compile(dir)

    assert Enum.map(errors, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", "cartridge.calendar"}
           ]
  end

  # Breaks: the compiler emits a calendar with a partial unit triple (the runtime mixes authored and
  # default units) or a start + day or cycle span past the largest safe integer.
  test "compiler rejects partial units and calendar spans past 2^53 - 1", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ferry_sampler", dir)

    update(Path.join(dir, "dialogues/bram.json"), fn d ->
      update_in(d, ["choices"], &Map.new(&1, fn {c, o} -> {c, Map.delete(o, "story_point")} end))
    end)

    manifest = Path.join(dir, "cartridge.json")
    max = 9_007_199_254_740_991

    units = %{
      "start" => 0,
      "units_per_hour" => 100,
      "hours_per_day" => 10,
      "subdivisions_per_hour" => 10
    }

    lunar = %{"origin" => 0, "period" => 80, "phases" => [%{"at" => 0, "phase" => "new"}]}

    update(
      Path.join(dir, "npcs/bram.json"),
      &put_in(&1, ["daily_schedule"], %{"1" => "ferry_landing"})
    )

    for {calendar, path} <- [
          {units, nil},
          {Map.delete(units, "hours_per_day"), "cartridge.calendar"},
          {%{units | "start" => max - 999}, "cartridge.calendar"},
          {Map.put(units, "lunar", %{lunar | "origin" => max - 79}), "cartridge.calendar.lunar"}
        ] do
      update(manifest, &put_in(&1, ["calendar"], calendar))

      case path do
        nil ->
          assert {:ok, _, []} = Loka.Content.compile(dir)

        path ->
          assert {:error, errors} = Loka.Content.compile(dir)
          assert Enum.map(errors, &{&1["code"], &1["path"]}) == [{"SCHEMA_VIOLATION", path}]
      end
    end
  end

  # Breaks: a fixed 24-hour compiler cap rejects a valid authored late-hour policy.
  test "compiler admits hour 29 but rejects hour 30 in a 30-hour day", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ferry_sampler", dir)

    update(Path.join(dir, "dialogues/bram.json"), fn d ->
      update_in(d, ["choices"], &Map.new(&1, fn {c, o} -> {c, Map.delete(o, "story_point")} end))
    end)

    manifest = Path.join(dir, "cartridge.json")

    update(
      manifest,
      fn c ->
        c
        |> put_in(["calendar"], %{
          "start" => 3000,
          "units_per_hour" => 100,
          "hours_per_day" => 30,
          "subdivisions_per_hour" => 10
        })
        |> put_in(["requires", "capabilities", "schedule"], 1)
      end
    )

    recipe = Path.join(dir, "actions/coil_rope.json")

    update(
      recipe,
      &put_in(&1, ["policy", "root"], %{"op" => "time_window", "from" => 29, "to" => 2})
    )

    assert {:ok, _, []} = Loka.Content.compile(dir)

    update(recipe, &put_in(&1, ["policy", "root", "from"], 30))
    assert {:error, errors} = Loka.Content.compile(dir)
    assert Enum.any?(errors, &(&1["code"] == "SCHEMA_VIOLATION"))
  end
end
