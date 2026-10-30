defmodule Loka.ContentVoicesTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row FD2; twin of voices.test.ts): the compiler stops walking the
  # skill_compare leaf, so an undeclared skill compiles and fails in play, the leaf loses its
  # skill@1 owner, or a retired `asides` field or an NPC's `room_line_variants` (retired: an NPC's
  # mood is its name and description variants, owner 2026-10-30) compiles.
  test "skill_compare: reference and owner; asides and NPC room_line_variants refused" do
    dir = Loka.ContentSource.copy("cartridges/voices_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    no_scripted = {"actions/read_glyphs.json", nil}

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "skill") end)}

    for {changes, path, data} <- [
          {[
             {"npcs/sage.json",
              &put_in(&1, ["description_variants", Access.at(0), "when", "skill"], "ghost")}
           ], "npcs/sage.description_variants[0].when.skill",
           %{"target" => "voices_sampler@0.0.1:skill/ghost"}},
          {[unowned, no_scripted], "npcs/sage.description_variants[0].when.op",
           %{"capability" => "skill"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert %{"data" => ^data} = Enum.find(diags, &(&1["path"] == path)), inspect(diags)
    end

    asides = {"rooms/hall.json", &Map.put(&1, "asides", [])}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [asides])
    assert [%{"code" => "UNKNOWN_FIELD", "path" => "rooms/hall.asides"}] = diags

    moods = {"npcs/sage.json", &Map.put(&1, "room_line_variants", [])}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [moods])
    assert [%{"code" => "UNKNOWN_FIELD", "path" => "npcs/sage.room_line_variants"}] = diags
  end
end
