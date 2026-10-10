defmodule Loka.ContentVariantsTest do
  use ExUnit.Case, async: true

  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
  @variant [
    %{
      "when" => %{"policy_version" => 1, "root" => %{"op" => "has_item", "item" => "lamp_oil"}},
      "description" => "item.lantern.room_oil"
    }
  ]

  # Breaks (toolbox row W6): the compiler accepts a new entity variant list or leaf below
  # kernel_api 1.46, refuses an item's room_line_variants (older than the row; ashmere_items
  # declares one at 1.0), or leaves an NPC variant's short reference unexpanded.
  test "row W6 fields and leaves need 1.46; an item room-line variant does not" do
    dir = Loka.ContentSource.copy("cartridges/ashmere_items")
    api = &{"cartridge.json", fn m -> put_in(m, ["requires", "kernel_api", "at_least"], &1) end}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.45")])
    leaf = fn op -> &put_in(&1, ["room_line_variants", Access.at(0), "when", "root"], op) end

    rows = [
      {"items/lantern.json", &Map.put(&1, "short_variants", @variant)},
      {"items/lantern.json", &Map.put(&1, "description_variants", @variant)},
      {"npcs/bram.json", &Map.put(&1, "short_variants", @variant)},
      {"npcs/bram.json", &Map.put(&1, "room_line_variants", @variant)},
      {"npcs/bram.json", &Map.put(&1, "description_variants", @variant)},
      {"items/lantern.json", leaf.(%{"op" => "position", "npc" => "bram"})},
      {"items/lantern.json",
       leaf.(%{"op" => "status_active", "subject" => "target", "status" => "x"})}
    ]

    for change <- rows do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [api.("1.45"), change])
      assert @floor in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    for change <- Enum.take(rows, 5),
        do: assert({:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.46"), change]))
  end

  # Breaks: the compiler stops walking an NPC's or item's new variant lists, so a variant naming
  # an undeclared status or text key compiles and fails at load or in play.
  test "a new variant list's references and text keys are checked" do
    dir = Loka.ContentSource.copy("cartridges/variants_sampler")
    ghost = &put_in(&1, ["description_variants", Access.at(0), "when", "root", "status"], "ghost")
    no_text = &put_in(&1, ["short_variants", Access.at(0), "description"], "item.sword.gone")

    for {file, change, path, target} <- [
          {"npcs/maud.json", ghost, "npcs/maud.description_variants[0].when.root.status",
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
end
