defmodule Loka.ContentPlaceholdersTest do
  # Still to write (docs/system/cartridge.md): a release compile refuses a `~` placeholder.
  use ExUnit.Case, async: true

  @moduletag :tmp_dir

  # Break: a release compile ships a `~` the writer never came back to (the check reads only
  # text.json and misses lowered inline prose, or writes the artifact before refusing), or the
  # preview's --allow-placeholders no longer lets the writer run an unfinished cartridge.
  test "mix loka.compile refuses a placeholder, named, unless allowed", %{tmp_dir: tmp} do
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")

    edit = fn rel, change ->
      path = Path.join(dir, rel)
      File.write!(path, JSON.encode!(change.(JSON.decode!(File.read!(path)))))
    end

    edit.("text.json", &Map.put(&1, "dialogue.elder_ward.thank", "~"))
    edit.("areas/village.json", &put_in(&1, ["npcs", "elder", "name"], %{"prose" => "~"}))
    out = Path.join(tmp, "todo.json")

    said =
      ExUnit.CaptureIO.capture_io(:stderr, fn ->
        assert catch_exit(Mix.Tasks.Loka.Compile.run([dir, out])) == {:shutdown, 1}
      end)

    assert said =~ "placeholder_text at text.dialogue.elder_ward.thank\n"
    assert said =~ "placeholder_text at text.npc.elder.name\n"
    refute said =~ "narration.elder_ward.thank"
    refute File.exists?(out)

    ExUnit.CaptureIO.capture_io(:stderr, fn ->
      Mix.Tasks.Loka.Compile.run([dir, out, "--allow-placeholders"])
    end)

    assert JSON.decode!(File.read!(out))["cartridge"]["text"]["npc.elder.name"] == "~"
  end
end
