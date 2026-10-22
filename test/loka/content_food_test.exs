defmodule Loka.ContentFoodTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

  # Breaks: source allows non-recovery food, holder/equipment conflicts or a missing food API/capability.
  test "held-food source rejects unsafe or unbound consequences", %{dir: dir} do
    file = "items/loaf.json"

    cases = [
      {file, &put_in(&1, ["edible", "amount"], 0), ["items/loaf.edible.amount"]},
      {file, &put_in(&1, ["edible", "amount"], 9_007_199_254_740_992),
       ["items/loaf.edible.amount"]},
      {file, &put_in(&1, ["edible", "resource"], "unknown"), ["items/loaf.edible"]},
      {file, &put_in(&1, ["edible", "resource"], "hp"), ["items/loaf.edible"]},
      {file, &Map.put(&1, "container", true), ["items/loaf.edible"]},
      {file, &Map.put(&1, "slot", "hand"), ["items/loaf.slot"]},
      {file, &put_in(&1, ["edible", "narration"], "missing.line"),
       ["items/loaf.edible.narration"]},
      {"resources.json", &put_in(&1, ["resources", "mv", "regen", "by_position", "standing"], 0),
       ["items/loaf.edible"]},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.26"),
       ["cartridge.requires.kernel_api.at_least"]},
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "food") end),
       ["items/loaf.edible"]}
    ]

    for {file, change, paths} <- cases do
      changed = change.(JSON.decode!(File.read!(Path.join(dir, file))))

      regen =
        if get_in(changed, ["edible", "resource"]) == "hp",
          do: [
            {"resources.json",
             &put_in(&1, ["resources", "hp", "regen"], &1["resources"]["mv"]["regen"])}
          ],
          else: []

      {:error, d} = Loka.ContentSource.compile(dir, [{file, changed} | regen])
      assert Enum.any?(d, &(&1["path"] in paths)), inspect({file, Enum.map(d, & &1["path"])})
    end
  end
end

defmodule Loka.ContentMealTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/kitchen_sampler")}

  # Row hs-5. Breaks: an empty `applies` (minItems), a ref left unresolved, or a meal status
  # moving the derived hp maximum (loka-kgd.50), its term named short or qualified; the 1.101
  # floor row is in loader_floors.json.
  test "a meal's applies resolves and never names an hp_max status", %{dir: dir} do
    stew = "items/stew_plain_01.json"
    read = &JSON.decode!(File.read!(Path.join(dir, &1)))

    hp_max = %{
      "hp_max" => %{"terms" => [%{"attribute" => "str", "per_point" => 1, "pivot" => 10}]}
    }

    at = "items/stew_plain_01.edible.applies"
    edit = &[{stew, put_in(read.(stew), ["edible", "applies"], &1)}]
    derive = &[{"cartridge.json", put_in(read.("cartridge.json"), ["world", "derived"], &1)}]
    derived = derive.(hp_max)
    # The same attribute as a qualified ref: the gate compares expanded refs, not source strings.
    qualified =
      put_in(hp_max, ["hp_max", "terms", Access.at(0), "attribute"], %{
        "cartridge_id" => "kitchen_sampler",
        "cartridge_version" => "0.0.1",
        "kind" => "attribute",
        "key" => "str"
      })

    cases = [
      {edit.([]), {"SCHEMA_VIOLATION", at}},
      {edit.(["nothing"]), {"UNRESOLVED_REFERENCE", at <> "[0]"}},
      {derived, {"SCHEMA_VIOLATION", at <> "[0]"}},
      {derive.(qualified), {"SCHEMA_VIOLATION", at <> "[0]"}}
    ]

    for {changes, expected} <- cases do
      assert {:error, ds} = Loka.ContentSource.compile(dir, changes)
      assert expected in for(d <- ds, do: {d["code"], d["path"]})
    end
  end
end
