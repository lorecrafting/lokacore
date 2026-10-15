defmodule Loka.ContentIdentityTest do
  use ExUnit.Case, async: true

  # Breaks (rows W15 and FD9; twin of the loader case in kernel/ts/test/identity.test.ts):
  # world.identity under API 1.97 (also with no variant at all), a name variant naming an
  # undeclared status or an unknown text key, a name variant without description_variant@1, a
  # time_since name variant on a non-clock fact, or an unknown name text key compiles.
  test "world.identity keeps its floor and references" do
    dir = Loka.ContentSource.copy("cartridges/identity_sampler")
    id = &{"cartridge.json", fn c -> put_in(c, ["world", "identity" | &1], &2) end}

    diags = fn edits ->
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert diags.([
             {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.96")}
           ]) ==
             [{"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}]

    assert diags.([
             {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.96")},
             {"npcs/stranger.json", &Map.delete(&1, "short_variants")},
             {"npcs/guard.json",
              &update_in(&1, ["disposition", "hostile", "root"], fn r -> hd(r["items"]) end)},
             {"cartridge.json", &(pop_in(&1, ["world", "identity", "name_variants"]) |> elem(1))}
           ]) ==
             [{"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}]

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

    since = %{"op" => "time_since", "fact" => "wanted", "at_least" => 1}

    assert diags.([id.(["name_variants", Access.at(1), "when", "root"], since)]) ==
             [{"SCHEMA_VIOLATION", "cartridge.world.identity.name_variants[1].when.root.fact"}]

    assert diags.([id.(["name"], "identity.nope")]) ==
             [{"UNRESOLVED_REFERENCE", "cartridge.world.identity.name"}]
  end
end
