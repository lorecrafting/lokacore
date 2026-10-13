defmodule Loka.ContentEscrowTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/escrow_sampler")}

  # Breaks (toolbox row 20a; twin of the loader rows in kernel/ts/test/escrow.test.ts): an escrow
  # compiles under API 1.79, with an input that is not an item, a custody that is not a room, a
  # quantity above the inputs, a shop offer or a repeated item as an input, or without its texts.
  test "escrow keeps its API floor, item inputs, a room custody and its texts", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    escrow = ["benefit", "escrow"]
    at = "services/commission.benefit.escrow"
    service = &{"services/commission.json", &1}

    shop = [
      {"cartridge.json", &put_in(&1, ["requires", "capabilities", "commerce"], 1)},
      {"npcs/smith.json",
       &Map.put(&1, "shop", %{
         "resource" => "pennies",
         "offers" => [%{"item" => "ore_d", "buy" => 2, "sell" => 1}],
         "bought" => "service.unaffordable",
         "sold" => "service.unaffordable"
       })},
      {"items/ore_d.json", &Map.put(&1, "location", %{"in" => "npc", "npc" => "smith"})}
    ]

    for {edits, expected} <- [
          {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.78")}],
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {[service.(&put_in(&1, escrow ++ ["items"], ["nowhere", "ore_b"]))],
           {"UNRESOLVED_REFERENCE", "#{at}.items[0]"}},
          {[service.(&put_in(&1, escrow ++ ["custody"], "ore_a"))],
           {"UNRESOLVED_REFERENCE", "#{at}.custody"}},
          {[service.(&put_in(&1, escrow ++ ["quantity"], 5))],
           {"SCHEMA_VIOLATION", "#{at}.quantity"}},
          {shop, {"SCHEMA_VIOLATION", "#{at}.items[3]"}},
          {[service.(&put_in(&1, escrow ++ ["items"], ["ore_a", "ore_b", "ore_a"]))],
           {"DUPLICATE_DEFINITION", "#{at}.items"}},
          {[{"text.json", &Map.delete(&1, "service.order_open")}],
           {"UNRESOLVED_REFERENCE", "services/commission"}},
          {[{"text.json", &Map.delete(&1, "service.missing_inputs")}],
           {"UNRESOLVED_REFERENCE", "services/commission"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
