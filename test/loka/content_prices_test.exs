defmodule Loka.ContentPricesTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/prices_sampler")}

  # Breaks (toolbox row W11; twin of the loader rows in kernel/ts/test/prices.test.ts): a stock
  # table compiles under API 1.81, with a price per count that does not match its set, a set not
  # led by the offer's item, a flat buy other than the first price, a repeated or unknown item.
  test "a stock table keeps its API floor, one price per item, the offer's item first", %{
    dir: dir
  } do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    at = "npcs/fishmonger.shop.offers[0].stock"

    stock =
      &{"npcs/fishmonger.json",
       fn n -> update_in(n, ["shop", "offers"], fn [o] -> [&1.(o)] end) end}

    for {edits, expected} <- [
          {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.81")}],
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {[stock.(&put_in(&1, ["stock", "buy"], [5, 3]))], {"SCHEMA_VIOLATION", at}},
          {[stock.(&put_in(&1, ["stock", "items"], ["fish_b", "fish_a", "fish_c"]))],
           {"SCHEMA_VIOLATION", at}},
          {[stock.(&Map.put(&1, "buy", 4))], {"SCHEMA_VIOLATION", at}},
          {[stock.(&put_in(&1, ["stock", "items"], ["fish_a", "fish_b", "fish_a"]))],
           {"DUPLICATE_DEFINITION", "#{at}.items"}},
          {[stock.(&put_in(&1, ["stock", "items"], ["fish_a", "fish_b", "nowhere"]))],
           {"UNRESOLVED_REFERENCE", "#{at}.items[2]"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
