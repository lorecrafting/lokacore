defmodule Loka.ContentVoicesTest do
  use ExUnit.Case, async: true

  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
  @door ["details", "carved_door", "asides"]

  # Breaks (toolbox row FD2; twin of voices.test.ts): the compiler stops walking asides, so an
  # aside naming an undeclared skill or text key compiles and fails in play, the leaf loses its
  # skills@1 owner, or the 1.91 floor misses asides or a lone skill_compare leaf.
  test "asides and skill_compare: references, text, owner and floor" do
    dir = Loka.ContentSource.copy("cartridges/voices_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.90")}

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "skills") end)}

    for {changes, path, data} <- [
          {[
             {"rooms/hall.json",
              &put_in(&1, @door ++ [Access.at(0), "when", "root", "skill"], "ghost")}
           ], "rooms/hall.details.carved_door.asides[0].when.root.skill",
           %{"target" => "voices_sampler@0.0.1:skill/ghost"}},
          {[{"rooms/hall.json", &put_in(&1, ["asides", Access.at(0), "text"], "aside.gone")}],
           "rooms/hall.asides[0].text", %{"target" => "aside.gone"}},
          {[unowned], "rooms/hall.asides[0].when.root.op", %{"capability" => "skills"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert %{"data" => ^data} = Enum.find(diags, &(&1["path"] == path)), inspect(diags)
    end

    no_asides =
      {"rooms/hall.json",
       &(Map.delete(&1, "asides")
         |> update_in(["details", "carved_door"], fn d -> Map.delete(d, "asides") end))}

    # Asides alone, with no skill_compare leaf anywhere, still need 1.91.
    asides_only = [
      api,
      {"rooms/hall.json",
       &(put_in(&1, ["asides", Access.at(0), "when", "root"], %{"op" => "all", "items" => []})
         |> update_in(["details", "carved_door"], fn d -> Map.delete(d, "asides") end))},
      {"npcs/sage.json", &Map.delete(&1, "room_line_variants")},
      {"recipes/read_glyphs.json", nil}
    ]

    for changes <- [[api], [api, no_asides], asides_only] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert @floor in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
