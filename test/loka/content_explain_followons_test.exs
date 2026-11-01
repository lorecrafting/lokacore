defmodule Loka.ContentExplainFollowOnsTest do
  # One fault, one line: a refused compile prints nothing that fixing the first fault would clear
  # (loka-vduxr.9), and nothing true goes unsaid. Fragments are hand-written.
  use ExUnit.Case, async: true

  alias Loka.Content
  alias Loka.Content.Explain

  @moduletag :tmp_dir

  @prose ~s({"prose": "~"})
  @room ~s({"description":#{@prose},"exits":{},"name":#{@prose}})
  @manifest JSON.encode!(%{
              "api_version" => "loka/v3",
              "entry" => "start",
              "id" => "c",
              "version" => "0.0.1",
              "title" => "~",
              "supported_profiles" => ["offline_private"],
              "requires" => %{
                "capabilities" => %{
                  "containment" => 1,
                  "fact" => 1,
                  "knowledge" => 1,
                  "movement" => 1,
                  "dialogue" => 1
                },
                "client_features" => [],
                "content_schema" => 1,
                "kernel_api" => %{"at_least" => "1.0", "below" => "2.0"},
                "rule_ir" => 1
              }
            })

  defp said(dir, files) do
    base = %{
      "cartridge.json" => @manifest,
      "layout.json" =>
        ~s([{"room":"boathouse","x":0,"y":0,"z":0},{"room":"start","x":1,"y":0,"z":0}]),
      "rooms/boathouse.json" => @room,
      "rooms/start.json" => @room,
      "npcs/bram.json" =>
        ~s({"description":#{@prose},"keywords":["bram"],"name":#{@prose},"room":"boathouse","room_line":#{@prose}})
    }

    for {rel, body} <- Map.merge(base, files) do
      File.mkdir_p!(Path.dirname(Path.join(dir, rel)))
      File.write!(Path.join(dir, rel), body)
    end

    {:error, diags} = Content.compile(dir)
    Content.explained(diags, dir)
  end

  defp line_at(lines, place) do
    Enum.find(lines, &String.contains?(&1, place)) ||
      flunk("nothing at #{place}:\n#{Enum.join(lines, "\n")}")
  end

  defp scene(dir, text), do: said(dir, %{"scenes/hi.scene" => text})

  # Break: its fields and text keys each print a line that a rename alone clears.
  test "a file with a bad name prints only the rename", %{tmp_dir: dir} do
    item =
      ~s({"description":#{@prose},"keywords":["x"],"location":{"in":"room","room":"start"},"name":#{@prose},"room_line":#{@prose}})

    assert [line] = said(dir, %{"items/Bad-Name.json" => item})
    assert line =~ "Rename it"
  end

  # Break: a nested prose field's own key failing still prints a line the rename clears.
  test "a nested prose field under a bad name prints nothing more", %{tmp_dir: dir} do
    d =
      &%{
        "code" => "SCHEMA_VIOLATION",
        "severity" => "error",
        "path" => &1,
        "data" => %{"error" => "pattern_mismatch"}
      }

    assert [line] =
             Explain.lines(
               [
                 d.(~s("statuses/Bad-Name.json")),
                 d.(~s("statuses/Bad-Name.json".narration.tick)),
                 d.(~s(text["status.Bad-Name.narration.tick"]))
               ],
               dir
             )

    assert line =~ "Rename it"
  end

  # Break: the rename filter also hides a fault the rename does not clear.
  test "a bad name keeps the file's other faults", %{tmp_dir: dir} do
    d =
      &%{
        "code" => "SCHEMA_VIOLATION",
        "severity" => "error",
        "path" => &1,
        "data" => %{"error" => &2}
      }

    assert [_, _, _, _] =
             Explain.lines(
               [
                 d.(~s("items/Bad-Name.json"), "pattern_mismatch"),
                 d.(~s("items/Bad-Name.json".location), "missing_property"),
                 d.(~s("items/Bad-Name.json".location.room), "pattern_mismatch"),
                 d.(~s("rooms/a.json".exits.Bad-Name.to), "pattern_mismatch")
               ],
               dir
             )
  end

  # Break: a mistyped tone makes the pool invalid, and whatever names the pool fails too.
  test "a bad tone prints only the tone", %{tmp_dir: dir} do
    band = %{"at_percent" => 0, "key" => "x", "tone" => "lockd"}
    gold = %{"bands" => [band], "gain" => 0, "maximum" => 9, "minimum" => 0, "start" => 0}
    assert [line] = pool_lines(dir, gold)
    assert line =~ "one of: normal, warning, danger"
  end

  # Break: gives under a refused choice goes unchecked until the choice is reworded.
  test "a mistyped gives under a repeated choice is said at once", %{tmp_dir: dir} do
    text = "npc: bram\nbram: hi\n- Go\n- Go\n  gives: tronel\n"
    lines = scene(dir, text)
    assert line_at(lines, "scenes/hi.scene:4") =~ "- Go"
    assert line_at(lines, "scenes/hi.scene:5") =~ "tronel"
  end

  # Break: a tone fault hides the pool's bad numbers until it is fixed.
  test "a bad tone with a start out of bounds says both", %{tmp_dir: dir} do
    band = %{"at_percent" => 0, "key" => "x", "tone" => "lockd"}
    gold = %{"bands" => [band], "gain" => 0, "maximum" => 9, "minimum" => 0, "start" => 50}
    lines = pool_lines(dir, gold)
    assert Enum.any?(lines, &(&1 =~ "one of: normal, warning, danger"))
    assert Enum.any?(lines, &(&1 =~ "resources.json" and &1 =~ "minimum <= start <= maximum"))
  end

  # Break: a tone fault lets through a pool whose other fault leaves its numbers unusable.
  test "a bad tone with a bad gain leaves the pool unusable", %{tmp_dir: dir} do
    band = %{"at_percent" => 0, "key" => "x", "tone" => "lockd"}
    gold = %{"bands" => [band], "gain" => "x", "maximum" => 9, "minimum" => 0, "start" => 0}
    assert line_at(pool_lines(dir, gold), "npcs/bram.json") =~ "minimum <= start <= maximum"
  end

  # Break: any band fault, not only its tone, is taken as leaving the pool usable.
  test "a bad percent leaves the pool unusable", %{tmp_dir: dir} do
    band = %{"at_percent" => "x", "key" => "x", "tone" => "normal"}
    gold = %{"bands" => [band], "gain" => 0, "maximum" => 9, "minimum" => 0, "start" => 0}
    assert line_at(pool_lines(dir, gold), "npcs/bram.json") =~ "minimum <= start <= maximum"
  end

  defp pool_lines(dir, gold) do
    wealthy =
      ~s({"description":#{@prose},"keywords":["bram"],"name":#{@prose},"resource_starts":{"gold":5},"room":"boathouse","room_line":#{@prose}})

    said(dir, %{
      "resources.json" => JSON.encode!(%{"resources" => %{"gold" => gold}}),
      "npcs/bram.json" => wealthy,
      "text.json" => ~s({"band.x":"Low"})
    })
  end
end
