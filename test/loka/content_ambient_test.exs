defmodule Loka.ContentAmbientTest do
  # Ambient emotes (emote@1; docs/system/mechanics.md#ambient-emotes) on a copy of the ambient sampler.
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(dir, rel, fun) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(fun.(JSON.decode!(File.read!(path)))))
  end

  defp set(dir, rel, i, fun), do: update(dir, rel, &update_in(&1, ["ambient", Access.at(i)], fun))

  defp refused(dir, code, path) do
    assert {:error, ds} = Loka.Content.compile(dir)
    assert Enum.any?(ds, &(&1["code"] == code and &1["path"] == path)), inspect(ds)
  end

  setup %{tmp_dir: dir} do
    File.cp_r!("cartridges/ambient_emote_sampler", dir)
    :ok
  end

  # Breaks: the sampler stops compiling, or an ambient set's short emote ref stops expanding.
  test "the sampler compiles and expands the goblin's emote refs", %{tmp_dir: dir} do
    assert {:ok, bytes, _} = Loka.Content.compile(dir)

    goblin =
      JSON.decode!(bytes)["cartridge"]["npcs"]["ambient_emote_sampler@0.0.1:npc/goblin"]

    assert [%{"emotes" => [%{"kind" => "emote", "key" => "glance"}]}, _] = goblin["ambient"]
  end

  # Breaks: the schema drops a bound or required field of a room's or NPC's set or set list (the
  # item list shares the room's schema). Bounds from the schema text: 1 to 4 sets, 1 to 8 lines or
  # emotes, every 1 to 2^53-1, chance 1 to 100; lines (room) and every required.
  big = 9_007_199_254_740_992

  for {name, rel, fun, at} <- [
        {"room every 0", "rooms/cave", quote(do: &put(&1, 0, "every", 0)), "[0].every"},
        {"room every 2^53", "rooms/cave", quote(do: &put(&1, 0, "every", unquote(big))),
         "[0].every"},
        {"room chance 0", "rooms/cave", quote(do: &put(&1, 0, "chance", 0)), "[0].chance"},
        {"room chance 101", "rooms/cave", quote(do: &put(&1, 0, "chance", 101)), "[0].chance"},
        {"room no lines", "rooms/cave", quote(do: &put(&1, 0, "lines", [])), "[0].lines"},
        {"room nine lines", "rooms/cave", quote(do: &put(&1, 0, "lines", nine("room.cave.drip"))),
         "[0].lines"},
        {"room set lacks lines", "rooms/cave", quote(do: &drop(&1, 0, "lines")), "[0].lines"},
        {"room set lacks every", "rooms/cave", quote(do: &drop(&1, 0, "every")), "[0].every"},
        {"room no sets", "rooms/cave", quote(do: &Map.put(&1, "ambient", [])), ""},
        {"room five sets", "rooms/cave", quote(do: &five/1), ""},
        {"npc every 0", "npcs/goblin", quote(do: &put(&1, 1, "every", 0)), "[1].every"},
        {"npc every 2^53", "npcs/goblin", quote(do: &put(&1, 1, "every", unquote(big))),
         "[1].every"},
        {"npc chance 0", "npcs/goblin", quote(do: &put(&1, 1, "chance", 0)), "[1].chance"},
        {"npc chance 101", "npcs/goblin", quote(do: &put(&1, 1, "chance", 101)), "[1].chance"},
        {"npc no emotes", "npcs/goblin", quote(do: &put(&1, 1, "emotes", [])), "[1].emotes"},
        {"npc nine emotes", "npcs/goblin", quote(do: &put(&1, 1, "emotes", nine("glance"))),
         "[1].emotes"},
        {"npc no lines", "npcs/goblin", quote(do: &lines(&1, [])), "[1].lines"},
        {"npc nine lines", "npcs/goblin", quote(do: &lines(&1, nine("npc.goblin.room"))),
         "[1].lines"},
        {"npc set lacks every", "npcs/goblin", quote(do: &drop(&1, 1, "every")), "[1].every"},
        {"npc no sets", "npcs/goblin", quote(do: &Map.put(&1, "ambient", [])), ""},
        {"npc five sets", "npcs/goblin", quote(do: &five/1), ""}
      ] do
    test "#{name} is a schema violation", %{tmp_dir: dir} do
      update(dir, "#{unquote(rel)}.json", unquote(fun))
      refused(dir, "SCHEMA_VIOLATION", "#{unquote(rel)}.ambient#{unquote(at)}")
    end
  end

  defp put(d, i, k, v), do: put_in(d, ["ambient", Access.at(i), k], v)
  defp drop(d, i, k), do: update_in(d, ["ambient", Access.at(i)], &Map.delete(&1, k))

  defp lines(d, v),
    do:
      update_in(
        d,
        ["ambient", Access.at(1)],
        &(&1 |> Map.delete("emotes") |> Map.put("lines", v))
      )

  defp nine(k), do: List.duplicate(k, 9)
  defp five(d), do: Map.update!(d, "ambient", &List.duplicate(hd(&1), 5))

  # Breaks: an NPC set with both or neither of lines and emotes is admitted.
  for {name, fun} <- [
        {"both", quote(do: &Map.put(&1, "lines", ["room.cave.drip"]))},
        {"neither", quote(do: &Map.delete(&1, "emotes"))}
      ] do
    test "an NPC set with #{name} lines and emotes is a schema violation", %{tmp_dir: dir} do
      set(dir, "npcs/goblin.json", 1, unquote(fun))
      refused(dir, "SCHEMA_VIOLATION", "npcs/goblin.ambient[1]")
    end
  end

  # Breaks: a room or item set admits emotes (only an NPC performs one); the schema's closed set
  # words it as an unknown field.
  for {rel, path} <- [{"rooms/cave.json", "rooms/cave"}, {"items/lantern.json", "items/lantern"}] do
    test "emotes on #{rel} are refused", %{tmp_dir: dir} do
      set(dir, unquote(rel), 0, &Map.put(&1, "emotes", ["glance"]))
      refused(dir, "UNKNOWN_FIELD", "#{unquote(path)}.ambient[0].emotes")
    end
  end

  # Breaks: an ambient line key the catalog lacks, or an emote the table lacks, is admitted.
  test "an unknown line or emote is unresolved", %{tmp_dir: dir} do
    set(dir, "items/lantern.json", 0, &Map.put(&1, "lines", ["item.lantern.missing"]))
    set(dir, "npcs/goblin.json", 1, &Map.put(&1, "emotes", ["sneer"]))
    refused(dir, "UNRESOLVED_REFERENCE", "items/lantern.ambient[0].lines[0]")
    refused(dir, "UNRESOLVED_REFERENCE", "npcs/goblin.ambient[1].emotes[0]")
  end

  # Breaks: ambient compiles without emote@1 (with no emote table to trip the existing check).
  test "ambient without emote@1 is an undeclared capability", %{tmp_dir: dir} do
    update(
      dir,
      "cartridge.json",
      &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "emote") end)
    )

    update(dir, "npcs/goblin.json", &Map.delete(&1, "ambient"))
    File.rm_rf!(Path.join(dir, "emotes"))
    refused(dir, "UNDECLARED_CAPABILITY", "rooms/cave.ambient")
  end

  # Breaks: an ambient set's when stops being read as a condition (its references never resolve).
  test "a when naming an unknown status is unresolved", %{tmp_dir: dir} do
    set(dir, "npcs/goblin.json", 0, &put_in(&1, ["when", "status"], "brave"))
    refused(dir, "UNRESOLVED_REFERENCE", "npcs/goblin.ambient[0].when.status")
  end
end
