defmodule Loka.ContentD10Test do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Breaks: malformed drawing metadata or a Knock face references nonexistent content.
  test "map coverage, coordinate collisions and Knock references fail before artifact output", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    map_path = Path.join(dir, "map_positions.json")
    door_path = Path.join(dir, "rooms/chapel_steps.json")
    rows = map_path |> File.read!() |> JSON.decode!()
    door = door_path |> File.read!() |> JSON.decode!()
    assert {:ok, _, []} = Loka.Content.compile(dir)

    for {path, original, changed} <- [
          {map_path, rows, tl(rows)},
          {map_path, rows,
           List.update_at(rows, 1, &Map.merge(&1, Map.take(hd(rows), ~w(x y z))))},
          {map_path, rows, [hd(rows) | tl(rows) |> List.replace_at(0, hd(rows))]},
          {map_path, rows, List.update_at(rows, 0, &Map.put(&1, "room", "absent"))},
          {map_path, rows, List.update_at(rows, 0, &Map.put(&1, "x", 0.5))},
          {door_path, door, put_in(door, ["exits", "north", "knock", "npc"], "absent")},
          {door_path, door, put_in(door, ["exits", "north", "knock", "room"], "chapel_steps")},
          {door_path, door, put_in(door, ["exits", "north", "knock", "answered"], "absent")}
        ] do
      File.write!(path, JSON.encode!(changed))
      assert {:error, _} = Loka.Content.compile(dir)
      File.write!(path, JSON.encode!(original))
    end

    # Knock itself requires the new API even without optional map metadata.
    File.rm!(map_path)
    manifest_path = Path.join(dir, "cartridge.json")
    manifest = manifest_path |> File.read!() |> JSON.decode!()
    manifest = manifest |> put_in(["requires", "kernel_api", "at_least"], "1.36")
    manifest = update_in(manifest, ["requires", "capabilities"], &Map.delete(&1, "knowledge"))
    File.write!(manifest_path, JSON.encode!(manifest))
    assert {:error, diagnostics} = Loka.Content.compile(dir)
    assert Enum.any?(diagnostics, &(&1["code"] == "KERNEL_API_RANGE_INVALID"))
  end
end
