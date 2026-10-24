defmodule Loka.ContentVoicesTest do
  use ExUnit.Case, async: true

  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

  # Breaks (toolbox row FD2; twin of voices.test.ts): the compiler stops walking the
  # skill_compare leaf, so an undeclared skill compiles and fails in play, the leaf loses its
  # skills@1 owner, the 1.91 floor misses a lone leaf, or a retired `asides` field compiles.
  test "skill_compare: reference, owner and floor; asides refused" do
    dir = Loka.ContentSource.copy("cartridges/voices_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.90")}
    no_recipe = {"recipes/read_glyphs.json", nil}

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "skills") end)}

    for {changes, path, data} <- [
          {[
             {"npcs/sage.json",
              &put_in(&1, ["room_line_variants", Access.at(0), "when", "root", "skill"], "ghost")}
           ], "npcs/sage.room_line_variants[0].when.root.skill",
           %{"target" => "voices_sampler@0.0.1:skill/ghost"}},
          {[unowned, no_recipe], "npcs/sage.room_line_variants[0].when.root.op",
           %{"capability" => "skills"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert %{"data" => ^data} = Enum.find(diags, &(&1["path"] == path)), inspect(diags)
    end

    for changes <- [[api], [api, no_recipe]] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert @floor in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    no_leaf = {"npcs/sage.json", &Map.delete(&1, "room_line_variants")}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api, no_leaf, no_recipe])

    asides = {"rooms/hall.json", &Map.put(&1, "asides", [])}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [asides])
    assert [%{"code" => "UNKNOWN_FIELD", "path" => "rooms/hall.asides"}] = diags
  end
end
