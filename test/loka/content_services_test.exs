defmodule Loka.ContentServicesTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: source compilation accepts impossible/nonfinite service funding, arbitrary benefits or mismatched provider stock.
  test "service declarations refuse unsafe funding, consequences and provider identity", %{
    dir: dir
  } do
    mutations = [
      {"npcs/maud.json",
       &update_in(&1, ["resource_starts"], fn r -> Map.delete(r, "pennies") end)},
      {"npcs/maud.json",
       &update_in(&1, ["resource_starts"], fn r -> Map.delete(r, "lantern_meals") end)},
      {"npcs/maud.json", &update_in(&1, ["services"], fn r -> [hd(r) | r] end)},
      {"resources.json", &put_in(&1, ["resources", "pennies", "gain"], 1)},
      {"resources.json", &put_in(&1, ["resources", "lantern_meals", "gain"], 1)},
      {"services/lantern_room.json", &Map.put(&1, "narration", "unknown.line")},
      {"services/lantern_meal.json", &Map.put(&1, "provider", "peg")},
      {"services/lantern_meal.json", &put_in(&1, ["benefit", "stock"], "pennies")},
      {"services/lantern_meal.json", &put_in(&1, ["benefit", "stock"], "missing")},
      {"services/lantern_meal.json", &put_in(&1, ["benefit", "recovery"], "hp")},
      {"services/lantern_ale.json", &put_in(&1, ["benefit", "liquid"], "water")},
      {"items/lantern_ale_cask.json", &put_in(&1, ["location", "npc"], "peg")},
      {"liquids/ale.json", &Map.put(&1, "drink_amount", 5)},
      {"actions/eat_lantern_meal.json", &Map.put(&1, "command", "look")},
      {"facts.json", &put_in(&1, ["facts", "lantern_bed_paid", "scopes"], ["instance"])},
      {"facts.json", &put_in(&1, ["facts", "lantern_bed_paid", "value_type", "default"], true)},
      {"dialogues/maud_offer.json",
       &put_in(&1, ["choices", "accept", "sequence"], [
         %{"op" => "fact.assign", "fact" => "lantern_bed_paid", "value" => true}
       ])},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.22")}
    ]

    for {file, change} <- mutations do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end
end
