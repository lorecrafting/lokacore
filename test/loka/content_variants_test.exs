defmodule Loka.ContentVariantsTest do
  use ExUnit.Case, async: true

  @variant [
    %{
      "when" => %{"op" => "has_item", "item" => "lamp_oil"},
      "description" => "item.lantern.room_oil"
    }
  ]

  # Breaks (toolbox row W6): the compiler refuses a new entity variant list on an item or NPC.
  test "row W6 variant lists compile" do
    dir = Loka.ContentSource.copy("cartridges/items_sampler")

    for change <- [
          {"items/lantern.json", &Map.put(&1, "short_variants", @variant)},
          {"items/lantern.json", &Map.put(&1, "description_variants", @variant)},
          {"npcs/bram.json", &Map.put(&1, "short_variants", @variant)},
          {"npcs/bram.json", &Map.put(&1, "room_line_variants", @variant)},
          {"npcs/bram.json", &Map.put(&1, "description_variants", @variant)}
        ],
        do: assert({:ok, _, _} = Loka.ContentSource.compile(dir, [change]))
  end

  # Breaks: the compiler stops walking an NPC's or item's new variant lists, so a variant naming
  # an undeclared status or text key compiles and fails at load or in play, or it refuses the
  # sound sampler (its status_active and npc_present leaves at 1.46).
  test "a new variant list's references and text keys are checked" do
    dir = Loka.ContentSource.copy("cartridges/variants_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    ghost = &put_in(&1, ["description_variants", Access.at(0), "when", "status"], "ghost")
    no_text = &put_in(&1, ["short_variants", Access.at(0), "description"], "item.sword.gone")

    for {file, change, path, target} <- [
          {"npcs/maud.json", ghost, "npcs/maud.description_variants[0].when.status",
           "variants_sampler@0.0.1:status/ghost"},
          {"items/sword.json", no_text, "items/sword.short_variants[0].description",
           "item.sword.gone"}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])

      assert %{
               "code" => "UNRESOLVED_REFERENCE",
               "path" => ^path,
               "data" => %{"target" => ^target}
             } =
               Enum.find(diags, &(&1["path"] == path)),
             inspect(diags)
    end
  end

  # Breaks (twin of kernel/ts/test/variants.test.ts): the compiler accepts a status kind
  # (loka-x6t.64) outside buff and debuff.
  test "a status kind is buff or debuff" do
    dir = Loka.ContentSource.copy("cartridges/variants_sampler")
    neutral = &Map.put(&1, "kind", "neutral")
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"statuses/bruised.json", neutral}])

    assert Enum.any?(
             diags,
             &match?(%{"code" => "SCHEMA_VIOLATION", "path" => "statuses/bruised.kind"}, &1)
           ),
           inspect(diags)
  end
end
