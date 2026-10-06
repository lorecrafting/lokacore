defmodule Loka.ContentBleedTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Breaks: a non-hound source or mismatched bandage is compiled as a real C5 producer.
  test "hound and bandage declarations keep exact effect, skill and item boundaries", %{
    tmp_dir: dir
  } do
    cases = [
      {"npcs/fen_hound.json", &put_in(&1, ["attack", "on_positive_hit", "effect"], "missing")},
      {"items/bandage_01.json", &put_in(&1, ["bandage", "skill"], "missing")},
      {"items/bandage_01.json", &put_in(&1, ["bandage", "action"], "eat")},
      {"items/bandage_01.json", &Map.put(&1, "container", true)},
      {"bleeds/bleeding.json", &put_in(&1, ["narration", "tick"], "missing.text")},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.29")}
    ]

    Enum.with_index(cases, fn {file, change}, n ->
      source = Path.join(dir, Integer.to_string(n))
      File.cp_r!("cartridges/ashmere_missing_child", source)
      path = Path.join(source, file)
      File.write!(path, JSON.encode!(change.(JSON.decode!(File.read!(path)))))
      assert {:error, _} = Loka.Content.compile(source), file
    end)
  end
end
