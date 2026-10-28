defmodule Loka.ContentDerivedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/derived_sampler")}

  # Breaks: a derived table naming no attribute, lacking attributes@1, or modifying a stat whose combat or carry settings are absent compiles
  # (hit_chance and damage need world.combat, carry_grams world.carry).
  test "derived tables keep their references, owner and settings", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    terms = &["world", "derived", &1, "terms", Access.at(0)]

    cases = [
      {&put_in(&1, terms.("damage") ++ ["attribute"], "luck"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.derived.damage.terms[0].attribute"}},
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

  # Breaks: an item affect on an unworn item, naming no attribute, or lacking attributes@1
  # compiles (toolbox row 3).
  test "item affects keep their slot, references and owner" do
    dir = Loka.ContentSource.copy("cartridges/affects_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    drop = fn key -> &Map.delete(&1, key) end

    cases = [
      {"items/belt.json", drop.("slot"), {"SCHEMA_VIOLATION", "items/belt.affects"}},
      {"items/belt.json", &put_in(&1, ["affects", Access.at(1), "attribute"], "luck"),
       {"UNRESOLVED_REFERENCE", "items/belt.affects[1].attribute"}},
      {"cartridge.json", &update_in(&1, ["requires", "capabilities"], drop.("attributes")),
       {"UNDECLARED_CAPABILITY", "items/belt.affects"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks: an identified item naming no fact or a non-bool fact, or lacking affects compiles (toolbox row 27).
  test "identified items keep their fact and affects" do
    dir = Loka.ContentSource.copy("cartridges/identify_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    ring = &{"items/ring.json", &1}
    count = %{"version" => 1, "value_type" => %{"type" => "int", "default" => 0}}
    count = Map.merge(count, %{"scopes" => ["player"], "meaning" => "A count."})

    cases = [
      {[ring.(&Map.put(&1, "identified", "nope"))],
       {"UNRESOLVED_REFERENCE", "items/ring.identified"}},
      {[
         ring.(&Map.put(&1, "identified", "count")),
         {"facts.json", &put_in(&1, ["facts", "count"], count)}
       ], {"FACT_TYPE_MISMATCH", "items/ring.identified"}},
      {[ring.(&Map.delete(&1, "affects"))], {"SCHEMA_VIOLATION", "items/ring.identified"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks: a gear budget without attributes@1 or with an empty per_slot, an intended level without
  # affects compiles, or a sound budget is refused or dropped from
  # the artifact (balance 6b).
  test "gear budget and intended level keep their owner and affects" do
    dir = Loka.ContentSource.copy("cartridges/affects_sampler")
    api = &{"cartridge.json", fn c -> put_in(c, ["requires", "kernel_api", "at_least"], &1) end}
    budget = %{"per_slot" => %{"waist" => 1}, "per_level" => 1}
    level = &{"items/#{&1}.json", fn i -> Map.put(i, "intended_level", 1) end}
    empty = %{"per_slot" => %{}, "per_level" => 1}
    empty_slots = {"cartridge.json", &put_in(&1, ["world", "gear_budget"], empty)}

    drop_owner =
      {"cartridge.json",
       &(&1
         |> put_in(["world", "gear_budget"], budget)
         |> update_in(["requires", "capabilities"], fn c -> Map.delete(c, "attributes") end))}

    cases = [
      {[drop_owner], {"UNDECLARED_CAPABILITY", "cartridge.world.gear_budget"}},
      {[api.("1.72"), level.("stone")], {"SCHEMA_VIOLATION", "items/stone.intended_level"}},
      {[api.("1.72"), empty_slots], {"SCHEMA_VIOLATION", "cartridge.world.gear_budget.per_slot"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    # Both fields at 1.72 compile and stay in the artifact (one compile path).
    assert {:ok, bytes, _} =
             Loka.ContentSource.compile(dir, [
               {"cartridge.json",
                &(&1
                  |> put_in(["world", "gear_budget"], budget)
                  |> put_in(["requires", "kernel_api", "at_least"], "1.72"))},
               level.("belt")
             ])

    c = JSON.decode!(bytes)["cartridge"]
    assert c["world"]["gear_budget"] == budget
    assert c["items"]["affects_sampler@0.0.1:item/belt"]["intended_level"] == 1
  end

  # Breaks: equip words without a slot or outside the text catalog compile, or sound ones are
  # dropped from the artifact (row 6a; the API floor is a loader_floors.json case).
  test "equip words keep their slot and catalog keys" do
    dir = Loka.ContentSource.copy("cartridges/wear_sampler")
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.116")}
    words = Map.new(~w(wear remove worn removed), &{&1, "item.leather_cap.short"})
    equip = &{"items/leather_cap.json", fn i -> Map.put(&1.(i), "equip", &2) end}

    assert {:ok, bytes, _} = Loka.ContentSource.compile(dir, [api, equip.(& &1, words)])
    c = JSON.decode!(bytes)["cartridge"]
    assert c["items"]["wear_sampler@0.0.1:item/leather_cap"]["equip"] == words

    cases = [
      {equip.(&Map.delete(&1, "slot"), words), {"SCHEMA_VIOLATION", "items/leather_cap.equip"}},
      {equip.(& &1, %{words | "worn" => "no.such"}),
       {"UNRESOLVED_REFERENCE", "items/leather_cap.equip.worn"}}
    ]

    for {change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [api, change])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
