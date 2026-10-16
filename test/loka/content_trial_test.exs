defmodule Loka.ContentTrialTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 35; twin of the loader rows in kernel/ts/test/trial.test.ts): an arrest
  # compiles without hostile or beside engage, on a spawn template, to a room that does not
  # exist, with a line missing from the text, or under API 1.104.
  test "an arrest needs hostile, no engage, a room, its line and API 1.105" do
    dir = Loka.ContentSource.copy("cartridges/trial_sampler")
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])
    at = "npcs/guard.disposition"
    guard = "npcs/guard.json"

    for {edit, expected} <- [
          {{guard, &(pop_in(&1, ["disposition", "hostile"]) |> elem(1))},
           {"SCHEMA_VIOLATION", at}},
          {{guard, &put_in(&1, ["disposition", "engage"], "npc.guard.arrest")},
           {"SCHEMA_VIOLATION", at}},
          {{guard, &Map.put(&1, "spawn_template", true)}, {"SCHEMA_VIOLATION", at}},
          {{guard, &put_in(&1, ["disposition", "arrest", "to"], "yard")},
           {"UNRESOLVED_REFERENCE", at <> ".arrest.to"}},
          {{guard, &put_in(&1, ["disposition", "arrest", "narration"], "nope")},
           {"UNRESOLVED_REFERENCE", at <> ".arrest.narration"}},
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.104")},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
