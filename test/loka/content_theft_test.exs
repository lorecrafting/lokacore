defmodule Loka.ContentTheftTest do
  use ExUnit.Case, async: true

  # Breaks (rows 33 and 34; twin of case 8 in kernel/ts/test/theft.test.ts): a bank vault NPC
  # without a get lock, an authored write to the stolen fact, a stolen offer with stock, a
  # non-stolen offer naming another NPC's item, a stolen fact of the wrong scope, or an NPC lock,
  # stolen offers or world.theft alone under API 1.94 compiles.
  test "theft declarations keep their boundaries" do
    dir = Loka.ContentSource.copy("cartridges/theft_sampler")
    old = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.93")
    api = {"cartridge.json", old}
    bare = {"cartridge.json", &(&1 |> old.() |> pop_in(["world", "theft"]) |> elem(1))}
    no_shop = {"npcs/fence.json", &Map.delete(&1, "shop")}
    no_lock = {"npcs/vault.json", &Map.delete(&1, "locks")}
    offer = &{"npcs/fence.json", fn n -> update_in(n, ["shop", "offers", Access.at(0)], &1) end}
    stolen = %{"op" => "fact.assign", "fact" => "stolen", "value" => true}
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    vault = {"SCHEMA_VIOLATION", "services/deposit.benefit.vault"}

    diags = fn edits ->
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    assert diags.([no_lock]) == [vault]

    assert diags.([
             {"reactions/theft_seen.json", &update_in(&1, ["apply"], fn a -> a ++ [stolen] end)}
           ]) ==
             [{"RESERVED_FACT", "reactions/theft_seen.apply[1].fact"}]

    stock = %{"items" => ["purse", "coin"], "buy" => [6, 6]}

    assert diags.([offer.(&Map.put(&1, "stock", stock))]) ==
             [{"SCHEMA_VIOLATION", "npcs/fence.shop.offers[0].stolen"}]

    assert diags.([api]) == [floor]
    # The vault's NPC lock alone, the fence's stolen offers alone, world.theft alone.
    assert diags.([bare, no_shop]) == [floor]
    assert diags.([bare, no_lock]) == [floor]
    assert diags.([api, no_shop, no_lock]) == [floor, vault]

    assert diags.([offer.(&Map.delete(&1, "stolen"))]) == [
             {"UNRESOLVED_REFERENCE", "npcs/fence.shop"}
           ]

    assert diags.([{"facts.json", &put_in(&1, ["facts", "stolen", "scopes"], ["player"])}]) ==
             [{"FACT_SCOPE_UNSUPPORTED", "cartridge.world.theft.stolen"}]

    theft = &{"cartridge.json", fn c -> put_in(c, ["world", "theft" | &1], "nope") end}

    assert diags.([theft.(["skill"])]) == [
             {"UNRESOLVED_REFERENCE", "cartridge.world.theft.skill"}
           ]

    assert diags.([theft.(["narration", "seen"])]) == [
             {"UNRESOLVED_REFERENCE", "cartridge.world.theft.narration.seen"}
           ]

    nope = %{"op" => "fact_compare", "fact" => "nope", "equals" => true}

    assert diags.([{"npcs/vault.json", &put_in(&1, ["locks", "get", "root"], nope)}]) ==
             [{"UNRESOLVED_REFERENCE", "npcs/vault.locks.get.root.fact"}]
  end
end
