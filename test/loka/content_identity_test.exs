defmodule Loka.ContentIdentityTest do
  use ExUnit.Case, async: true

  # Breaks (rows W15 and FD9; twin of the loader case in kernel/ts/test/identity.test.ts):
  # world.identity under API 1.97, a name variant naming an undeclared status, or an unknown
  # name text key compiles.
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

    hooded = ["name_variants", Access.at(0), "when", "root", "status"]

    assert diags.([id.(hooded, "nope")]) ==
             [
               {"UNRESOLVED_REFERENCE",
                "cartridge.world.identity.name_variants[0].when.root.status"}
             ]

    assert diags.([id.(["name"], "identity.nope")]) ==
             [{"UNRESOLVED_REFERENCE", "cartridge.world.identity.name"}]
  end
end
