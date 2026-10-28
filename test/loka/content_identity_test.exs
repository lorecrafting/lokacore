defmodule Loka.ContentIdentityTest do
  use ExUnit.Case, async: true

  # Breaks (rows W15 and FD9; twin of the loader case in kernel/ts/test/identity.test.ts):
  # world.identity under API 1.97 (also with no variant at all), a name variant naming an
  # undeclared status or an unknown text key, a name variant without description_variant@1, a
  # time_since name variant on a non-clock fact, a fact_compare name variant on subject target, or an unknown name text key compiles.
  test "world.identity keeps its floor and references" do
    dir = Loka.ContentSource.copy("cartridges/identity_sampler")
    id = &{"cartridge.json", fn c -> put_in(c, ["world", "identity" | &1], &2) end}

    diags = fn edits ->
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    drop_cap = &(pop_in(&1, ["requires", "capabilities", "description_variant"]) |> elem(1))

    assert diags.([{"cartridge.json", drop_cap}]) == [
             {"UNDECLARED_CAPABILITY", "cartridge.world.identity.name_variants[0]"},
             {"UNDECLARED_CAPABILITY", "cartridge.world.identity.name_variants[1]"},
             {"UNDECLARED_CAPABILITY", "npcs/stranger.short_variants[0]"}
           ]

    hooded = ["name_variants", Access.at(0), "when", "root", "status"]

    assert diags.([id.(hooded, "nope")]) ==
             [
               {"UNRESOLVED_REFERENCE",
                "cartridge.world.identity.name_variants[0].when.root.status"}
             ]

    assert diags.([id.(["name_variants", Access.at(0), "description"], "identity.nope")]) ==
             [
               {"UNRESOLVED_REFERENCE", "cartridge.world.identity.name_variants[0].description"}
             ]

    target = %{"fact" => "knows_name", "subject" => "target"}
    knows = ["world", "identity", "name_variants", Access.at(1), "when", "root"]

    assert diags.([{"cartridge.json", &update_in(&1, knows, fn r -> Map.merge(r, target) end)}]) ==
             [
               {"FACT_SCOPE_UNSUPPORTED",
                "cartridge.world.identity.name_variants[1].when.root.subject"}
             ]

    since = %{"op" => "time_since", "fact" => "wanted", "at_least" => 1}

    assert diags.([id.(["name_variants", Access.at(1), "when", "root"], since)]) ==
             [{"SCHEMA_VIOLATION", "cartridge.world.identity.name_variants[1].when.root.fact"}]

    assert diags.([id.(["name"], "identity.nope")]) ==
             [{"UNRESOLVED_REFERENCE", "cartridge.world.identity.name"}]
  end
end
