defmodule Loka.ContentNpcAttributesTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/npc_attr_sampler")}

  # Breaks: an opposed check naming no NPC, a guard without the checked attribute or a template
  # NPC, or an NPC attribute list naming nothing or one attribute twice, or either G3 field under
  # kernel_api 1.46, compiles (the compiler twin of the TypeScript loader's row G3 checks).
  test "row G3 NPC attributes and opposed NPCs keep their boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    north = "recipes/shove_north.json"
    strong = "npcs/strong_guard.json"
    str = %{"attribute" => "str", "value" => 1}

    cases = [
      {north, &put_in(&1, ["check", "npc"], "ghost"),
       {"UNRESOLVED_REFERENCE", "recipes/shove_north.check.npc"}},
      {strong, &Map.delete(&1, "attributes"),
       {"SCHEMA_VIOLATION", "recipes/shove_north.check.npc"}},
      {strong, &Map.put(&1, "spawn_template", true),
       {"SCHEMA_VIOLATION", "recipes/shove_north.check.npc"}},
      {strong, &put_in(&1, ["attributes"], [%{str | "attribute" => "dex"}]),
       {"UNRESOLVED_REFERENCE", "npcs/strong_guard.attributes[0].attribute"}},
      {strong, &Map.update!(&1, "attributes", fn a -> a ++ [str] end),
       {"SCHEMA_VIOLATION", "npcs/strong_guard.attributes[1].attribute"}},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
