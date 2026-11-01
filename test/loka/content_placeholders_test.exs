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

  # Break: a scene ships a literal `~` the player reads, since it lowers to a text value that is
  # not exactly `~` (joined under a written line, or holding the extra space).
  for {form, lines} <- [
        joined_twice: "elder: ~\nelder: ~\n- Yes\nelder: Granted.",
        under_written: "elder: Written line one.\nelder: ~\n- Yes\nelder: Granted.",
        extra_space: "elder:  ~\n- Yes\nelder: Granted.",
        in_a_reply: "elder: Asked.\n- Yes\nelder: first\nelder: ~",
        narration: "* ~\nelder: Asked.\n- Yes\nelder: Granted.",
        reply_narration: "elder: Asked.\n- Yes\n* ~",
        second_speaker: "with: smith\nelder: Asked.\nsmith: ~\n- Yes\nelder: Granted."
      ] do
    test "a release compile refuses a scene's #{form}", %{tmp_dir: tmp} do
      dir = Loka.ContentSource.copy("cartridges/speech_sampler")
      File.mkdir_p!(Path.join(dir, "scenes"))

      File.write!(
        Path.join(dir, "scenes/still_to_write.scene"),
        "npc: elder\n#{unquote(lines)}\n"
      )

      out = Path.join(tmp, "todo.json")

      said =
        ExUnit.CaptureIO.capture_io(:stderr, fn ->
          assert catch_exit(Mix.Tasks.Loka.Compile.run([dir, out])) == {:shutdown, 1}
        end)

      assert said =~ "placeholder_text at text."
      assert said =~ "still_to_write"
      refute File.exists?(out)
    end
  end

  # Break: a cutscene paragraph ships its `~`, the check not reaching lowered scene steps.
  test "a release compile refuses a cutscene's placeholder", %{tmp_dir: tmp} do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")

    File.write!(Path.join(dir, "scenes/bell_rung.cut"), "Written.\n\n~\n---\n")

    File.write!(
      Path.join(dir, "scenes/bell_rung.json"),
      ~s({"on": {"story_point": "lantern_resolved", "outcome": "carry"}, "control": "modal"})
    )

    out = Path.join(tmp, "todo.json")

    said =
      ExUnit.CaptureIO.capture_io(:stderr, fn ->
        assert catch_exit(Mix.Tasks.Loka.Compile.run([dir, out])) == {:shutdown, 1}
      end)

    assert said =~ "placeholder_text at text.scene.bell_rung.steps.1.text"
    refute File.exists?(out)
  end

  # Break: the line rule over-reaches and refuses written prose that merely holds a `~`.
  test "a `~` inside a written scene line is not a placeholder", %{tmp_dir: tmp} do
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")
    File.mkdir_p!(Path.join(dir, "scenes"))

    File.write!(
      Path.join(dir, "scenes/still_to_write.scene"),
      "npc: elder\nelder: About ~ ten.\n- Yes\nelder: Granted.\n"
    )

    out = Path.join(tmp, "done.json")
    ExUnit.CaptureIO.capture_io(:stderr, fn -> Mix.Tasks.Loka.Compile.run([dir, out]) end)
    assert File.exists?(out)
  end
end
