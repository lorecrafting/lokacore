defmodule Loka.ContentNoticeBoardsTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp source(dir, change) do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "rooms/drowned_lantern.json")
    room = path |> File.read!() |> JSON.decode!()
    File.write!(path, JSON.encode!(change.(room)))
    Loka.Content.compile(dir)
  end

  # Breaks: malformed same-room membership or unbound board/notice title keys compile.
  test "compiler rejects board references and missing catalog keys", %{tmp_dir: dir} do
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
      assert {:error, errors} = source(Path.join(dir, name), change)
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
    tmp_dir: dir
  } do
    root = Path.join(dir, "lock")
    File.cp_r!("cartridges/ashmere_missing_child", root)
    manifest = Path.join(root, "cartridge.json")

    File.write!(
      manifest,
      manifest
      |> File.read!()
      |> JSON.decode!()
      |> update_in(["requires", "capabilities"], &Map.delete(&1, "readable"))
      |> JSON.encode!()
    )

    for path <- Path.wildcard(Path.join(root, "rooms/*.json")) do
      room =
        path
        |> File.read!()
        |> JSON.decode!()
        |> update_in(["details"], fn ds ->
          if ds, do: Map.new(ds, fn {k, d} -> {k, Map.delete(d, "readable")} end), else: nil
        end)

      room = if is_nil(room["details"]), do: Map.delete(room, "details"), else: room
      File.write!(path, JSON.encode!(room))
    end

    assert {:error, errors} = Loka.Content.compile(root)

    assert Enum.any?(
             errors,
             &(&1["code"] == "UNDECLARED_CAPABILITY" and
                 &1["path"] == "rooms/drowned_lantern.details.rumor_board.notice_board")
           )
  end
end
