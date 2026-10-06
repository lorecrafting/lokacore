defmodule Loka.ContentFoodTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  # Breaks: source allows non-recovery food, holder/equipment conflicts or a missing food API/capability.
  test "held-food source rejects unsafe or unbound consequences", %{tmp_dir: dir} do
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

    Enum.with_index(cases, fn {file, change}, i ->
      source = Path.join(dir, Integer.to_string(i))
      File.cp_r!("cartridges/ashmere_missing_child", source)
      path = Path.join(source, file)
      changed = change.(JSON.decode!(File.read!(path)))
      File.write!(path, JSON.encode!(changed))

      if get_in(changed, ["edible", "resource"]) == "hp" do
        resource_path = Path.join(source, "resources.json")
        resources = JSON.decode!(File.read!(resource_path))
        regen = resources["resources"]["mv"]["regen"]

        File.write!(
          resource_path,
          JSON.encode!(put_in(resources, ["resources", "hp", "regen"], regen))
        )
      end

      assert {:error, _} = Loka.Content.compile(source), file
    end)
  end
end
