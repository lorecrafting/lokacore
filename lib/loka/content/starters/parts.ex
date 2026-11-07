defmodule Loka.Content.Starters.Parts do
  @moduledoc false
  alias Loka.Content.Starters.Area
  # The pieces Templates and World share: the placeholder and the smallest valid shapes.
  def p, do: %{"prose" => "~"}
  def combat_lines, do: ~w(player_hit player_miss npc_hit npc_miss player_died npc_died)
  def room, do: %{"name" => p(), "description" => p(), "exits" => %{}}

  def fact,
    do: %{
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "~"
    }

  def resource, do: %{"minimum" => 0, "maximum" => 10, "start" => 10, "gain" => 0}

  def thing(name),
    do: %{"keywords" => [name], "name" => p(), "room_line" => p(), "description" => p()}

  def in_room(room), do: %{"in" => "room", "room" => room}
  def narrate, do: %{"op" => "narrate", "text" => p()}
  # A provider holds the resource's own start: resources.ex:109-116 refuses one outside min..max.
  def starts(dir, "resources", key),
    do: %{
      "resource_start" => Area.read(Path.join(dir, "resources.json"))["resources"][key]["start"]
    }

  def starts(_, _, _), do: %{}

  def stock(c), do: %{"resource_starts" => %{c["resources"] => c["resource_start"]}}

  # Two-space JSON the author edits and the column's source finder reads one `"key":` per line.
  def pretty(value), do: IO.iodata_to_binary([pretty(value, ""), "\n"])

  # JSON.decode options that keep an object's key order: {:obj, pairs}.
  def ordered, do: [object_push: &push/3, object_finish: &finish/2]
  @doc false
  def push(key, value, acc), do: [{key, value} | acc]
  @doc false
  def finish(acc, old), do: {{:obj, Enum.reverse(acc)}, old}

  # Over an existing file: its own key order, then new keys sorted, so only added lines show in a
  # diff (the editor writes JSON.stringify's insertion order; loka-wfrgk.68).
  def pretty_over(value, path) do
    with {:ok, bytes} <- File.read(path),
         {tree, [], ""} <- JSON.decode(bytes, [], ordered()) do
      pretty(kept(value, tree))
    else
      _ -> pretty(value)
    end
  end

  defp kept(map, {:obj, pairs}) when is_map(map) do
    old = for {k, v} <- pairs, Map.has_key?(map, k), do: {k, kept(map[k], v)}
    {:obj, old ++ Enum.sort(Map.drop(map, Enum.map(pairs, &elem(&1, 0))))}
  end

  defp kept(list, old) when is_list(list) and is_list(old),
    do: Enum.with_index(list, &kept(&1, Enum.at(old, &2)))

  defp kept(value, _), do: value

  defp pretty(map, pad) when is_map(map) and map_size(map) > 0,
    do: pretty({:obj, Enum.sort(map)}, pad)

  # An object in its own key order (as Copy keeps the author's).
  defp pretty({:obj, pairs}, pad) when pairs != [] do
    rows =
      for {k, v} <- pairs, do: [pad, "  ", JSON.encode!(k), ": ", pretty(v, pad <> "  ")]

    ["{\n", Enum.intersperse(rows, ",\n"), "\n", pad, "}"]
  end

  defp pretty(list, pad) when is_list(list) and list != [] do
    rows = for v <- list, do: [pad, "  ", pretty(v, pad <> "  ")]
    ["[\n", Enum.intersperse(rows, ",\n"), "\n", pad, "]"]
  end

  defp pretty({:obj, []}, _), do: "{}"
  defp pretty(value, _), do: JSON.encode!(value)
end
