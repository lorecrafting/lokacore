defmodule Loka.ContentBleedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/bleed_sampler")}

  # Breaks: a non-hound source or mismatched bandage is compiled as a real C5 producer, or a
  # plan missing area crashes the compiler.
  test "hound and bandage declarations keep exact effect, skill and item boundaries", %{
    dir: dir
  } do
    cases = [
      {"npcs/hound.json", &put_in(&1, ["attack", "on_positive_hit", "effect"], "missing")},
      {"items/bandage.json", &put_in(&1, ["bandage", "skill"], "missing")},
      {"items/bandage.json", &put_in(&1, ["bandage", "action"], "eat")},
      {"items/bandage.json", &Map.put(&1, "container", true)},
      {"bleeds/bleeding.json", &put_in(&1, ["narration", "tick"], "missing.text")},
      # an unexpanded (schema-refused) plan is refused, not a crash
      {"populations/hounds.json", &Map.delete(&1, "area")}
    ]

    for {file, change} <- cases do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end

  # Breaks: a bleed declaration without food@1 compiles, or is refused under another code or path.
  test "bleed without the food capability is UNDECLARED_CAPABILITY at the manifest", %{dir: dir} do
    drop = &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "food") end)
    assert {:error, ds} = Loka.ContentSource.compile(dir, [{"cartridge.json", drop}])

    got = Enum.map(ds, &{&1["code"], &1["path"], &1["data"]["capability"]})
    assert {"UNDECLARED_CAPABILITY", "cartridge.requires.capabilities", "food"} in got
  end
end
