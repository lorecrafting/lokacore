defmodule Loka.ContentVoicesTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row FD2; twin of voices.test.ts): the compiler stops walking the
  # skill_compare leaf, so an undeclared skill compiles and fails in play, the leaf loses its
  # skills@1 owner, or a retired `asides` field compiles.
  test "skill_compare: reference and owner; asides refused" do
    dir = Loka.ContentSource.copy("cartridges/voices_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    no_recipe = {"actions/read_glyphs.json", nil}

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "skills") end)}

    for {changes, path, data} <- [
          {[
             {"npcs/sage.json",
              &put_in(&1, ["room_line_variants", Access.at(0), "when", "skill"], "ghost")}
           ], "npcs/sage.room_line_variants[0].when.skill",
           %{"target" => "voices_sampler@0.0.1:skill/ghost"}},
          {[unowned, no_recipe], "npcs/sage.room_line_variants[0].when.op",
           %{"capability" => "skills"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert %{"data" => ^data} = Enum.find(diags, &(&1["path"] == path)), inspect(diags)
    end

    asides = {"rooms/hall.json", &Map.put(&1, "asides", [])}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [asides])
    assert [%{"code" => "UNKNOWN_FIELD", "path" => "rooms/hall.asides"}] = diags
  end
end
