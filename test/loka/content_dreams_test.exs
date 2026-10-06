defmodule Loka.ContentDreamsTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Breaks: new Rest/end short refs survive expansion, or source accepts unsafe graph, bed, consequence ownership or required dependencies.
  test "Rest dream source expands its current bindings and rejects impossible declarations", %{
    tmp_dir: dir
  } do
    assert {:ok, bytes, []} = Loka.Content.compile("cartridges/ashmere_missing_child")
    c = JSON.decode!(bytes)["cartridge"]
    s = c["scenes"]["ashmere_missing_child@0.0.40:scene/dream_of_the_fen"]

    assert s["on"]["rest"]["room"] == %{
             "cartridge_id" => "ashmere_missing_child",
             "cartridge_version" => "0.0.40",
             "kind" => "room",
             "key" => "inn_rooms"
           }

    assert s["on_end"]["assign"] == [
             %{
               "fact" => %{
                 "cartridge_id" => "ashmere_missing_child",
                 "cartridge_version" => "0.0.40",
                 "kind" => "fact",
                 "key" => "dream_seen"
               },
               "value" => true
             }
           ]

    changes = [
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.24")},
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn x -> Map.delete(x, "death") end)},
      {"scenes/dream_of_the_fen.json", &put_in(&1, ["on", "rest", "room"], "village_green")},
      {"scenes/dream_of_the_fen.json", &put_in(&1, ["on", "rest", "detail"], "other")},
      {"scenes/dream_of_the_fen.json", &put_in(&1, ["on", "rest", "entitlement"], "dream_seen")},
      {"facts.json", &put_in(&1, ["facts", "slept_at_lantern", "scopes"], ["instance"])},
      {"facts.json", &put_in(&1, ["facts", "slept_at_lantern", "value_type", "default"], true)},
      {"scenes/dream_of_the_fen.json",
       &put_in(&1, ["steps", Access.at(0)], %{"type" => "branch"})},
      {"scenes/dream_of_the_fen.json",
       &put_in(&1, ["steps", Access.at(3), "choices", Access.at(1), "choice_id"], "follow_fox")},
      {"scenes/dream_of_the_fen.json",
       &put_in(&1, ["steps", Access.at(3), "choices", Access.at(1), "text"], "missing.line")},
      {"scenes/dream_of_the_fen.json", &put_in(&1, ["on_end", "quest"], "missing_child")},
      {"quests/a_room_at_the_lantern.json",
       &put_in(&1, ["objective", "policy", "root", "fact"], "slept_at_lantern")},
      {"scenes/dream_of_the_fen.json",
       &put_in(&1, ["on_end", "assign", Access.at(0), "value"], false)},
      {"scenes/dream_of_the_fen.json",
       &put_in(&1, ["on_end", "assign", Access.at(0), "fact"], "slept_at_lantern")},
      {"dialogues/maud_offer.json",
       &put_in(&1, ["choices", "accept", "sequence"], [
         %{"op" => "fact.assign", "fact" => "dream_seen", "value" => true}
       ])},
      {"dialogues/maud_offer.json",
       &put_in(&1, ["choices", "accept", "accept"], "a_room_at_the_lantern")}
    ]

    Enum.with_index(changes, fn {file, change}, n ->
      source = Path.join(dir, Integer.to_string(n))
      File.cp_r!("cartridges/ashmere_missing_child", source)
      path = Path.join(source, file)
      File.write!(path, JSON.encode!(change.(JSON.decode!(File.read!(path)))))
      assert {:error, _} = Loka.Content.compile(source), file
    end)
  end

  # Breaks: differing consequence refs let two dreams consume one Rest anchor, or normalization rejects distinct room/detail anchors.
  @tag :duplicate_rest_trigger
  test "Rest trigger identity is its room and detail, independent of consequence refs", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    read = fn file -> JSON.decode!(File.read!(Path.join(dir, file))) end
    write = fn file, value -> File.write!(Path.join(dir, file), JSON.encode!(value)) end
    facts = read.("facts.json")

    write.(
      "facts.json",
      facts
      |> put_in(["facts", "annex_slept"], facts["facts"]["slept_at_lantern"])
      |> put_in(["facts", "annex_seen"], facts["facts"]["dream_seen"])
    )

    write.(
      "quests/annex_rest.json",
      put_in(
        read.("quests/a_room_at_the_lantern.json"),
        ["objective", "policy", "root", "fact"],
        "annex_seen"
      )
    )

    room = read.("rooms/inn_rooms.json")

    write.(
      "rooms/inn_rooms.json",
      put_in(
        room,
        ["details", "other_bed"],
        Map.put(room["details"]["bed"], "aliases", ["other_bed"])
      )
    )

    write.("rooms/dream_annex.json", room)

    scene =
      read.("scenes/dream_of_the_fen.json")
      |> put_in(["on", "rest", "credit"], "annex_slept")
      |> put_in(["on", "rest", "quest"], "annex_rest")
      |> put_in(["on_end", "assign", Access.at(0), "fact"], "annex_seen")
      |> put_in(["on_end", "quest"], "annex_rest")

    for {room, detail} <- [{"dream_annex", "bed"}, {"inn_rooms", "other_bed"}] do
      write.(
        "scenes/another_dream.json",
        scene
        |> put_in(["on", "rest", "room"], room)
        |> put_in(["on", "rest", "detail"], detail)
      )

      assert {:ok, _, _} = Loka.Content.compile(dir)
    end

    write.("rooms/inn_rooms.json", room)
    write.("scenes/another_dream.json", scene)
    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.map(diagnostics, &{&1["code"], &1["path"]}) == [
             {"DUPLICATE_DEFINITION", "scenes/another_dream.on"},
             {"DUPLICATE_DEFINITION", "scenes/dream_of_the_fen.on"}
           ]
  end
end
