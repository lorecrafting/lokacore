defmodule Loka.ContentCalendarTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(path, fun),
    do: File.write!(path, path |> File.read!() |> JSON.decode!() |> fun.() |> JSON.encode!())

  # Breaks: the compiler emits a calendar whose period or schedule cannot be consumed safely.
  test "compiler rejects malformed authored periods and out-of-day schedules", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_ferry", dir)
    File.rm!(Path.join(dir, "story_points/lantern_resolved.json"))
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
  end

  # Breaks: a fixed 24-hour compiler cap rejects a valid authored late-hour policy.
  test "compiler admits hour 29 but rejects hour 30 in a 30-hour day", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_ferry", dir)
    File.rm!(Path.join(dir, "story_points/lantern_resolved.json"))
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

    recipe = Path.join(dir, "recipes/coil_rope.json")

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
