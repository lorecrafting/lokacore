defmodule Loka.ContentPracticalSkillsTest do
  use ExUnit.Case, async: true
  # harvest_sampler's careful seam plus an inline smith whose shop carries a mining discount.
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/harvest_sampler")}

  @smith %{
    "keywords" => ["smith"],
    "name" => "item.stick.short",
    "room_line" => "item.stick.room",
    "description" => "item.stick.description",
    "room" => "mine",
    "resource_starts" => %{"pennies" => 20},
    "shop" => %{
      "resource" => "pennies",
      "offers" => [%{"item" => "lamp", "buy" => 3, "sell" => 1}],
      "bought" => "item.stick.short",
      "sold" => "item.stick.short",
      "buy_discount" => %{
        "skill" => "mining",
        "numerator" => 9,
        "denominator" => 10,
        "minimum" => 1
      }
    }
  }
  @lamp %{
    "keywords" => ["lamp"],
    "name" => "item.stick.short",
    "room_line" => "item.stick.room",
    "description" => "item.stick.description",
    "location" => %{"in" => "npc", "npc" => "smith"}
  }
  defp shop(dir, extra \\ []) do
    Loka.ContentSource.compile(
      dir,
      [
        {"cartridge.json",
         &update_in(&1, ["requires", "capabilities"], fn c ->
           Map.merge(c, %{"commerce" => 1, "resource" => 1})
         end)},
        {"resources.json",
         %{
           "resources" => %{
             "pennies" => %{"minimum" => 0, "maximum" => 100, "start" => 20, "gain" => 0}
           }
         }},
        {"npcs/smith.json", @smith},
        {"items/lamp.json", @lamp}
      ] ++ extra
    )
  end

  # Breaks: the buy_discount short skill reference stays a string in the artifact (careful's is in
  # content_harvest_sampler_test's pinned KAT; lesson_payment's in content_training_test).
  test "discount source expands its skill to a DefinitionRef", %{dir: dir} do
    assert {:ok, bytes, _} = shop(dir)
    c = JSON.decode!(bytes)["cartridge"]
    %{"id" => id, "version" => version} = c["manifest"]

    assert c["npcs"]["#{id}@#{version}:npc/smith"]["shop"]["buy_discount"]["skill"] ==
             %{
               "cartridge_id" => id,
               "cartridge_version" => version,
               "kind" => "skill",
               "key" => "mining"
             }
  end

  # Breaks: compiler accepts unresolved opt-ins, a wrong action shape, insufficient finite definitions or unsafe quote arithmetic.
  test "compiler refuses invalid careful/discount consumers", %{dir: dir} do
    careful =
      &{"rooms/mine.json",
       fn c -> put_in(c, ["details", "seam", "harvest", "careful", &1], &2) end}

    discount = &{"npcs/smith.json", put_in(@smith, ["shop", "buy_discount", &1], &2)}

    for change <- [
          careful.("skill", "absent"),
          # two ores in stock
          careful.("count", 3),
          careful.("narration", "absent"),
          {"actions/mine_carefully.json", &Map.put(&1, "input", [])},
          {"actions/mine_carefully.json", &Map.put(&1, "command", "take")},
          {"actions/mine_carefully.json", &Map.put(&1, "target", %{"kind" => "none"})},
          discount.("skill", "absent"),
          discount.("numerator", 11),
          # above the 3p buy
          discount.("minimum", 4),
          {"npcs/smith.json",
           @smith
           |> put_in(["shop", "buy_discount", "numerator"], 2_147_483_647)
           |> put_in(["shop", "buy_discount", "denominator"], 2_147_483_647)
           |> put_in(["shop", "offers"], [
             %{"item" => "lamp", "buy" => 2_147_483_647, "sell" => 1}
           ])}
        ] do
      assert {:error, _} = shop(dir, [change]), inspect(change)
    end
  end
end
