defmodule Loka.ContentStartersExtendsTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  alias Loka.Content.Starters

  @wild %{
    "abstract" => true,
    # A parent's placement does not move the child's own.
    "room" => "start",
    "hp" => %{"minimum" => 0, "maximum" => 3, "start" => 3, "gain" => 0}
  }

  # Breaks: the child copying the parent's fields (or a `~` over one a grandparent gives, which
  # wins the merge), losing its own name keyword or room, a chain whose middle parent puts a list
  # over an object crashing the merge, or a child the compiler cannot resolve.
  test "a child of an abstract NPC holds extends and its own fields and compiles", %{tmp_dir: tmp} do
    dir = cartridge(tmp)

    put(dir, "npcs/beast.json", %{
      "abstract" => true,
      "description" => %{"prose" => "Furry."},
      "keywords" => %{"not" => "a list"}
    })

    put(
      dir,
      "npcs/wild.json",
      Map.merge(@wild, %{"extends" => "beast", "keywords" => ["animal"]})
    )

    new(tmp, ~w(npcs deer --extends wild mine))

    assert read(dir, "npcs/deer.json") == %{
             "extends" => "wild",
             "keywords" => ["deer"],
             "name" => %{"prose" => "~"},
             "room_line" => %{"prose" => "~"},
             "room" => "start"
           }

    assert npc(dir, "deer")["hp"] == @wild["hp"]
  end

  # Breaks: an object the parent fills in part losing the starter's other fields, or an emptied
  # object left behind.
  test "the child keeps the part of an object the parent lacks" do
    starter = %{
      "hp" => %{"start" => 1, "gain" => 0},
      "name" => %{"prose" => "~"},
      "x" => %{"y" => 1}
    }

    parent = %{"hp" => %{"gain" => 2}, "name" => %{"prose" => "Elk"}, "x" => 1}

    assert Starters.Child.extending(%{"o" => starter}, "o", {"p", parent}) ==
             %{"o" => %{"extends" => "p", "hp" => %{"start" => 1}}}
  end

  # Breaks: --extends dropping the --area folder or the --from exit, or parsing only in one order.
  test "--extends combines with --area and --from", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    put(dir, "npcs/wild.json", @wild)

    put(dir, "rooms/cave.json", %{
      "abstract" => true,
      "description" => %{"prose" => "~"},
      "exits" => %{}
    })

    new(tmp, ~w(areas a npcs deer --area a --extends wild npcs elk --extends wild --area a mine))
    new(tmp, ~w(rooms den --from start east --extends cave mine))
    put(dir, "items/box.json", %{"abstract" => true, "location" => %{"in" => "template"}})
    new(tmp, ~w(items crate --area a --extends box mine))
    assert read(dir, "areas/a/items/crate.json")["location"] == %{"in" => "room", "room" => "a"}

    assert read(dir, "areas/a/npcs/deer.json")["extends"] == "wild"
    assert read(dir, "areas/a/npcs/elk.json")["room"] == "a"
    assert npc(dir, "elk")["hp"] == @wild["hp"]
    den = read(dir, "rooms/den.json")
    assert {den["extends"], den["exits"]["west"]["to"]} == {"cave", "start"}
    refute Map.has_key?(den, "description")
    # The abstract cave gets no row from the layout starter either (the compiler refuses one).
    File.rm!(Path.join(dir, "layout.json"))
    {:ok, _} = Starters.write(dir, "layout", "layout")
    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Breaks: a refused parent writing a child the compiler then rejects, a vague message, a room
  # refused across areas, or empty params refused.
  test "--extends refuses a parent the compiler would refuse, writing nothing", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    put(dir, "npcs/wild.json", @wild)
    put(dir, "npcs/tame.json", Map.delete(@wild, "abstract"))
    put(dir, "npcs/kin.json", Map.put(@wild, "params", ["x"]))
    put(dir, "areas/a/npcs/f.json", @wild)
    put(dir, "areas/a/rooms/a.json", Starters.Parts.room())
    put(dir, "areas/b/rooms/b.json", Starters.Parts.room())

    put(dir, "areas/a/rooms/cellar.json", %{
      "abstract" => true,
      "description" => %{"prose" => "~"}
    })

    put(dir, "populations/herd.json", %{"abstract" => true})
    put(dir, "npcs/open.json", Map.put(@wild, "params", []))
    before = snapshot(dir)

    for {args, line} <- [
          {~w(npcs deer --extends nobody), "--extends nobody: no npcs nobody"},
          {~w(npcs deer --extends tame),
           ~s(--extends tame: npcs/tame.json is not "abstract": true)},
          {~w(items deer --extends wild),
           "--extends wild: npcs/wild.json is another kind; a parent is items"},
          {~w(npcs deer --area b --extends f),
           "--extends f: areas/a/npcs/f.json belongs to the area a; only that area and the root may extend it"},
          {~w(npcs deer --extends kin),
           ~s(--extends kin: npcs/kin.json has params; write the child and its "with" by hand)},
          {~w(npcs tame --extends wild),
           ~s(--extends wild: npcs/tame.json exists; add "extends" there by hand)},
          {~w(populations deer --extends herd),
           "--extends: populations derive their keys per kind; write the child by hand"},
          {~w(npcs deer --extends ../x),
           "--extends: a key is lowercase letters, digits and _, 64 at most (got ../x)"}
        ] do
      assert_raise Mix.Error, "mix loka.new: " <> line, fn -> new(tmp, args ++ ["mine"]) end
      assert snapshot(dir) == before, line
    end

    # The same area may extend it; any room may extend any room.
    for k <- ~w(npcs/tame npcs/kin populations/herd), do: File.rm!(Path.join(dir, "#{k}.json"))
    new(tmp, ~w(npcs deer --area a --extends f mine))
    new(tmp, ~w(rooms x --area b --extends cellar mine))
    assert read(dir, "areas/b/rooms/x.json")["extends"] == "cellar"
    # Empty params need no "with".
    new(tmp, ~w(npcs elk --extends open mine))
    assert npc(dir, "deer")["hp"] == @wild["hp"]
  end

  defp new(tmp, args),
    do: ExUnit.CaptureIO.capture_io(fn -> Mix.Tasks.Loka.New.run(["--cwd", tmp | args]) end)

  defp cartridge(tmp) do
    dir = Path.join(tmp, "mine")
    {:ok, _} = Starters.write(dir, "cartridge", dir)
    dir
  end

  defp npc(dir, key) do
    {:ok, bytes, _} = Loka.Content.compile(dir)
    npcs = JSON.decode!(bytes)["cartridge"]["npcs"]
    Enum.find_value(npcs, fn {id, npc} -> String.ends_with?(id, ":npc/" <> key) && npc end)
  end

  defp put(dir, rel, value) do
    path = Path.join(dir, rel)
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, JSON.encode!(value))
  end

  defp snapshot(dir),
    do: for(p <- Path.wildcard(Path.join(dir, "**/*.json")), into: %{}, do: {p, File.read!(p)})

  defp read(dir, rel), do: dir |> Path.join(rel) |> File.read!() |> JSON.decode!()
end
