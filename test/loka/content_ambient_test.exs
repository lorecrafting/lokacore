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

  # Breaks: the schema drops a bound on every or chance.
  for {name, field, value} <- [
        {"every 0", "every", 0},
        {"chance 0", "chance", 0},
        {"chance 101", "chance", 101}
      ] do
    test "#{name} is a schema violation at the field", %{tmp_dir: dir} do
      set(dir, "rooms/cave.json", 0, &Map.put(&1, unquote(field), unquote(value)))
      refused(dir, "SCHEMA_VIOLATION", "rooms/cave.ambient[0].#{unquote(field)}")
    end
  end

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
