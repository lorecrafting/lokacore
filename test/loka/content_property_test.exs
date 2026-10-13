defmodule Loka.ContentPropertyTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/property_sampler")}

  # Breaks (toolbox row 25; twin of the loader rows in kernel/ts/test/property.test.ts): a deposit
  # or withdraw compiles under API 1.82, with an account that is not a bounded int player fact
  # from 0 or is no fact, a vault that is no NPC or holds no pennies, branches on one account with
  # different vaults, an entitlement or an authored dialogue write on the account, or without
  # service.no_funds.
  test "the bank keeps its API floor, a bounded account, one vault and its texts", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    at = "services/deposit_a.benefit"
    savings = &put_in(&1, ["facts", "savings", "value_type" | &2], &3)

    talk = %{
      "npc" => "clerk_a",
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}},
      "prompt" => "service.deposit",
      "roles" => %{"clerk" => %{"role" => "npc", "npc" => "clerk_a"}},
      "choices" => %{
        "gift" => %{
          "label" => "service.deposit",
          "narration" => "service.deposit.used",
          "sequence" => [%{"op" => "fact.assign", "fact" => "savings", "value" => 50}]
        }
      }
    }

    for {edits, expected} <- [
          {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.82")}],
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {[{"facts.json", &savings.(&1, ["minimum"], -5)}],
           {"SCHEMA_VIOLATION", "#{at}.account"}},
          {[{"facts.json", &savings.(&1, ["default"], 5)}],
           {"SCHEMA_VIOLATION", "#{at}.account"}},
          {[{"services/deposit_a.json", &put_in(&1, ["benefit", "account"], "nowhere")}],
           {"UNRESOLVED_REFERENCE", "#{at}.account"}},
          {[{"services/deposit_a.json", &put_in(&1, ["benefit", "vault"], "nowhere")}],
           {"UNRESOLVED_REFERENCE", "#{at}.vault"}},
          {[{"npcs/vault.json", &Map.delete(&1, "resource_starts")}],
           {"SCHEMA_VIOLATION", "#{at}.vault"}},
          {[{"services/withdraw_b.json", &put_in(&1, ["benefit", "vault"], "clerk_a")}],
           {"SCHEMA_VIOLATION", "services/withdraw_b.benefit.vault"}},
          {[{"services/buy_hut.json", &put_in(&1, ["benefit", "fact"], "savings")}],
           {"SCHEMA_VIOLATION", "services/buy_hut.benefit.fact"}},
          {[
             {"cartridge.json", &put_in(&1, ["requires", "capabilities", "dialogue"], 1)},
             {"dialogues/clerk_gift.json", talk}
           ], "RESERVED_FACT"},
          {[{"text.json", &Map.delete(&1, "service.no_funds")}],
           {"UNRESOLVED_REFERENCE", "services/deposit_a"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      found = Enum.map(diags, &{&1["code"], &1["path"]})
      assert expected in found or expected in Enum.map(found, &elem(&1, 0)), inspect(diags)
    end
  end
end
