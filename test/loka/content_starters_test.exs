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
    File.write!(Path.join(dir, "layout.json"), ~s([{"room":"start","x":5,"y":2,"z":0}]))
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

  defp edit(dir, rel, change) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(change.(JSON.decode!(File.read!(path)))))
  end

  defp snapshot(dir),
    do: for(p <- Path.wildcard(Path.join(dir, "**/*.json")), into: %{}, do: {p, File.read!(p)})

  defp read(dir, rel), do: dir |> Path.join(rel) |> File.read!() |> JSON.decode!()
end
