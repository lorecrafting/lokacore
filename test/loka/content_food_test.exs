defmodule Loka.ContentFoodTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: source allows non-recovery food, holder/equipment conflicts or a missing food API/capability.
  test "held-food source rejects unsafe or unbound consequences", %{dir: dir} do
    file = "items/apple_01.json"

    cases = [
      {file, &put_in(&1, ["edible", "amount"], 0)},
      {file, &put_in(&1, ["edible", "amount"], 9_007_199_254_740_992)},
      {file, &put_in(&1, ["edible", "resource"], "unknown")},
      {file, &put_in(&1, ["edible", "resource"], "hp")},
      {file, &Map.put(&1, "container", true)},
      {file, &Map.put(&1, "slot", "hand")},
      {file, &put_in(&1, ["edible", "narration"], "missing.line")},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.26")},
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "food") end)}
    ]

    for {file, change} <- cases do
      changed = change.(JSON.decode!(File.read!(Path.join(dir, file))))

      regen =
        if get_in(changed, ["edible", "resource"]) == "hp",
          do: [
            {"resources.json",
             &put_in(&1, ["resources", "hp", "regen"], &1["resources"]["mv"]["regen"])}
          ],
          else: []

      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, changed} | regen]), file
    end
  end
end
