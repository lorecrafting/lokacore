defmodule Loka.ContentGiftTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/gift_sampler")}

  # Breaks (Homestead hs-7, barter row kgd.70): a barter compiles with price 0 without a barter
  # escrow, a negative price, a claim of an untimed output, or a barter without its no_output text.
  test "a barter keeps its escrow, a non-negative price and its texts", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    at = "services/knife_for_pelts"
    service = &{"services/knife_for_pelts.json", &1}

    claim = [
      {"npcs/trader.json", &Map.put(&1, "services", ["knife_for_pelts", "claim"])},
      {"services/claim.json",
       %{
         "provider" => "trader",
         "currency" => "pennies",
         "action" => "barter",
         "label" => "service.barter",
         "narration" => "service.barter.used",
         "price" => 1,
         "benefit" => %{"kind" => "claim", "service" => "knife_for_pelts"}
       }},
      {"text.json", &Map.merge(&1, %{"service.no_order" => "x", "service.not_ready" => "x"})}
    ]

    for {edits, expected} <- [
          {[
             service.(
               &put_in(&1, ["benefit"], %{"kind" => "entitlement", "fact" => "traded_knife"})
             ),
             {"text.json", &Map.put(&1, "service.already_paid", "x")}
           ], {"SCHEMA_VIOLATION", "#{at}.price"}},
          {[service.(&Map.put(&1, "price", -1))], {"SCHEMA_VIOLATION", "#{at}.price"}},
          {claim, {"SCHEMA_VIOLATION", "services/claim.benefit.service"}},
          {[{"text.json", &Map.delete(&1, "service.no_output")}], {"UNRESOLVED_REFERENCE", at}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
