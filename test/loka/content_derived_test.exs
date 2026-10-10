defmodule Loka.ContentDerivedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/derived_sampler")}

  # Breaks: a derived table naming no attribute, lacking attributes@1, an old API floor (1.40 with
  # hp_max), or
  # modifying a stat whose combat or carry settings are absent compiles
  # (hit_chance and damage need world.combat, carry_grams world.carry).
  test "derived tables keep their references, owner and settings", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    terms = &["world", "derived", &1, "terms", Access.at(0)]

    cases = [
      {&put_in(&1, terms.("damage") ++ ["attribute"], "luck"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.derived.damage.terms[0].attribute"}},
      {&put_in(&1, ["requires", "kernel_api", "at_least"], "1.39"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {&put_in(&1, ["requires", "kernel_api", "at_least"], "1.38"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {&update_in(&1, ["world"], fn w -> Map.delete(w, "carry") end),
       {"SCHEMA_VIOLATION", "cartridge.world.derived.carry_grams"}},
      {&update_in(&1, ["world"], fn w -> Map.delete(w, "combat") end),
       {"SCHEMA_VIOLATION", "cartridge.world.derived.hit_chance"}},
      {&update_in(&1, ["world"], fn w -> Map.delete(w, "combat") end),
       {"SCHEMA_VIOLATION", "cartridge.world.derived.damage"}},
      {&update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "attributes") end),
       {"UNDECLARED_CAPABILITY", "cartridge.world.derived"}}
    ]

    for {change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{"cartridge.json", change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks: an item affect on an unworn item, naming no attribute, lacking attributes@1 or under
  # API 1.41 compiles, or a finger ring without affects compiles under API 1.41 (toolbox row 3).
  test "item affects keep their slot, references, owner and API floor" do
    dir = Loka.ContentSource.copy("cartridges/affects_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    drop = fn key -> &Map.delete(&1, key) end

    cases = [
      {"items/belt.json", drop.("slot"), {"SCHEMA_VIOLATION", "items/belt.affects"}},
      {"items/belt.json", &put_in(&1, ["affects", Access.at(1), "attribute"], "luck"),
       {"UNRESOLVED_REFERENCE", "items/belt.affects[1].attribute"}},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.40"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {"cartridge.json", &update_in(&1, ["requires", "capabilities"], drop.("attributes")),
       {"UNDECLARED_CAPABILITY", "items/belt.affects"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    # Finger rings without affects still need API 1.41.
    plain =
      for f <- ~w(ring_left ring_right ring_spare belt), do: {"items/#{f}.json", drop.("affects")}

    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.40")}

    assert {:error, [%{"code" => "KERNEL_API_RANGE_INVALID"}]} =
             Loka.ContentSource.compile(dir, [api | plain])
  end
end
