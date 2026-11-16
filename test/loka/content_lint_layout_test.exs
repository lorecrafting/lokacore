defmodule Loka.ContentLintLayoutTest do
  # Area layout lint (cartridge area layout design, section 5). Each planted cartridge breaks one
  # rule and keeps the other two; the showcase baseline test keeps them silent on real source.
  use ExUnit.Case, async: true

  @moduletag :tmp_dir

  defp plant(dir, files) do
    for {rel, body} <- Map.put_new(files, "cartridge.json", %{"entry" => "a"}) do
      File.mkdir_p!(Path.dirname(Path.join(dir, rel)))
      File.write!(Path.join(dir, rel), Jason.encode!(body))
    end

    Loka.Content.lint(dir)
  end

  defp room(exits), do: %{"exits" => Map.new(exits, fn {way, to} -> {way, %{"to" => to}} end)}

  # Breaks: a room nothing reaches and nothing is kept in passes, a room kept by an NPC, a population's
  # home or area, or a structure site is called an orphan, or a room file mid-edit (broken JSON)
  # crashes the whole lint.
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
    # plant keeps earlier files: each keeper is removed before the next is tried
    File.rm!(Path.join(dir, "npcs/hermit.json"))
    assert plant(dir, Map.put(files, "populations/bats.json", %{"home" => "old_well"})) == []
    bats = %{"home" => "h", "area" => [%{"key" => "old_well"}]}
    assert plant(dir, Map.put(files, "populations/bats.json", bats)) == []
    File.rm!(Path.join(dir, "populations/bats.json"))
    site = Map.put(room([]), "site", %{})
    assert plant(dir, Map.put(files, "areas/hollow/rooms/old_well.json", site)) == []
    File.write!(Path.join(dir, "areas/hollow/rooms/broken.json"), "{")
    assert plant(dir, Map.put(files, "npcs/hermit.json", %{"room" => "old_well"})) == []
  end

  # Breaks: an area entered only from inside itself passes, a transport into it is not counted, or
  # the area holding the entry room (the prologue's case) is flagged.
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
    File.rm!(Path.join(dir, "transports/ferry.json"))
    assert plant(dir, Map.put(files, "cartridge.json", %{"entry" => "d1"})) == []
  end

  # Breaks: a room whose every exit crosses into one other area passes, a room with one exit
  # (a dead end) is flagged, or an area room whose exits all lead to the root is called astray.
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

    to_root = %{
      "rooms/b.json" => room(west: "a"),
      "areas/edge/rooms/e2.json" => room(n: "a", s: "b")
    }

    assert plant(dir, Map.merge(one_exit, to_root)) == []
  end

  # Break: a nested choice's finding names its made-up rel scenes/hal_stay.scene, no file (loka-vduxr.63),
  # or a nested dialogue of the real hal_x.scene is named under the shorter real stem hal.scene.
  test "a nested dialogue's finding names its scene file and its key", %{tmp_dir: dir} do
    File.write!(Path.join(dir, "cartridge.json"), "{}")
    File.mkdir_p!(Path.join(dir, "scenes"))

    nested =
      "- Stay\n  elder: words\n  - On\n    elder: words\n  - Leave her be.\n    elder: words\n"

    File.write!(Path.join(dir, "scenes/hal.scene"), "npc: elder\n\nelder: words\n#{nested}")

    File.write!(
      Path.join(dir, "scenes/hal_x.scene"),
      "npc: elder\n\nelder: words\n#{String.replace(nested, "Stay", "Go")}"
    )

    label = "label dialogue.hal_stay.choices.leave_her_be.label ends in a period"
    findings = Loka.Content.Lint.run(dir)
    assert "scenes/hal.scene (hal_stay): #{label}" in findings
    label = "label dialogue.hal_x_go.choices.leave_her_be.label ends in a period"
    assert "scenes/hal_x.scene (hal_x_go): #{label}" in findings
  end
end
