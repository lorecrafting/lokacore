defmodule Loka.ContentLintLayoutTest do
  # Area layout lint (cartridge area layout design, section 5). Each planted cartridge breaks one
  # rule and keeps the other two; the showcase baseline test keeps them silent on real source.
  use ExUnit.Case, async: true

  @moduletag :tmp_dir

  defp plant(dir, files) do
    for {rel, body} <- Map.put(files, "cartridge.json", %{"entry" => "a"}) do
      File.mkdir_p!(Path.dirname(Path.join(dir, rel)))
      File.write!(Path.join(dir, rel), Jason.encode!(body))
    end

    Loka.Content.lint(dir)
  end

  defp room(exits), do: %{"exits" => Map.new(exits, fn {way, to} -> {way, %{"to" => to}} end)}

  # Breaks: a room nothing reaches and nothing is kept in passes, or a room kept by an NPC is
  # called an orphan.
  test "orphan room: an area room no exit reaches, unless something is kept there", %{
    tmp_dir: dir
  } do
    files = %{
      "rooms/a.json" => room(east: "h"),
      "areas/hollow/rooms/h.json" => room(west: "a"),
      "areas/hollow/rooms/old_well.json" => room([])
    }

    assert plant(dir, files) == [
             "areas/hollow/rooms/old_well.json: no exit or transport reaches this room and nothing is kept here; link it or delete it"
           ]

    assert plant(dir, Map.put(files, "npcs/hermit.json", %{"room" => "old_well"})) == []
  end

  # Breaks: an area entered only from inside itself passes, or a transport into it is not counted.
  test "unreachable area: no exit or transport from outside leads in", %{tmp_dir: dir} do
    files = %{
      "rooms/a.json" => room(north: "b"),
      "rooms/b.json" => room(south: "a"),
      "areas/deep/rooms/d1.json" => room(west: "a", east: "d2"),
      "areas/deep/rooms/d2.json" => room(west: "d1")
    }

    assert plant(dir, files) == [
             "areas/deep: no exit or transport leads into this area; add an exit from another area's room"
           ]

    ferry = %{"room" => %{"key" => "b"}, "destination" => "d2"}
    assert plant(dir, Map.put(files, "transports/ferry.json", ferry)) == []
  end

  # Breaks: a room whose every exit crosses into one other area passes, or a room with one exit
  # (a dead end) is flagged.
  test "astray room: two or more exits, all into one other area", %{tmp_dir: dir} do
    files = %{
      "rooms/a.json" => room(north: "thinning", east: "e1"),
      "areas/hollow/rooms/thinning.json" => room(north: "e1", south: "e2"),
      "areas/edge/rooms/e1.json" => room(south: "thinning", east: "e2"),
      "areas/edge/rooms/e2.json" => room(north: "e1")
    }

    assert plant(dir, files) == [
             "areas/hollow/rooms/thinning.json: every exit leads into areas/edge; move the file there, or add an exit within hollow"
           ]

    one_exit = Map.put(files, "areas/hollow/rooms/thinning.json", room(north: "e1"))
    assert plant(dir, one_exit) == []
  end
end
