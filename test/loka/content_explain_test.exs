defmodule Loka.ContentExplainTest do
  # What an author reads from a refused compile (loka-vduxr A1, A9). Expected fragments are
  # hand-written; wording around them may move.
  use ExUnit.Case, async: true

  alias Loka.Content
  alias Loka.Content.Explain

  @moduletag :tmp_dir

  @caps %{"containment" => 1, "fact" => 1, "knowledge" => 1, "movement" => 1, "dialogue" => 1}
  @prose ~s({"prose": "~"})
  @room """
  {
    "description": #{@prose},
    "exits": {},
    "name": #{@prose}
  }
  """

  defp manifest(caps) do
    JSON.encode!(%{
      "api_version" => "loka/v3",
      "entry" => "start",
      "id" => "c",
      "version" => "0.0.1",
      "title" => "~",
      "supported_profiles" => ["offline_private"],
      "requires" => %{
        "capabilities" => caps,
        "client_features" => [],
        "content_schema" => 1,
        "kernel_api" => %{"at_least" => "1.0", "below" => "2.0"},
        "rule_ir" => 1
      }
    })
  end

  # A two-room cartridge with bram and a trowel lying in the boathouse; `files` go over it, and
  # nil removes one. Returns the printed lines of whatever the compiler said.
  defp said(dir, files) do
    base = %{
      "cartridge.json" => manifest(@caps),
      "layout.json" =>
        ~s([{"room":"boathouse","x":0,"y":0,"z":0},{"room":"start","x":1,"y":0,"z":0}]),
      "rooms/boathouse.json" => @room,
      "rooms/start.json" => @room,
      "npcs/bram.json" =>
        ~s({"description":#{@prose},"keywords":["bram"],"name":#{@prose},"room":"boathouse","room_line":#{@prose}}),
      "items/trowel.json" =>
        ~s({"description":#{@prose},"keywords":["trowel"],"location":{"in":"room","room":"boathouse"},"name":#{@prose},"room_line":#{@prose}})
    }

    for {rel, body} <- Map.merge(base, files), body != nil do
      File.mkdir_p!(Path.dirname(Path.join(dir, rel)))
      File.write!(Path.join(dir, rel), body)
    end

    diags =
      case Content.compile(dir) do
        {:error, diags} -> diags
        {:ok, _, warnings} -> warnings
      end

    Content.explained(diags, dir)
  end

  defp line_at(lines, place) do
    Enum.find(lines, &String.contains?(&1, place)) ||
      flunk("nothing at #{place}:\n#{Enum.join(lines, "\n")}")
  end

  # Break: an unknown field keeps only its path, or points at another line, or loses the names.
  test "an unknown field in a room names its line and the valid fields", %{tmp_dir: dir} do
    room =
      "{\n  \"description\": #{@prose},\n  \"exits\": {},\n  \"nmae\": 1,\n  \"name\": #{@prose}\n}\n"

    line = dir |> said(%{"rooms/boathouse.json" => room}) |> line_at("rooms/boathouse.json:4")
    assert line =~ "`nmae`"
    assert line =~ "Did you mean `name`?"
    assert line =~ "dark_description"
  end

  # Break: a wrong type stops saying which type the field takes.
  test "a wrong type names the expected type and the line", %{tmp_dir: dir} do
    npc =
      ~s({"description":#{@prose},\n"keywords":["bram"],\n"hp":"lots",\n"name":#{@prose},"room":"boathouse","room_line":#{@prose}})

    line = dir |> said(%{"npcs/bram.json" => npc}) |> line_at("npcs/bram.json:3")
    assert line =~ "`hp` must be an object"
  end

  # Break: a missing text key reads as a generic reference with no place to add it.
  test "a deleted text key says add it to text.json or change the name", %{tmp_dir: dir} do
    room = "{\n  \"description\": #{@prose},\n  \"exits\": {},\n  \"name\": \"gone.title\"\n}\n"
    line = dir |> said(%{"rooms/boathouse.json" => room}) |> line_at("rooms/boathouse.json:4")
    assert line =~ "`gone.title`"
    assert line =~ "text.json"
    assert line =~ "change the name"
  end

  # Break: a long-form reference prints as `c@0.0.1:room/well`, not as what the author wrote.
  test "an exit to a missing room names the room by its key", %{tmp_dir: dir} do
    room =
      "{\n  \"description\": #{@prose},\n  \"exits\": {\n    \"north\": {\"to\": \"well\"}\n  },\n  \"name\": #{@prose}\n}\n"

    line = dir |> said(%{"rooms/boathouse.json" => room}) |> line_at("rooms/boathouse.json:4")
    assert line =~ "the room `well`"
    refute line =~ "room/well"
  end

  # Break: a half-written file loses its position, or the scanner crashes on it.
  test "half-written JSON gets a line and column", %{tmp_dir: dir} do
    line =
      dir
      |> said(%{"rooms/boathouse.json" => "{\n  \"exits\": {\n"})
      |> line_at("rooms/boathouse.json:3:1")

    assert line =~ "not valid JSON"
  end

  # Break: `gives:` at an item the NPC does not hold compiles with no word, and the choice stays
  # hidden in play (dialogue/shared.ts availability).
  test "gives: says the NPC must hold the item", %{tmp_dir: dir} do
    scene = "npc: bram\n\nbram: hello\n- Take it\n  bram: here\n  gives: trowel\n"
    line = dir |> said(%{"scenes/hi.scene" => scene}) |> line_at("scenes/hi.scene:6")
    assert String.starts_with?(line, "warning: ")
    assert line =~ "`bram` holds `trowel`"
  end

  # Break: giving the item to its NPC still warns, so a correct scene is never silent.
  test "gives: an item the NPC holds is silent", %{tmp_dir: dir} do
    item =
      ~s({"description":#{@prose},"keywords":["trowel"],"location":{"in":"npc","npc":"bram"},"name":#{@prose},"room_line":#{@prose}})

    scene = "npc: bram\n\nbram: hello\n- Take it\n  bram: here\n  gives: trowel\n"
    lines = said(dir, %{"items/trowel.json" => item, "scenes/hi.scene" => scene})
    refute Enum.any?(lines, &String.contains?(&1, "scenes/hi.scene"))
  end

  # Break: a `gives:` without containment locked keeps the bare capability message.
  test "gives: says the cartridge must lock item_acquired's owner", %{tmp_dir: dir} do
    caps = Map.delete(@caps, "containment")
    scene = "npc: bram\n\nbram: hello\n- Take it\n  bram: here\n  gives: trowel\n"

    line =
      dir
      |> said(%{"cartridge.json" => manifest(caps), "scenes/hi.scene" => scene})
      |> line_at("`item_acquired`")

    assert line =~ "scenes/hi.scene:6"
    assert line =~ "containment"
  end

  # Break: a bad `.scene` line drops its reason, or an unknown `when:` behind it goes unreported.
  test "each bad scene line says why, and when: still reports behind them", %{tmp_dir: dir} do
    scene =
      "npc: thera\nwhen: never_defined\n\nthera: hello\nnarrator: rain falls\nbram: hi\n- Go\n  thera: bye\n- Go\n  thera: bye\n"

    npc =
      ~s({"description":#{@prose},"keywords":["thera"],"name":#{@prose},"room":"boathouse","room_line":#{@prose}})

    lines = said(dir, %{"npcs/thera.json" => npc, "scenes/hi.scene" => scene})

    assert line_at(lines, "scenes/hi.scene:5") =~ "only `thera:` may speak here (`npc: thera`)"
    assert line_at(lines, "scenes/hi.scene:6") =~ "only `thera:` may speak here (`npc: thera`)"
    assert line_at(lines, "scenes/hi.scene:9") =~ "repeats a choice"
    when_line = line_at(lines, "scenes/hi.scene:2")
    assert when_line =~ "fact `never_defined`"
    assert when_line =~ "facts.json"
  end

  # Break: a layout behind the room list loses the one command that repairs it.
  test "a layout older than the room list says to run the generator again", %{tmp_dir: dir} do
    lines = said(dir, %{"rooms/cellar.json" => @room})
    assert line_at(lines, "layout.json") =~ "bin/loka new layout"
  end

  # Break: the JSON scanner miscounts after a nested array or an escaped quote, so a later line
  # is wrong by the array's height.
  test "a line number survives arrays and escapes before it", %{tmp_dir: dir} do
    item =
      "{\n  \"description\": {\"prose\": \"a \\\"quoted\\\"\\n{ word\"},\n  \"keywords\": [\n    \"trowel\",\n    \"spade\"\n  ],\n  \"location\": {\"in\": \"room\", \"room\": \"boathouse\"},\n  \"name\": #{@prose},\n  \"oops\": 1,\n  \"room_line\": #{@prose}\n}\n"

    assert dir |> said(%{"items/trowel.json" => item}) |> line_at("items/trowel.json:9") =~
             "`oops`"
  end

  # Break: a code joins the protocol's enum with no words, and the first author to hit it crashes
  # the compile task instead of reading an error.
  test "every diagnostic code in the protocol has words", %{tmp_dir: dir} do
    codes =
      JSON.decode!(File.read!("protocol/cartridge.schema.json"))["$defs"]["DiagnosticCode"][
        "enum"
      ]

    assert length(codes) > 30

    for code <- codes do
      [line] =
        Explain.lines(
          [%{"severity" => "error", "code" => code, "path" => "rooms/a.name", "data" => %{}}],
          dir
        )

      assert line =~ ~r/^error: rooms\/a\.name: \S+ .*\.$/, line
    end
  end

  defp scene(dir, text, extra \\ %{}),
    do: said(dir, Map.merge(%{"scenes/hi.scene" => text}, extra))

  # Break: a reference site that passes no target prints a hole where the name goes.
  test "a reference with no target prints no hole", %{tmp_dir: dir} do
    diag = %{
      "severity" => "error",
      "code" => "UNRESOLVED_REFERENCE",
      "path" => "a.b",
      "data" => %{}
    }

    assert [line] = Explain.lines([diag], dir)
    assert line =~ "names nothing"
    refute line =~ "?"
  end

  # Break: a warning at an earlier path comes first and the author panel badges a broken build "compiled".
  test "errors print before warnings", %{tmp_dir: dir} do
    diag = %{"code" => "UNKNOWN_FIELD", "path" => "a.b", "data" => %{}}
    warning = Map.put(diag, "severity", "warning")
    error = Map.put(diag, "severity", "error")

    assert ["error: " <> _, "warning: " <> _] = Explain.lines([warning, error], dir)
  end

  # Break: a non-string reference crashes the printer and every diagnostic is lost.
  test "a reference that is not a string still prints", %{tmp_dir: dir} do
    data = %{"target" => %{"a" => 1}}

    diag = %{
      "severity" => "error",
      "code" => "UNRESOLVED_REFERENCE",
      "path" => "a.b",
      "data" => data
    }

    assert [line] = Explain.lines([diag], dir)
    assert line =~ ~s({"a":1})
  end

  # Break: a `gives:` above any choice is told to rename its item, then fails again on the same line.
  test "the speaker's name in gives above a choice says move it", %{tmp_dir: dir} do
    text = "npc: bram\nbram: hi\ngives: bram\n- Take it\nbram: here\n"
    assert dir |> scene(text) |> line_at("scenes/hi.scene:3") =~ "belongs under a choice"
  end

  # Break: a mistyped `gives:` is the commonest scene typo; its role path fell back to the npc line.
  test "a mistyped gives names its own line", %{tmp_dir: dir} do
    text = "npc: bram\nbram: hi\n- Take it\nbram: here\ngives: tronel\n"
    assert dir |> scene(text) |> line_at("scenes/hi.scene:5") =~ "tronel"
  end

  # Break: a part written over several lines reports its last line, not where it starts.
  test "a multi-line part reports the line it starts on", %{tmp_dir: dir} do
    text = "npc: bram\nbram: one\nbram: two\nbram: three\n"
    assert {["prompt"], 2} in Loka.Content.SceneFiles.lines(text)
  end

  # Break: the item role overwrites the npc role, so a real npc is reported as missing.
  test "gives naming the speaker says so and keeps the npc", %{tmp_dir: dir} do
    text = "npc: bram\nbram: hi\n- Take it\nbram: here\ngives: bram\n"
    lines = scene(dir, text)
    assert line_at(lines, "scenes/hi.scene:5") =~ "named like its speaker"
    refute Enum.any?(lines, &(&1 =~ "the npc `bram`"))
  end

  # Break: a bad line is judged against the finished dialogue, so a line above `npc:` blames speech.
  test "speech above npc: says to name the speaker first", %{tmp_dir: dir} do
    text = "bram: hi\nnpc: bram\nbram: hello\n- Take it\nbram: here\n"
    assert dir |> scene(text) |> line_at("scenes/hi.scene:1") =~ "before the speaker is named"
  end

  # Break: lines under a duplicate choice fall to the prompt and earn a false `gives:` error.
  test "what follows a repeated choice stays quiet", %{tmp_dir: dir} do
    text = "npc: bram\nbram: hi\n- Take it\nbram: here\n- Take it\nbram: again\ngives: trowel\n"
    lines = scene(dir, text)
    assert line_at(lines, "scenes/hi.scene:5") =~ "repeats a choice"
    refute Enum.any?(lines, &(&1 =~ "belongs under a choice"))
  end

  # Break: one typo also prints "required" errors for parts `.scene` syntax never names.
  test "a refused line earns no missing-part errors", %{tmp_dir: dir} do
    text = "npc: bram\nbrm: hi\n- Take it\nbram: here\n"
    lines = scene(dir, text)
    assert line_at(lines, "scenes/hi.scene:2") =~ "only `bram:`"
    refute Enum.any?(lines, &(&1 =~ "is required"))
  end

  # Break: a field of the JSON half is blamed on the scene, which does not contain it.
  test "an error in a scene's JSON half names the JSON file", %{tmp_dir: dir} do
    text = "npc: bram\nbram: hi\n- Take it\nbram: here\n"
    lines = scene(dir, text, %{"dialogues/hi.json" => ~s({\n  "oops": 1\n}\n)})
    assert line_at(lines, "dialogues/hi.json:2") =~ "`oops`"
  end

  # Break: every layout violation tells the author to regenerate a hand-placed file.
  test "a layout of the wrong type is not told to regenerate", %{tmp_dir: dir} do
    assert dir |> said(%{"layout.json" => "{}"}) |> line_at("layout.json:1") =~
             "This file must be an array"
  end

  # Break: the printed name is cut at a dot or loses its array.
  test "a field is named whole", %{tmp_dir: dir} do
    for {path, name} <- [
          {~s(text["a.b"]), "`a.b`"},
          {"keywords[0]", "`keywords[0]`"},
          {~s(text["x"][0]), "`[0]`"}
        ] do
      diag = %{"severity" => "error", "code" => "SCHEMA_VIOLATION", "path" => path}

      assert [line] = Explain.lines([Map.put(diag, "data", %{"error" => "not_in_enum"})], dir)
      assert line =~ name
    end
  end

  # Break: a stray file is called a bad field, though it holds no field to fix.
  test "a file in an unknown folder is called a file", %{tmp_dir: dir} do
    assert dir |> said(%{"notes/todo.json" => "{}"}) |> line_at("notes/todo.json:1") =~
             "no folder"
  end

  # Break: a file gone since the compile crashes the task, and every diagnostic is lost.
  test "a source file that cannot be read loses only its line", %{tmp_dir: dir} do
    File.write!(Path.join(dir, "a.json"), "{}")
    File.chmod!(Path.join(dir, "a.json"), 0)
    diag = %{"severity" => "error", "code" => "UNKNOWN_FIELD", "path" => "a.x", "data" => %{}}

    assert [line] = Explain.lines([diag], dir)
    assert line =~ "`x`"
    File.chmod!(Path.join(dir, "a.json"), 0o644)
  end
end
