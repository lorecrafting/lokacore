defmodule Loka.ContentServicesTest do
  use ExUnit.Case, async: true

  # The showcase carries no meal, drink or room service, so the three are written into the
  # copy here, with their stock, cask, fact and actions. Every number is set in this file.
  setup_all do
    dir = Loka.ContentSource.copy("cartridges/toolbox_showcase")
    put = fn rel, f -> File.write!(Path.join(dir, rel), JSON.encode!(f.(read(dir, rel)))) end
    open = %{"op" => "all", "items" => []}

    put.("resources.json", fn r ->
      put_in(r, ["resources", "meal_stock"], %{
        "minimum" => 0,
        "maximum" => 4,
        "start" => 0,
        "gain" => 0
      })
    end)

    put.("facts.json", fn r ->
      put_in(r, ["facts", "bed_paid"], %{
        "version" => 1,
        "value_type" => %{"type" => "bool", "default" => false},
        "scopes" => ["player"],
        "meaning" => "The player paid the cook for the bed."
      })
    end)

    put.("text.json", fn t ->
      t =
        Map.merge(t, %{"service.full_mv" => "Your MV is full.", "service.sold_out" => "Sold out."})

      Enum.reduce(~w(meal ale room), t, fn n, t ->
        t |> Map.put("service.#{n}", n) |> Map.put("service.#{n}.used", "#{n} used")
      end)
    end)

    put.("npcs/cook.json", fn n ->
      n
      |> put_in(["resource_starts", "meal_stock"], 4)
      |> put_in(["resource_starts", "pennies"], 10)
      |> update_in(["services"], &(&1 ++ ["kitchen_room", "kitchen_meal", "kitchen_ale"]))
    end)

    File.write!(
      Path.join(dir, "liquids/ale.json"),
      JSON.encode!(%{
        "name" => "liquid.draught",
        "unit_label" => "liquid.doses",
        "grams_per_unit" => 250,
        "drink_amount" => 1
      })
    )

    File.write!(
      Path.join(dir, "items/kitchen_cask.json"),
      JSON.encode!(%{
        "keywords" => ["kitchen_cask"],
        "name" => "item.cask.short",
        "room_line" => "item.cask.room",
        "description" => "item.cask.description",
        "mass_grams" => 500,
        "location" => %{"in" => "npc", "npc" => "cook"},
        "vessel" => %{
          "capacity" => 4,
          "unit_label" => "liquid.doses",
          "initial" => %{"kind" => "ale", "quantity" => 4}
        }
      })
    )

    for {name, action, price, benefit} <- [
          {"kitchen_meal", "eat_kitchen_meal", 2,
           %{
             "op" => "meal",
             "stock" => "meal_stock",
             "debit" => 1,
             "recovery" => "mv",
             "amount" => 12
           }},
          {"kitchen_ale", "drink_kitchen_ale", 1,
           %{
             "op" => "drink",
             "vessel" => "kitchen_cask",
             "liquid" => "ale",
             "recovery" => "mv",
             "amount" => 4
           }},
          {"kitchen_room", "rent_kitchen_room", 3, %{"op" => "entitlement", "fact" => "bed_paid"}}
        ] do
      label = "service." <> String.replace_prefix(name, "kitchen_", "")

      File.write!(
        Path.join(dir, "actions/#{action}.json"),
        JSON.encode!(%{
          "name" => label,
          "command" => "use_service",
          "target" => %{"kind" => "entity", "scopes" => ["room_occupants"]},
          "input" => ["service", "quoted_price"],
          "priority" => 0,
          "policy" => open,
          "accessibility" => label
        })
      )

      File.write!(
        Path.join(dir, "services/#{name}.json"),
        JSON.encode!(%{
          "provider" => "cook",
          "currency" => "pennies",
          "action" => action,
          "name" => label,
          "narration" => label <> ".used",
          "price" => price,
          "benefit" => benefit
        })
      )
    end

    %{dir: dir}
  end

  defp read(dir, rel), do: JSON.decode!(File.read!(Path.join(dir, rel)))

  # Breaks: source compilation accepts impossible/nonfinite service funding, arbitrary benefits or mismatched provider stock.
  # Each case names the diagnostic path it must hit, so an unrelated showcase failure cannot pass it.
  test "service declarations refuse unsafe funding, consequences and provider identity", %{
    dir: dir
  } do
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    mutations = [
      {"npcs/cook.json",
       &update_in(&1, ["resource_starts"], fn r -> Map.delete(r, "meal_stock") end),
       "services/kitchen_meal.benefit.stock"},
      {"npcs/cook.json",
       &update_in(&1, ["resource_starts"], fn r -> Map.delete(r, "pennies") end),
       "services/kitchen_meal.currency"},
      {"npcs/hob.json", &Map.put(&1, "services", ["kitchen_meal"]), "npcs/hob.services"},
      {"npcs/cook.json", &update_in(&1, ["services"], fn r -> [hd(r) | r] end),
       "npcs/cook.services"},
      {"resources.json", &put_in(&1, ["resources", "meal_stock", "gain"], 1),
       "services/kitchen_meal.benefit.stock"},
      {"services/kitchen_room.json", &Map.put(&1, "narration", "unknown.line"),
       "services/kitchen_room.narration"},
      {"services/kitchen_meal.json", &Map.put(&1, "provider", "hob"),
       "services/kitchen_meal.provider"},
      {"services/kitchen_meal.json", &put_in(&1, ["benefit", "stock"], "pennies"),
       "services/kitchen_meal.benefit.stock"},
      {"services/kitchen_meal.json", &put_in(&1, ["benefit", "stock"], "missing"),
       "services/kitchen_meal.benefit.stock"},
      {"services/kitchen_meal.json", &put_in(&1, ["benefit", "recovery"], "hp"),
       "services/kitchen_meal.benefit.recovery"},
      {"services/kitchen_ale.json", &put_in(&1, ["benefit", "liquid"], "draught"),
       "services/kitchen_ale.benefit.vessel"},
      {"items/kitchen_cask.json", &put_in(&1, ["location", "npc"], "hob"),
       "services/kitchen_ale.benefit.vessel"},
      {"liquids/ale.json", &Map.put(&1, "drink_amount", 5),
       "services/kitchen_ale.benefit.vessel"},
      {"actions/eat_kitchen_meal.json", &Map.put(&1, "command", "look"),
       "services/kitchen_meal.action"},
      {"facts.json", &put_in(&1, ["facts", "bed_paid", "scopes"], ["instance"]),
       "services/kitchen_room.benefit.fact"},
      {"facts.json", &put_in(&1, ["facts", "bed_paid", "value_type", "default"], true),
       "services/kitchen_room.benefit.fact"},
      {"dialogues/aldous_lesson.json",
       &put_in(&1, ["choices", "learn", "sequence"], [
         %{"op" => "fact.assign", "fact" => "bed_paid", "value" => true}
       ]), "dialogues/aldous_lesson.choices.learn.sequence[0].fact"}
    ]

    for {file, change, path} <- mutations do
      {:error, d} = Loka.ContentSource.compile(dir, [{file, change}])
      assert Enum.any?(d, &(&1["path"] == path)), inspect({file, path, Enum.map(d, & &1["path"])})
    end
  end
end
