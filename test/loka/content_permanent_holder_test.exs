defmodule Loka.ContentPermanentHolderTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/curse_sampler")}

  @path "reactions/curse.steps[0]"

  defp ticking, do: {"statuses/cursed.json", &Map.put(&1, "per_tick", -1)}
  defp step(s, change), do: update_in(s, ["steps", Access.at(0)], change)
  defp holder(s, key, value), do: step(s, &(&1 |> Map.delete("item") |> Map.put(key, value)))

  defp codes(dir, reaction) do
    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [ticking(), {"reactions/curse.json", reaction}])

    Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})
  end

  defp refused(path), do: [{"SCHEMA_VIOLATION", path, %{"error" => "invalid_value"}}]

  # Breaks (row W8, loka-sgqk): a ticking permanent status lands on an item or room, which the fold's predicate does not take.
  test "a ticking permanent status is refused on a named item", %{dir: dir} do
    assert codes(dir, & &1) == refused(@path <> ".item")
  end

  test "a ticking permanent status is refused on a named room", %{dir: dir} do
    assert codes(dir, &holder(&1, "room", "chapel")) == refused(@path <> ".room")
  end

  test "a ticking permanent status is refused on a tag", %{dir: dir} do
    tagged = &step(holder(&1, "co_present", true), fn s -> Map.put(s, "tag", "cursed") end)
    assert codes(dir, tagged) == refused(@path <> ".tag")
  end

  test "a ticking permanent status is refused on a status event's default subject", %{dir: dir} do
    on_tick = fn r ->
      r
      |> Map.delete("when")
      |> Map.put("on", %{"event" => "status_ticked"})
      |> step(&Map.delete(&1, "item"))
    end

    assert codes(dir, on_tick) == refused(@path <> ".status")
  end

  # Breaks: the refusal reaches a legal form: a ticking permanent on the event's body, or a
  # permanent that does not tick on an item (the sampler as written).
  test "a body may tick and an item may hold a permanent status that does not", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    body = &step(&1, fn s -> Map.delete(s, "item") end)

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [ticking(), {"reactions/curse.json", body}])
  end

  # Breaks: the default-subject refusal also takes a named body on a status event.
  test "a status event may name a body with co_present", %{dir: dir} do
    on_tick = fn r ->
      r
      |> Map.delete("when")
      |> Map.put("on", %{"event" => "status_ticked"})
      |> holder("co_present", true)
    end

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [ticking(), {"reactions/curse.json", on_tick}])
  end
end
