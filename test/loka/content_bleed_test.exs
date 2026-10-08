defmodule Loka.ContentBleedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: a non-hound source or mismatched bandage is compiled as a real C5 producer.
  test "hound and bandage declarations keep exact effect, skill and item boundaries", %{
    dir: dir
  } do
    cases = [
      {"npcs/fen_hound.json", &put_in(&1, ["attack", "on_positive_hit", "effect"], "missing")},
      {"items/bandage_01.json", &put_in(&1, ["bandage", "skill"], "missing")},
      {"items/bandage_01.json", &put_in(&1, ["bandage", "action"], "eat")},
      {"items/bandage_01.json", &Map.put(&1, "container", true)},
      {"bleeds/bleeding.json", &put_in(&1, ["narration", "tick"], "missing.text")},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.29")}
    ]

    for {file, change} <- cases do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end
end
