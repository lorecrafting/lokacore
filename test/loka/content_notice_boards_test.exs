defmodule Loka.ContentNoticeBoardsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/journal_sampler")}

  # Twin of kernel/ts/test/search_fixture.ts: a titled tracks notice at the landing, and on the
  # green a rumor board over two readable notices.
  defp read(name, title \\ nil) do
    readable = %{"label" => "actions.read_#{name}", "text" => "readable.#{name}"}

    %{
      "aliases" => [name],
      "description" => "detail.#{name}.description",
      "readable" => if(title, do: Map.put(readable, "title", title), else: readable)
    }
  end

  defp source(green \\ & &1) do
    text =
      for name <- ~w(tracks lost_whistle cellar_help),
          {k, v} <- [
            {"detail.#{name}.description", "The #{name}."},
            {"detail.#{name}.title", name},
            {"actions.read_#{name}", "Read #{name}"},
            {"readable.#{name}", "It reads #{name}."}
          ],
          into: %{
            "detail.rumor_board.description" => "A rumor board.",
            "detail.rumor_board.title" => "Rumors"
          },
          do: {k, v}

    [
      {"cartridge.json",
       &update_in(&1, ~w(requires capabilities), fn c -> Map.put(c, "readable", 1) end)},
      {"text.json", &Map.merge(&1, text)},
      {"rooms/ferry_landing.json",
       &put_in(&1, ~w(details tracks), read("tracks", "detail.tracks.title"))},
      {"rooms/village_green.json",
       fn room ->
         Map.put(room, "details", %{
           "rumor_board" => %{
             "aliases" => ["rumor_board", "board"],
             "description" => "detail.rumor_board.description",
             "notice_board" => %{
               "title" => "detail.rumor_board.title",
               "notices" => [
                 %{"detail" => "lost_whistle", "title" => "detail.lost_whistle.title"},
                 %{"detail" => "cellar_help", "title" => "detail.cellar_help.title"}
               ]
             }
           },
           "lost_whistle" => read("lost_whistle"),
           "cellar_help" => read("cellar_help")
         })
         |> green.()
       end}
    ]
  end

  # Breaks: malformed same-room membership or unbound board/notice title keys compile.
  test "compiler rejects board references and missing catalog keys", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, source())

    for {name, change, suffix, target} <- [
          {"remote",
           &put_in(
             &1,
             ["details", "rumor_board", "notice_board", "notices", Access.at(0), "detail"],
             "tracks"
           ), ".notices[0].detail", "tracks"},
          {"self",
           &put_in(
             &1,
             ["details", "rumor_board", "notice_board", "notices", Access.at(0), "detail"],
             "rumor_board"
           ), ".notices[0].detail", "rumor_board"},
          {"ordinary",
           &update_in(&1, ["details", "lost_whistle"], fn d -> Map.delete(d, "readable") end),
           ".notices[0].detail", "lost_whistle"},
          {"duplicate",
           &put_in(
             &1,
             ["details", "rumor_board", "notice_board", "notices", Access.at(1), "detail"],
             "lost_whistle"
           ), ".notices[1].detail", "lost_whistle"},
          {"title",
           &put_in(&1, ["details", "rumor_board", "notice_board", "title"], "missing.title"),
           ".title", "missing.title"},
          {"child_title",
           &put_in(
             &1,
             ["details", "rumor_board", "notice_board", "notices", Access.at(1), "title"],
             "missing.title"
           ), ".notices[1].title", "missing.title"},
          {"readable_board",
           &put_in(&1, ["details", "rumor_board", "readable"], %{
             "label" => "actions.read_tracks",
             "text" => "readable.tracks"
           }), "", nil}
        ] do
      assert {:error, errors} = Loka.ContentSource.compile(dir, source(change))
      path = "rooms/village_green.details.rumor_board.notice_board" <> suffix

      assert Enum.any?(
               errors,
               &(&1["code"] == "UNRESOLVED_REFERENCE" and &1["path"] == path and
                   &1["data"] == if(target, do: %{"target" => target}, else: %{}))
             ),
             name
    end
  end

  # Breaks: a board with no readable sibling bypasses readable@1 ownership checks.
  test "board metadata still requires readable capability when sibling Read fields are absent", %{
    dir: dir
  } do
    unread = fn room ->
      room =
        update_in(room, ["details"], fn ds ->
          if ds, do: Map.new(ds, fn {k, d} -> {k, Map.delete(d, "readable")} end), else: nil
        end)

      if is_nil(room["details"]), do: Map.delete(room, "details"), else: room
    end

    rooms =
      for path <- Path.wildcard(Path.join(dir, "rooms/*.json")), do: Path.relative_to(path, dir)

    changes =
      source() ++
        [
          {"cartridge.json",
           &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "readable") end)}
          | Enum.map(rooms, &{&1, unread})
        ]

    assert {:error, errors} = Loka.ContentSource.compile(dir, changes)

    assert Enum.any?(
             errors,
             &(&1["code"] == "UNDECLARED_CAPABILITY" and
                 &1["path"] == "rooms/village_green.details.rumor_board.notice_board")
           )
  end
end
