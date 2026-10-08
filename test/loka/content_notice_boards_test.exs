defmodule Loka.ContentNoticeBoardsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: malformed same-room membership or unbound board/notice title keys compile.
  test "compiler rejects board references and missing catalog keys", %{dir: dir} do
    for {name, change, suffix, target} <- [
          {"remote",
           &put_in(
             &1,
             ["details", "rumor_board", "notice_board", "notices", Access.at(0), "detail"],
             "notice"
           ), ".notices[0].detail", "notice"},
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
             "label" => "actions.read_notice",
             "text" => "readable.notice"
           }), "", nil}
        ] do
      assert {:error, errors} =
               Loka.ContentSource.compile(dir, [{"rooms/drowned_lantern.json", change}])

      path = "rooms/drowned_lantern.details.rumor_board.notice_board" <> suffix

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

    changes = [
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "readable") end)}
      | Enum.map(rooms, &{&1, unread})
    ]

    assert {:error, errors} = Loka.ContentSource.compile(dir, changes)

    assert Enum.any?(
             errors,
             &(&1["code"] == "UNDECLARED_CAPABILITY" and
                 &1["path"] == "rooms/drowned_lantern.details.rumor_board.notice_board")
           )
  end
end
