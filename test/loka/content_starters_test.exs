defmodule Loka.ContentStartersTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  alias Loka.Content.Starters

  @schema_kinds "schemas/source/*.schema.json"
                |> Path.wildcard()
                |> Enum.map(&Path.basename(&1, ".schema.json"))
                |> List.delete("defs")
  @guide File.read!("docs/guides/writing-the-game.md")

  # Breaks: a source kind the owner cannot start from the tools, or one the guide's coverage
  # table leaves out (a new schema file lands without either).
  test "every source schema kind has a starter and a coverage row" do
    assert @schema_kinds -- Starters.kinds() == []
    for kind <- @schema_kinds, do: assert(@guide =~ "\n| `#{kind}` |", "no coverage row: #{kind}")
  end

  # Breaks: a starter missing a field or capability the compiler requires, or two starters
  # sharing a key (the service's entitlement once took the action's fact, which made it reserved).
  test "a new cartridge with one starter of every kind compiles", %{tmp_dir: tmp} do
    dir = Path.join(tmp, "mine")
    assert {:ok, _} = Starters.write(dir, "cartridge", dir)
    first = ~w(items npcs resources facts quests)
    rest = (Starters.kinds() -- first) -- ~w(cartridge layout)

    for kind <- first ++ rest ++ ["layout"],
        do: assert({:ok, _} = Starters.write(dir, kind, "my_#{kind}"), kind)

    assert {:ok, _, warnings} = Loka.Content.compile(dir)
    # placeholder prose names no keyword; the writer's words will
    assert Enum.map(warnings, & &1["code"]) |> Enum.uniq() == ["TOUCH_LINK_MISSING"]
  end

  # Breaks: a dependent starter writing a dangling reference, a bad key or an unknown kind
  # reaching the file system instead of one line naming the fix.
  test "a starter refuses a missing prerequisite, a bad name and an unknown kind", %{tmp_dir: tmp} do
    assert {:error, "a name is lowercase" <> _} = Starters.write(tmp, "cartridge", tmp)
    dir = Path.join(tmp, "mine")
    assert {:ok, _} = Starters.write(dir, "cartridge", dir)

    assert Starters.write(dir, "quests", "q") ==
             {:error, "no items yet: bin/loka new items <name> first"}

    assert {:error, "a name is lowercase" <> _} = Starters.write(dir, "items", "Bad-Name")

    assert {:error, "unknown kind \"shop\"; one of: actions" <> _} =
             Starters.write(dir, "shop", "x")

    assert {:error, _} = Starters.write(dir, "cartridge", dir)
    assert Path.wildcard(Path.join(dir, "**/*.json")) |> length() == 2
    assert {:error, "no cartridge.json in " <> _} = Starters.write(tmp, "rooms", "r")
    assert {:ok, _} = Starters.write(dir, "text", "a.b")
  end

  # Breaks: a second service on the same npc replacing its first (list merge as replace); the
  # layout starter flattening a hand-placed room back to x = its index.
  test "a starter keeps what the author placed before it", %{tmp_dir: tmp} do
    dir = Path.join(tmp, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    for k <- ~w(npcs resources services), do: {:ok, _} = Starters.write(dir, k, "my_#{k}")
    {:ok, _} = Starters.write(dir, "services", "other")
    assert read(dir, "npcs/my_npcs.json")["services"] == ["my_services", "other"]
    {:ok, _} = Starters.write(dir, "layout", "layout")
    edit(dir, "layout.json", fn _ -> [%{"room" => "start", "x" => 5, "y" => 2, "z" => 0}] end)
    {:ok, _} = Starters.write(dir, "rooms", "yard")
    {:ok, _} = Starters.write(dir, "layout", "x")
    rows = read(dir, "layout.json")

    assert Enum.find(rows, &(&1["room"] == "start")) == %{
             "room" => "start",
             "x" => 5,
             "y" => 2,
             "z" => 0
           }

    assert Enum.find(rows, &(&1["room"] == "yard"))["x"] == 6
  end

  # Break: rerunning `bin/loka new` resets hand-written prose to `~` at exit 0.
  test "a rerun refuses over written prose and is a no-op over an untouched starter", %{
    tmp_dir: tmp
  } do
    dir = Path.join(tmp, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    {:ok, _} = Starters.write(dir, "text", "hello")
    {:ok, _} = Starters.write(dir, "rooms", "yard")
    untouched = File.read!(Path.join(dir, "rooms/yard.json"))
    assert {:ok, _} = Starters.write(dir, "rooms", "yard")
    assert File.read!(Path.join(dir, "rooms/yard.json")) == untouched

    edit(dir, "text.json", &Map.put(&1, "hello", "Handwritten"))
    edit(dir, "rooms/yard.json", &Map.put(&1, "description", %{"prose" => "Handwritten"}))
    assert {:error, "text.json: hello already has" <> _} = Starters.write(dir, "text", "hello")
    assert {:error, "rooms/yard.json: description" <> _} = Starters.write(dir, "rooms", "yard")
    assert read(dir, "text.json")["hello"] == "Handwritten"
    assert read(dir, "rooms/yard.json")["description"] == %{"prose" => "Handwritten"}
  end

  # Break: a rerun passes the list pair and replaces written steps with `~`, at exit 0.
  test "a rerun refuses over a written list of steps, writing nothing", %{tmp_dir: tmp} do
    dir = Path.join(tmp, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    {:ok, _} = Starters.write(dir, "items", "lamp")
    {:ok, _} = Starters.write(dir, "quests", "errand")
    written = [%{"type" => "narrate", "text" => "Handwritten"}]

    for {kind, rel} <- [{"reactions", "reactions/mine.json"}, {"scenes", "scenes/mine.json"}] do
      {:ok, _} = Starters.write(dir, kind, "mine")
      edit(dir, rel, &Map.put(&1, "steps", written))
      assert {:error, ^rel <> ": steps already has" <> _} = Starters.write(dir, kind, "mine")
      assert read(dir, rel)["steps"] == written
    end
  end

  # Break: a population replaces home's east exit, leaving a written room unreachable; a second
  # population resets the written combat lines and breaks the compile. A refusal writes no file.
  test "a population refuses a taken east exit and a second population, writing nothing", %{
    tmp_dir: tmp
  } do
    dir = Path.join(tmp, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    [home] = Path.wildcard(Path.join(dir, "rooms/*.json"))
    room = "rooms/" <> Path.basename(home)
    written = File.read!(home)
    edit(dir, room, &put_in(&1, ["exits"], %{"east" => %{"to" => "well"}}))
    before = snapshot(dir)
    assert {:error, message} = Starters.write(dir, "populations", "wolves")
    assert message =~ "#{room}: exits east"
    assert snapshot(dir) == before

    File.write!(home, written)
    {:ok, _} = Starters.write(dir, "populations", "wolves")
    edit(dir, "text.json", &Map.put(&1, "combat.player_hits", "Handwritten"))
    before = snapshot(dir)
    assert {:error, _} = Starters.write(dir, "populations", "bears")
    assert snapshot(dir) == before
  end

  # Break: a broken file a starter reads prints a stack trace instead of one line, and leaves the
  # files it wrote before reaching the broken one.
  test "a broken file refuses in one line, writing nothing", %{tmp_dir: tmp} do
    dir = Path.join(tmp, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    File.write!(Path.join(dir, "text.json"), "{")
    before = snapshot(dir)
    assert {:error, message} = Starters.write(dir, "text", "hello")
    assert message =~ "text.json is not valid JSON"
    assert snapshot(dir) == before
  end

  # Breaks: look refused for a missing capability, an exit written one way, an NPC in the
  # alphabetically first room. Literal answers from the real headless client.
  test "a fresh cartridge, a joined room and an NPC play headless", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "rooms", "grove", {"start", "east"})
    {:ok, _} = Starters.write(dir, "npcs", "thera")
    assert read(dir, "npcs/thera.json")["room"] == "start"
    assert {:ok, bytes, _} = Loka.Content.compile(dir)
    art = Path.join(tmp, "art.json")
    script = Path.join(tmp, "script")
    File.write!(art, bytes)
    File.write!(script, "look\nlook thera\neast\nlook thera\nwest\nlook thera\n")
    {out, 0} = System.cmd("node", ["kernel/ts/play/main.ts", art, script], stderr_to_stdout: true)
    played = out |> String.split("\n") |> Enum.reject(&(&1 =~ ~r/^(hp |\[|transcript:)/))

    assert played == [
             # opening: name, description, the NPC's room line
             "~",
             "~",
             "~",
             "Exits: east",
             "> look",
             "~",
             "~",
             "~",
             "Exits: east",
             "> look thera",
             "~",
             "> east",
             "You arrive from the west.",
             "~",
             "~",
             "Exits: west",
             "> look thera",
             "You don't see that here.",
             "> west",
             "You arrive from the east.",
             # a revisited room drops its description
             "~",
             "~",
             "Exits: east",
             "> look thera",
             "~",
             ""
           ]
  end

  # Breaks: the compile's DUPLICATE_DEFINITION on a shared scene quest or topic fact, or the
  # layout missing the new room of a second rooms, areas or transports.
  test "a second starter of a kind under a new name compiles", %{tmp_dir: tmp} do
    for kind <- ~w(scenes topics rooms areas transports) do
      dir = cartridge(Path.join(tmp, kind))
      for k <- ~w(items npcs resources layout), do: {:ok, _} = Starters.write(dir, k, "my_#{k}")
      {:ok, _} = Starters.write(dir, kind, "one")
      {:ok, _} = Starters.write(dir, kind, "two")
      assert {:ok, _, _} = Loka.Content.compile(dir), kind
    end
  end

  # Breaks: a rerun reformatting a file it does not change (a watcher reloads, the diff is noise),
  # or a template that is not idempotent.
  test "a rerun of every kind changes no file", %{tmp_dir: tmp} do
    dir = cartridge(tmp)

    order =
      ~w(items npcs resources facts quests) ++
        (Starters.kinds() -- ~w(cartridge items npcs resources facts quests layout)) ++ ["layout"]

    for kind <- order, do: {:ok, _} = Starters.write(dir, kind, "my_#{kind}")
    {:ok, _} = Starters.write(dir, "rooms", "yard", {"start", "up"})
    edit(dir, "cartridge.json", & &1)
    before = snapshot(dir)
    for kind <- order, do: assert({:ok, []} = Starters.write(dir, kind, "my_#{kind}"), kind)
    assert {:ok, []} = Starters.write(dir, "rooms", "yard", {"start", "up"})
    assert snapshot(dir) == before
  end

  # Breaks: a starter reporting success on a cartridge the compile then refuses (a duplicate room,
  # a derived key or text path over its limit), or a stack trace from a bad layout.
  test "a room in another file, a long name and a bad layout are refused", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    assert {:error, "a room start" <> _} = Starters.write(dir, "areas", "start")
    {:ok, _} = Starters.write(dir, "areas", "marsh")
    assert {:error, "a room marsh" <> _} = Starters.write(dir, "rooms", "marsh")
    assert {:ok, []} = Starters.write(dir, "areas", "marsh")

    for kind <- ~w(items npcs resources facts quests),
        do: {:ok, _} = Starters.write(dir, kind, "x")

    assert {:error, "a name is lowercase letters, digits and _, 64 at most" <> _} =
             Starters.write(dir, "text", String.duplicate("a", 65))

    for kind <- ~w(scenes topics actions services transports populations rooms items) do
      assert {:error, "a name" <> _} =
               Starters.write(dir, kind, String.pad_trailing(kind, 33, "b"))

      assert {:ok, _} = Starters.write(dir, kind, String.pad_trailing(kind, 32, "b"))
    end

    assert {:ok, _, _} = Loka.Content.compile(dir)

    File.write!(Path.join(dir, "layout.json"), ~s([{"room":"start","y":0,"z":0}]))
    assert {:error, "layout.json: every" <> _} = Starters.write(dir, "text", "hello")
  end

  # Breaks: layout demanding a plain room file when every room is in a bundle.
  test "layout takes a cartridge whose rooms are all bundled", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "areas", "marsh")
    edit(dir, "cartridge.json", &Map.put(&1, "entry", "marsh"))
    File.rm!(Path.join(dir, "rooms/start.json"))
    assert {:ok, _} = Starters.write(dir, "layout", "x")
    assert ["marsh"] == for(r <- read(dir, "layout.json"), do: r["room"])
  end

  # Breaks: --from replacing a written exit, or joining a room that is not there, not a file, or
  # by a word that is no direction, with a dangling or one-way exit as the result.
  test "--from writes the opposite exit and refuses a bad join, writing nothing", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "rooms", "loft", {"start", "up"})
    assert read(dir, "rooms/start.json")["exits"] == %{"up" => %{"to" => "loft"}}
    assert read(dir, "rooms/loft.json")["exits"] == %{"down" => %{"to" => "start"}}
    {:ok, _} = Starters.write(dir, "areas", "marsh")
    before = snapshot(dir)

    assert {:error, "rooms/start.json: exits up to already has" <> _} =
             Starters.write(dir, "rooms", "attic", {"start", "up"})

    assert Starters.write(dir, "rooms", "x", {"start", "sideways"}) ==
             {:error,
              "--from: a direction is north, south, east, west, up or down (got sideways)"}

    assert Starters.write(dir, "rooms", "start", {"start", "east"}) ==
             {:error, "--from: a room cannot join itself"}

    assert Starters.write(dir, "rooms", "x", {"nowhere", "east"}) ==
             {:error, "--from: no rooms/nowhere.json"}

    assert Starters.write(dir, "rooms", "x", {"marsh", "east"}) ==
             {:error, "--from: no rooms/marsh.json"}

    outside = Path.join(tmp, "victim.json")
    File.write!(outside, "{}")

    assert {:error, "--from: a room is lowercase" <> _} =
             Starters.write(dir, "rooms", "x", {"../../victim", "east"})

    assert File.read!(outside) == "{}"
    assert snapshot(dir) == before
  end

  # Breaks: a hand-placed row flattened by the automatic rows, a layout.json appearing in a
  # cartridge that chose none, a bundled room's row missed.
  test "any starter adds only the rows an existing layout lacks", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "rooms", "yard")
    refute File.exists?(Path.join(dir, "layout.json"))
    {:ok, _} = Starters.write(dir, "layout", "layout")
    edit(dir, "layout.json", fn _ -> [%{"room" => "start", "x" => 5, "y" => 2, "z" => 0}] end)
    {:ok, _} = Starters.write(dir, "text", "hello")

    assert read(dir, "layout.json") == [
             %{"room" => "start", "x" => 5, "y" => 2, "z" => 0},
             %{"room" => "yard", "x" => 6, "y" => 0, "z" => 0}
           ]

    {:ok, _} = Starters.write(dir, "areas", "marsh")

    assert List.last(read(dir, "layout.json")) == %{
             "room" => "marsh",
             "x" => 7,
             "y" => 0,
             "z" => 0
           }

    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Breaks: the alphabetically first room winning over the entry, or a template writing a partial
  # rooms/<entry>.json beside the entry's bundle.
  test "a room reference takes the entry, in a file or a bundle", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "rooms", "grove")
    {:ok, _} = Starters.write(dir, "items", "lamp")
    assert read(dir, "items/lamp.json")["location"]["room"] == "start"
    {:ok, _} = Starters.write(dir, "populations", "wolves")
    assert read(dir, "populations/wolves.json")["home"] == "start"

    {:ok, _} = Starters.write(dir, "areas", "marsh")
    edit(dir, "cartridge.json", &Map.put(&1, "entry", "marsh"))
    {:ok, _} = Starters.write(dir, "npcs", "thera")
    assert read(dir, "npcs/thera.json")["room"] == "marsh"
    {:ok, _} = Starters.write(dir, "items", "rope")
    assert read(dir, "items/rope.json")["location"]["room"] == "marsh"
    {:ok, _} = Starters.write(dir, "actions", "pull")
    refute File.exists?(Path.join(dir, "rooms/marsh.json"))
    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Breaks: a room reference demanding a plain room file when the only room is the bundled entry.
  test "items and npcs land in a bundled entry with no plain room", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "areas", "marsh")
    edit(dir, "cartridge.json", &Map.put(&1, "entry", "marsh"))
    File.rm!(Path.join(dir, "rooms/start.json"))
    {:ok, _} = Starters.write(dir, "items", "rope")
    {:ok, _} = Starters.write(dir, "npcs", "thera")
    assert read(dir, "items/rope.json")["location"]["room"] == "marsh"
    assert read(dir, "npcs/thera.json")["room"] == "marsh"
    {:ok, _} = Starters.write(dir, "replenish", "more")
    assert read(dir, "replenish/more.json")["to"]["room"] == "marsh"
  end

  # Breaks: the second pair lost, --from read as a pair, a relative path resolved against the
  # repo instead of the caller, no next step, or a refused pair leaving the ones before it written.
  test "the task takes several pairs and ends with the next step", %{tmp_dir: tmp} do
    out =
      ExUnit.CaptureIO.capture_io(fn ->
        Mix.Tasks.Loka.New.run(
          ~w(--cwd #{tmp} cartridge mine rooms yard --from start east npcs thera)
        )
      end)

    dir = Path.join(tmp, "mine")
    assert read(dir, "rooms/yard.json")["exits"] == %{"west" => %{"to" => "start"}}
    assert read(dir, "npcs/thera.json")["room"] == "start"
    assert out =~ Path.join(dir, "npcs/thera.json") <> "\n"

    assert out =~ "Still to write:\n"
    assert out =~ "\nnpcs/thera.json (0 words written)\n  description\n  name\n  room_line\n"

    assert String.ends_with?(
             out,
             "Fill the ~ lines (bin/loka todo #{dir}), then run: bin/loka dev #{dir} --watch\n"
           )

    assert_raise Mix.Error,
                 "mix loka.new: unknown kind \"shop\"; one of: " <>
                   Enum.join(Starters.kinds(), " "),
                 fn ->
                   ExUnit.CaptureIO.capture_io(fn ->
                     Mix.Tasks.Loka.New.run(~w(--cwd #{tmp} items lamp shop x mine))
                   end)
                 end

    refute File.exists?(Path.join(dir, "items/lamp.json"))

    assert_raise Mix.Error, "mix loka.new: --from: no rooms/nowhere.json", fn ->
      ExUnit.CaptureIO.capture_io(fn ->
        Mix.Tasks.Loka.New.run(~w(--cwd #{tmp} items lamp rooms x --from nowhere east mine))
      end)
    end

    refute File.exists?(Path.join(dir, "items/lamp.json"))

    # A new cartridge made earlier in the same call goes too.
    assert_raise Mix.Error, ~r/no rooms\/nowhere/, fn ->
      ExUnit.CaptureIO.capture_io(fn ->
        Mix.Tasks.Loka.New.run(~w(--cwd #{tmp} cartridge fresh rooms x --from nowhere east))
      end)
    end

    refute File.exists?(Path.join(tmp, "fresh"))

    for args <- [
          [],
          ~w(npcs thera --from start east),
          ~w(rooms y --from start),
          ~w(cartridge a rooms y elsewhere)
        ] do
      assert_raise Mix.Error, ~r/^usage: mix loka.new/, fn -> Mix.Tasks.Loka.New.run(args) end
    end
  end

  # Break: a refused call deletes what it did not write (a scene saved in the editor meanwhile)
  # or leaves the directory it made, or loses the old bytes of a file it merged into.
  test "undo removes only what the run wrote", %{tmp_dir: tmp} do
    made = Path.join(tmp, "newdir")
    File.mkdir_p!(made)
    File.write!(Path.join(made, "mine.json"), "new")
    File.write!(Path.join(made, "bystander.scene"), "saved by the writer")
    File.write!(Path.join(tmp, "old.json"), "merged")
    File.mkdir_p!(Path.join(tmp, "gone/deeper"))
    File.write!(Path.join(tmp, "gone/deeper/f.json"), "x")

    Mix.Tasks.Loka.New.undo([
      {Path.join(tmp, "old.json"), "before", []},
      {Path.join(made, "mine.json"), nil, [made]},
      {Path.join(tmp, "gone/deeper/f.json"), nil,
       [Path.join(tmp, "gone/deeper"), Path.join(tmp, "gone")]}
    ])

    assert File.read!(Path.join(tmp, "old.json")) == "before"
    assert File.read!(Path.join(made, "bystander.scene")) == "saved by the writer"
    refute File.exists?(Path.join(made, "mine.json"))
    refute File.exists?(Path.join(tmp, "gone"))
  end

  defp cartridge(parent) do
    dir = Path.join(parent, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    dir
  end

  defp edit(dir, rel, change) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(change.(JSON.decode!(File.read!(path)))))
  end

  defp snapshot(dir),
    do: for(p <- Path.wildcard(Path.join(dir, "**/*.json")), into: %{}, do: {p, File.read!(p)})

  defp read(dir, rel), do: dir |> Path.join(rel) |> File.read!() |> JSON.decode!()
end
