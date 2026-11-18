defmodule Loka.ContentLintSameWordsTest do
  # Lint.same_words/1: two items in one room drawing identical words cannot be told apart by a
  # click or a field, because the Book binds words to a key (docs/rnd/line-key-binding-2026-11-15.md).
  use ExUnit.Case, async: true

  alias Loka.Content.Lint

  # Break: two items in one room drawing identical words pass silently, so the author clicks one
  # and edits the other; or the check warns on a shared wording that is safe (different rooms, or a
  # description nothing clicks) and every sampler family becomes a finding.
  test "two items drawing the same words in one room are named" do
    text = %{
      "text.json" => %{
        "item.egg_01.short" => "an egg",
        "item.egg_02.short" => "an egg",
        "item.far_egg.short" => "an egg",
        "item.one.short" => "one only"
      }
    }

    files =
      Map.new([{"egg_01", "larder"}, {"egg_02", "larder"}, {"far_egg", "cellar"}], fn {id, room} ->
        {"items/#{id}.json",
         %{"name" => "item.#{id}.short", "location" => %{"in" => "room", "room" => room}}}
      end)
      |> Map.merge(text)

    assert Lint.same_words(files) == [
             ~s(items/egg_01.json: draws "an egg" like egg_02 in room larder)
           ]

    # One item alone, or the same words in another room, is not a collision.
    assert Lint.same_words(Map.drop(files, ["items/egg_02.json"])) == []
    assert Lint.same_words(Map.drop(files, ["items/egg_01.json"])) == []

    # An item held by another (not placed in a room) draws no room line, so it cannot collide.
    held = %{"name" => "item.egg_02.short", "location" => %{"in" => "item", "item" => "basket"}}
    assert Lint.same_words(Map.put(files, "items/egg_02.json", held)) == []
  end
end
