defmodule Loka.ContentStartersFreshTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  alias Loka.Content.Starters

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

  # Breaks: a rerun at exit 0 restoring a step or a key the author removed from the file it names.
  test "a rerun leaves the removals in its own file alone", %{tmp_dir: tmp} do
    dir = cartridge(tmp)
    follow(dir, "scenes", "s")
    edit(dir, "scenes/s.json", &Map.update!(&1, "steps", fn steps -> Enum.drop(steps, -1) end))
    before = snapshot(dir)
    assert {:error, "scenes/s.json: steps already" <> _} = Starters.write(dir, "scenes", "s")
    assert snapshot(dir) == before

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
