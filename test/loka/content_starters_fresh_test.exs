defmodule Loka.ContentStartersFreshTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  alias Loka.Content.Starters
  alias Loka.Content.Starters.Scene

  # Breaks: a kind that reports ok and then fails the compile on a cartridge holding only what its
  # refusals asked for (bleeds once lacked combat, food and skill, statuses death: the
  # all-kinds cartridge hid both because other starters declared them).
  test "each kind on a fresh cartridge compiles once its refusals are followed", %{tmp_dir: tmp} do
    for kind <- Starters.kinds() -- ["cartridge"] do
      dir = cartridge(Path.join(tmp, kind))
      follow(dir, kind, "my_#{kind}")
      assert {:ok, _, _} = Loka.Content.compile(dir), kind
    end
  end

  # Breaks: a transport whose name ends in _back pointing its route at a detail that does not exist.
  test "a transport named like a return leg compiles", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "transports", "boat_back")
    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Breaks: a rerun at exit 0 restoring a step or a key the author removed from the file it names
  # (a cutscene's file included).
  test "a rerun leaves the removals in its own file alone", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "cutscene", "s")
    edit(dir, "scenes/s.json", &Map.update!(&1, "steps", fn steps -> Enum.drop(steps, -1) end))
    before = snapshot(dir)
    assert {:error, "scenes/s.json: steps already" <> _} = Starters.write(dir, "cutscene", "s")
    assert snapshot(dir) == before

    # A cutscene's own file is scenes/<name>.json, not under its kind's name.
    follow(dir, "cutscene", "t")
    edit(dir, "scenes/t.json", &Map.delete(&1, "control"))
    assert {:ok, []} = Starters.write(dir, "cutscene", "t")
    refute is_map_key(read(dir, "scenes/t.json"), "control")

    follow(dir, "statuses", "ill")
    edit(dir, "statuses/ill.json", &Map.delete(&1, "name"))
    assert {:ok, []} = Starters.write(dir, "statuses", "ill")
    refute is_map_key(read(dir, "statuses/ill.json"), "name")
  end

  # Breaks: a population, which takes no --from, told to use another --from direction.
  test "a starter refused by a taken exit says what to do", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "rooms", "yard", {"start", "east"})

    assert {:error, "rooms/start.json: exits east to already" <> message} =
             Starters.write(dir, "populations", "wolves")

    assert message =~ "move it in both rooms' files and rerun"
    refute message =~ "--from"

    assert {:error, "rooms/start.json: exits east to already" <> message} =
             Starters.write(dir, "rooms", "barn", {"start", "east"})

    assert message =~ "use another --from direction"
  end

  # Breaks: the author's shared line refusing every later transport, or a stand-in overwriting it.
  test "a second transport keeps the filled shared line", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "transports", "ferry")
    edit(dir, "text.json", &Map.put(&1, "transport.unaffordable", "Mine."))

    assert {:ok, _} = Starters.write(dir, "transports", "barge")

    assert read(dir, "text.json")["transport.unaffordable"] == "Mine."
    assert File.exists?(Path.join(dir, "transports/barge.json"))
  end

  # Break: a kind's later checks crash on a definition its bad name left invalid (bleeds did).
  test "a bad file name never crashes the compile", %{tmp_dir: tmp} do
    for kind <- Starters.kinds() -- ["cartridge"] do
      dir = cartridge(Path.join(tmp, kind))
      follow(dir, kind, "good")
      from = Path.join([dir, kind, "good.json"])
      if File.exists?(from), do: File.rename!(from, Path.join([dir, kind, "Bad-Name.json"]))
      assert {_, _} = {kind, Loka.Content.compile(dir)}
    end
  end

  # Break: a rerun over a filled value refuses and leaves the author nothing to do.
  test "following a rerun's refusal leaves a cartridge that compiles", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "transports", "ferry")
    start = read(dir, "cartridge.json")["entry"]
    room = "rooms/#{start}.json"

    edit(dir, room, &put_in(&1, ["details", "ferry", "description", "prose"], "Mine."))
    assert {:error, message} = Starters.write(dir, "transports", "ferry")
    assert message =~ "set it to ~"
    edit(dir, room, &put_in(&1, ["details", "ferry", "description", "prose"], "~"))
    assert {:ok, _} = Starters.write(dir, "transports", "ferry")
    assert {:ok, _, _} = Loka.Content.compile(dir)

    # A value that is not words, outside the starter's own file: deleting it brings it back.
    caps = ["requires", "capabilities", "transport"]
    edit(dir, "cartridge.json", &put_in(&1, caps, 9))
    assert {:error, message} = Starters.write(dir, "transports", "ferry")
    assert message =~ "delete any other value"
    edit(dir, "cartridge.json", &(pop_in(&1, caps) |> elem(1)))
    assert {:ok, _} = Starters.write(dir, "transports", "ferry")
    assert {:ok, _, _} = Loka.Content.compile(dir)

    # The same in its own file comes back from nothing, so the words say to keep it.
    follow(dir, "actions", "pull")
    edit(dir, "actions/pull.json", &Map.put(&1, "priority", 9))
    assert {:error, message} = Starters.write(dir, "actions", "pull")
    assert message =~ "keep any other value and skip this rerun"
    refute message =~ "delete"
    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Break: the delete advice on the death setup: followed, a second population fails the compile.
  test "a second population is told to keep the death setup", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "populations", "wolves")
    assert {:error, message} = Starters.write(dir, "populations", "bears")
    assert message =~ "world death npc_corpse"
    assert message =~ "one death setup: keep it"
    refute message =~ "delete"
    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Break: a text.json that is not an object crashes the starter instead of refusing.
  test "a text.json that is a list still refuses", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "transports", "ferry")
    File.write!(Path.join(dir, "text.json"), "[]")

    assert {:error, "text.json: already has a value" <> _} =
             Starters.write(dir, "transports", "barge")
  end

  # Breaks: a room joined --from placed off its direction on the map, or onto a taken cell.
  test "a room joined --from takes its row in that direction", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "layout", "layout")

    edit(dir, "layout.json", fn [row] -> [%{row | "x" => 5, "y" => 5, "z" => 5}] end)

    for {way, cell} <- [
          {"north", {5, 4, 5}},
          {"south", {5, 6, 5}},
          {"east", {6, 5, 5}},
          {"west", {4, 5, 5}},
          {"up", {5, 5, 6}},
          {"down", {5, 5, 4}}
        ] do
      {:ok, _} = Starters.write(dir, "rooms", "r_#{way}", {"start", way})
      assert row_at(dir, "r_#{way}") == cell, way
    end

    {:ok, _} = Starters.write(dir, "rooms", "corner", {"r_north", "east"})
    assert row_at(dir, "corner") == {6, 4, 5}
    {:ok, _} = Starters.write(dir, "rooms", "taken", {"r_east", "north"})
    assert row_at(dir, "taken") == {7, 0, 0}
  end

  # Breaks: `new layout` dropping or refusing over a row whose room is gone, instead of keeping it
  # for the compile's own message.
  test "layout keeps a stale row for the compiler to name", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    {:ok, _} = Starters.write(dir, "rooms", "yard", {"start", "east"})
    {:ok, _} = Starters.write(dir, "layout", "layout")
    File.rm!(Path.join(dir, "rooms/yard.json"))
    assert {:ok, []} = Starters.write(dir, "layout", "layout")
    assert row_at(dir, "yard") == {1, 0, 0}
  end

  # Breaks: --from or a starter needing a room seeing only rooms/ (refused, or a second root copy
  # of an area folder's room), a rerun adding back what the author cut there, or the map's room
  # list crashing on an area folder's room file or missing a new area bundle's room.
  test "--from and the first room find rooms in any area folder", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    File.mkdir_p!(Path.join(dir, "areas/a/rooms"))
    File.mkdir_p!(Path.join(dir, "areas/b/rooms"))
    File.rename!(Path.join(dir, "rooms/start.json"), Path.join(dir, "areas/a/rooms/start.json"))
    File.cp!(Path.join(dir, "areas/a/rooms/start.json"), Path.join(dir, "areas/b/rooms/far.json"))
    {:ok, _} = Starters.write(dir, "layout", "layout")

    assert {:ok, _} = Starters.write(dir, "rooms", "yard", {"far", "east"})
    assert read(dir, "areas/b/rooms/far.json")["exits"]["east"]["to"] == "yard"
    assert {:ok, _} = Starters.write(dir, "actions", "poke")
    assert Map.has_key?(read(dir, "areas/a/rooms/start.json")["details"], "poke")
    # A new area bundle's room joins the map.
    assert {:ok, _} = Starters.write(dir, "areas", "moor")
    assert Enum.any?(read(dir, "layout.json"), &(&1["room"] == "moor"))
    # A room made --from an area room joins that room's area folder.
    assert Path.wildcard(Path.join(dir, "rooms/*.json")) == []
    assert File.exists?(Path.join(dir, "areas/b/rooms/yard.json"))
    assert {:ok, _, _} = Loka.Content.compile(dir)
    # A rerun on an area folder's room is that file's rerun: no root copy, and what the author cut
    # stays cut.
    edit(dir, "areas/b/rooms/far.json", &Map.delete(&1, "description"))
    assert {:ok, []} = Starters.write(dir, "rooms", "far")
    refute Map.has_key?(read(dir, "areas/b/rooms/far.json"), "description")
    assert Path.wildcard(Path.join(dir, "rooms/*.json")) == []
  end

  # Breaks: a stack trace from an areas file whose top level is not an object.
  test "an area that is not an object is a plain refusal", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    File.mkdir_p!(Path.join(dir, "areas"))
    File.write!(Path.join(dir, "areas/bad.json"), "[]")
    assert {:error, message} = Starters.write(dir, "rooms", "yard")
    assert message =~ "areas/bad.json needs a rooms object"
  end

  # Breaks: --from refusing an authored room over the starter's derived-key cap, or a bad one with
  # a message that does not name the flag.
  test "--from takes any authored room and names itself when refusing", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    long = String.duplicate("a", 64)
    File.write!(Path.join(dir, "rooms/#{long}.json"), JSON.encode!(%{"exits" => %{}}))
    assert {:ok, _} = Starters.write(dir, "rooms", "yard", {long, "east"})

    assert {:error, "--from: a room is lowercase" <> _} =
             Starters.write(dir, "rooms", "lane", {long <> "a", "east"})
  end

  # Breaks: a scene starter whose file fails the dev compile, passes a release build with its `~`,
  # writes for a missing NPC or over a file (an area folder's too), misses a bundled or area folder
  # NPC, or survives a failed run.
  test "a scene starter compiles in dev, refuses in release and never overwrites", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "npcs", "maud")

    said =
      ExUnit.CaptureIO.capture_io(fn ->
        Mix.Tasks.Loka.New.run(~w(--cwd #{tmp} scene maud greet mine))
      end)

    assert said =~ "scenes/greet.scene"
    assert {:ok, _, _} = Loka.Content.compile(dir)

    out = Path.join(tmp, "out.json")

    said =
      ExUnit.CaptureIO.capture_io(:stderr, fn ->
        assert catch_exit(Mix.Tasks.Loka.Compile.run([dir, out])) == {:shutdown, 1}
      end)

    # The starter's `~` lines 3-5, each a whole line (stderr is shared by async tests).
    held =
      " Words here are still `~`, a place held for them. Write the words, or compile with " <>
        "`--allow-placeholders` while the cartridge is unfinished."

    assert for(n <- 3..5, do: "error: scenes/greet.scene:#{n}" <> held) --
             String.split(said, "\n") ==
             []

    refute File.exists?(out)

    before = File.read!(Path.join(dir, "scenes/greet.scene"))

    assert {:error, "scenes/greet.scene exists: a starter never replaces it"} =
             Loka.Content.new(dir, "scene", "greet", "maud")

    assert {:error, "a name is lowercase" <> _} = Scene.write(dir, "../up", "maud")
    refute File.exists?(Path.join(dir, "up.scene"))

    assert File.read!(Path.join(dir, "scenes/greet.scene")) == before

    assert {:error, "no NPC nobody: bin/loka new npcs nobody first"} =
             Scene.write(dir, "hello", "nobody")

    refute File.exists?(Path.join(dir, "scenes/hello.scene"))

    # A .scene merges with its dialogues/ JSON half, so that file holds the key too.
    File.mkdir_p!(Path.join(dir, "dialogues"))
    File.write!(Path.join(dir, "dialogues/hi.json"), "{}")
    assert {:error, "dialogues/hi.json exists" <> _} = Scene.write(dir, "hi", "maud")
    refute File.exists?(Path.join(dir, "scenes/hi.scene"))

    # An NPC key runs from 1 to 64 characters, past the starters' own 32.
    for npc <- ["b", String.duplicate("n", 40)] do
      File.cp!(Path.join(dir, "npcs/maud.json"), Path.join(dir, "npcs/#{npc}.json"))
      assert {:ok, _} = Scene.write(dir, "talk_#{byte_size(npc)}", npc)
    end

    File.mkdir_p!(Path.join(dir, "areas"))
    File.write!(Path.join(dir, "areas/yard.json"), JSON.encode!(%{"npcs" => %{"ada" => %{}}}))
    assert {:ok, _} = Scene.write(dir, "ada_talk", "ada")

    # An area folder's NPC is an NPC, and an area folder's dialogue holds its key.
    File.mkdir_p!(Path.join(dir, "areas/a/npcs"))
    File.cp!(Path.join(dir, "npcs/maud.json"), Path.join(dir, "areas/a/npcs/wat.json"))
    assert {:ok, _} = Scene.write(dir, "wat_talk", "wat")
    File.mkdir_p!(Path.join(dir, "areas/a/dialogues"))
    File.write!(Path.join(dir, "areas/a/dialogues/bye.json"), "{}")
    assert {:error, "areas/a/dialogues/bye.json exists" <> _} = Scene.write(dir, "bye", "maud")

    assert_raise Mix.Error, ~r/no rooms\/nowhere/, fn ->
      ExUnit.CaptureIO.capture_io(fn ->
        Mix.Tasks.Loka.New.run(~w(--cwd #{tmp} scene maud later rooms x --from nowhere east mine))
      end)
    end

    refute File.exists?(Path.join(dir, "scenes/later.scene"))

    # A cartridge dir named scene is still a dir.
    {:ok, _} = Starters.write(Path.join(tmp, "scene"), "cartridge", Path.join(tmp, "scene"))
    ExUnit.CaptureIO.capture_io(fn -> Mix.Tasks.Loka.New.run(~w(--cwd #{tmp} npcs bo scene)) end)
    assert File.exists?(Path.join(tmp, "scene/npcs/bo.json"))
  end

  # Runs a starter, first running each starter its refusals name.
  defp follow(dir, kind, name) do
    case Starters.write(dir, kind, name) do
      {:ok, _} ->
        :ok

      {:error, message} ->
        assert [_, needed] = Regex.run(~r/bin\/loka new (\w+) <name> first/, message), message
        follow(dir, needed, "my_#{needed}")
        follow(dir, kind, name)
    end
  end

  defp row_at(dir, room) do
    row = Enum.find(read(dir, "layout.json"), &(&1["room"] == room))
    {row["x"], row["y"], row["z"]}
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
