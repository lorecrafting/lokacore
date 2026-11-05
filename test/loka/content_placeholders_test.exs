defmodule Loka.ContentPlaceholdersTest do
  # Still to write (docs/system/cartridge.md): a release compile refuses a `~` placeholder.
  # Synchronous: these tests compare whole :stderr captures, and :stderr is one device shared by
  # every test, so an async neighbour's compile error landed in them (loka-kgd.211).
  use ExUnit.Case, async: false

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

    # Each file was rewritten on one line, so both keys sit on line 1 of the file that wrote them.
    assert [_, _] = String.split(said, "\n", trim: true)
    assert said =~ ~r/^error: text\.json:1 .*`~`/m
    assert said =~ ~r/^error: areas\/village\.json:1 .*`~`/m
    refute File.exists?(out)

    ExUnit.CaptureIO.capture_io(:stderr, fn ->
      Mix.Tasks.Loka.Compile.run([dir, out, "--allow-placeholders"])
    end)

    assert JSON.decode!(File.read!(out))["cartridge"]["text"]["npc.elder.name"] == "~"
  end

  # Break: a scene ships a literal `~` the player reads, since it lowers to a text value that is
  # not exactly `~` (joined under a written line, or holding the extra space).
  # The line after `:` is where the block holding the `~` starts (`npc: elder` is line 1).
  for {form, lines, at} <- [
        {:joined_twice, "elder: ~\nelder: ~\n- Yes\nelder: Granted.", 2},
        {:under_written, "elder: Written line one.\nelder: ~\n- Yes\nelder: Granted.", 2},
        {:extra_space, "elder:  ~\n- Yes\nelder: Granted.", 2},
        {:in_a_reply, "elder: Asked.\n- Yes\nelder: first\nelder: ~", 4},
        {:narration, "* ~\nelder: Asked.\n- Yes\nelder: Granted.", 2},
        {:reply_narration, "elder: Asked.\n- Yes\n* ~", 4},
        {:nested_prompt, "elder: Asked.\n- Yes\n  elder: ~\n  - In\n    elder: Fine.", 4},
        {:nested_reply, "elder: Asked.\n- Yes\n  elder: Fine.\n  - In\n    elder: ~", 6},
        {:second_speaker, "with: smith\nelder: Asked.\nsmith: ~\n- Yes\nelder: Granted.", 3},
        {:choice, "elder: Asked.\n- ~\nelder: Granted.", 3}
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

      assert said =~ ~r/^error: scenes\/still_to_write\.scene:#{unquote(at)} .*`~`/m
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

    assert said =~ ~r/^error: scenes\/bell_rung\.cut:3 .*`~`/
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

  # Break: --json moves the printed line (the split loses a place, a column or the order), or
  # writes a file whose rel, line and path do not name the field the line names.
  test "mix loka.compile --json splits the line it prints", %{tmp_dir: tmp} do
    dir = Loka.ContentSource.copy("cartridges/hello_sampler")
    talk = Path.join(dir, "actions/talk.json")
    # The committed file ends with `"accessibility": ...` on line 15, so the field lands on 16.
    File.write!(talk, String.replace(File.read!(talk), ~r/\n}\n$/, ",\n  \"comand\": \"x\"\n}\n"))
    {out, json} = {Path.join(tmp, "a.json"), Path.join(tmp, "d.json")}

    run = fn args ->
      ExUnit.CaptureIO.capture_io(:stderr, fn ->
        assert catch_exit(Mix.Tasks.Loka.Compile.run([dir, out | args])) == {:shutdown, 1}
      end)
    end

    line = run.([])
    assert run.(["--allow-placeholders", "--json", json]) == line
    assert line =~ ~r/^error: actions\/talk\.json:16 `comand` is not a field here\./

    assert [
             %{"severity" => "error", "code" => "UNKNOWN_FIELD", "path" => "actions/talk.comand"} =
               d
           ] =
             JSON.decode!(File.read!(json))

    assert {d["rel"], d["line"], d["column"]} == {"actions/talk.json", 16, nil}
    assert line == "error: actions/talk.json:16 #{d["words"]}\n"
    refute File.exists?(out)
    assert_raise Mix.Error, ~r/usage/, fn -> Mix.Tasks.Loka.Compile.run([dir, out, "--json"]) end
  end

  # Break: --json writes a diagnostic twice that its printed line shows once, or a non-UTF-8 byte
  # in a path makes JSON.encode! raise, so the preview loses every diagnostic of that build.
  test "explained_entries are unique and encode with a non-UTF-8 path", %{tmp_dir: tmp} do
    d = %{"severity" => "error", "code" => "UNKNOWN_FIELD", "path" => <<"rooms.", 0xFF>>}
    d = Map.put(d, "data", %{"field" => "x"})
    assert [e] = Loka.Content.explained_entries([d, d], tmp)
    assert JSON.encode!(e) =~ "rooms."
  end
end
