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

  # Breaks (toolbox row 20b; twin of the loader rows in kernel/ts/test/escrow.test.ts): claim and
  # cancel compile under API 1.79, a claim names a service with no ready_after, the output lies
  # outside custody or is no item, or a claim or cancel lacks its refusal texts.
  test "claim and cancel keep their API floor, a timed commission and their texts", %{dir: dir} do
    claim = "services/claim"
    output = "services/commission.benefit.escrow.output"

    for {edits, expected} <- [
          {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.79")}],
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {[{"services/claim.json", &put_in(&1, ["benefit", "service"], "cancel")}],
           {"SCHEMA_VIOLATION", "#{claim}.benefit.service"}},
          {[{"services/cancel.json", &put_in(&1, ["benefit", "service"], "nowhere")}],
           {"UNRESOLVED_REFERENCE", "services/cancel.benefit.service"}},
          {[{"items/sword.json", &put_in(&1, ["location", "room"], "forge")}],
           {"SCHEMA_VIOLATION", output}},
          {[
             {"services/commission.json", &put_in(&1, ["benefit", "escrow", "output"], "nowhere")}
           ], {"UNRESOLVED_REFERENCE", output}},
          {[
             {"cartridge.json",
              &(pop_in(&1, ["requires", "capabilities", "schedule"]) |> elem(1))}
           ], {"UNDECLARED_CAPABILITY", "services/commission.benefit.escrow.ready_after"}},
          {[{"text.json", &Map.delete(&1, "service.not_ready")}],
           {"UNRESOLVED_REFERENCE", claim}},
          {[{"text.json", &Map.delete(&1, "service.no_output")}],
           {"UNRESOLVED_REFERENCE", claim}},
          {[{"text.json", &Map.delete(&1, "service.ready")}],
           {"UNRESOLVED_REFERENCE", "services/cancel"}},
          {[{"text.json", &Map.delete(&1, "service.no_order")}], {"UNRESOLVED_REFERENCE", claim}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
