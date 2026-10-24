defmodule Loka.ContentExtendsTest do
  @moduledoc """
  Source `extends` and `abstract` (docs/system/cartridge.md, Source shortcuts) on a copy of
  shoo_sampler, whose NPCs extend the abstract `npcs/wild.json`. Expected values are read by
  hand from that layout; the unchanged artifact itself is pinned by content_shoo_sampler_test.
  """
  use ExUnit.Case, async: true
  alias Loka.ContentSource, as: Source

  setup_all do: %{dir: Source.copy("cartridges/shoo_sampler")}

  defp diags(dir, changes) do
    {:error, ds} = Source.compile(dir, changes)
    for d <- ds, do: {d["code"], d["path"], d["data"]}
  end

  defp npc(dir, changes, key) do
    {:ok, bytes, _} = Source.compile(dir, changes)
    JSON.decode!(bytes)["cartridge"]["npcs"]["shoo_sampler@0.0.1:npc/#{key}"]
  end

  defp extends(parent), do: &Map.put(&1, "extends", parent)

  # Breaks: a missing parent is skipped and the child compiles without its inherited fields.
  test "a parent no definition of the child's kind has is unresolved", %{dir: dir} do
    assert diags(dir, [{"npcs/crow.json", extends("ghost")}]) ==
             [{"UNRESOLVED_REFERENCE", "npcs/crow.extends", %{"target" => "npcs/ghost"}}]
  end

  # Breaks: a parent of another kind resolves, or the refusal no longer says where the key lives.
  test "a parent of another kind is unresolved and names that file", %{dir: dir} do
    assert diags(dir, [{"npcs/crow.json", extends("old_coin")}]) == [
             {"UNRESOLVED_REFERENCE", "npcs/crow.extends",
              %{"target" => "npcs/old_coin", "from" => "items/old_coin"}}
           ]
  end

  # Breaks: a cycle recurses forever, or reports only one member, or names the wrong parent.
  @tag timeout: 10_000
  test "every member of a cycle is refused at its extends", %{dir: dir} do
    assert Enum.sort(diags(dir, [{"npcs/wild.json", extends("crow")}])) == [
             {"SCHEMA_VIOLATION", "npcs/crow.extends",
              %{"error" => "invalid_value", "from" => "npcs/wild"}},
             {"SCHEMA_VIOLATION", "npcs/wild.extends",
              %{"error" => "invalid_value", "from" => "npcs/crow"}}
           ]

    assert diags(dir, [{"npcs/crow.json", extends("crow")}]) == [
             {"SCHEMA_VIOLATION", "npcs/crow.extends",
              %{"error" => "invalid_value", "from" => "npcs/crow"}}
           ]
  end

  # Breaks: a non-string extends is treated as absent (or crashes the compiler).
  test "extends must be a string", %{dir: dir} do
    assert diags(dir, [{"npcs/crow.json", extends(1)}]) ==
             [{"SCHEMA_VIOLATION", "npcs/crow.extends", %{"error" => "invalid_type"}}]
  end

  # Breaks: root files are flattened too, so a manifest extends is silently dropped.
  test "a root file's extends is an unknown field", %{dir: dir} do
    assert {"UNKNOWN_FIELD", "cartridge.extends", %{}} in diags(dir, [
             {"cartridge.json", extends("x")}
           ])
  end

  # Breaks: a child's object replaces the parent's whole object (shallow merge).
  test "objects merge key by key", %{dir: dir} do
    changes = [{"npcs/oak_deer.json", &Map.put(&1, "hp", %{"start" => 0})}]

    assert npc(dir, changes, "oak_deer")["hp"] ==
             %{"minimum" => 0, "maximum" => 1, "start" => 0, "gain" => 0}
  end

  # Breaks: lists concatenate instead of the child's list replacing the parent's.
  test "a child's list replaces the parent's", %{dir: dir} do
    changes = [{"npcs/wild.json", &Map.put(&1, "keywords", ["beast"])}]
    assert npc(dir, changes, "crow")["keywords"] == ["crow"]
  end

  # Breaks: only one level resolves, so a grandchild misses the grandparent's fields.
  test "a chain resolves at any depth", %{dir: dir} do
    hind = %{"abstract" => true, "extends" => "wild", "attack" => %{"chance" => 5}}

    oak =
      npc(dir, [{"npcs/hind.json", hind}, {"npcs/oak_deer.json", extends("hind")}], "oak_deer")

    assert oak["attack"] == %{"chance" => 5, "damage_min" => 1, "damage_max" => 1}
    assert oak["spawn_template"] == true
  end
end
