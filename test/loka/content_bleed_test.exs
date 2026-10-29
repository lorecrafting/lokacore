defmodule Loka.ContentBleedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/bleed_sampler")}

  # Breaks: a non-hound source or mismatched bandage is compiled as a real C5 producer.
  test "hound and bandage declarations keep exact effect, skill and item boundaries", %{
    dir: dir
  } do
    cases = [
      {"npcs/hound.json", &put_in(&1, ["attack", "on_positive_hit", "effect"], "missing")},
      {"items/bandage.json", &put_in(&1, ["bandage", "skill"], "missing")},
      {"items/bandage.json", &put_in(&1, ["bandage", "action"], "eat")},
      {"items/bandage.json", &Map.put(&1, "container", true)},
      {"bleeds/bleeding.json", &put_in(&1, ["narration", "tick"], "missing.text")}
    ]

    for {file, change} <- cases do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end
end
