defmodule Loka.Content.Starters.Parts do
  @moduledoc false
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
  def stock(c), do: %{"resource_starts" => %{c["resources"] => 10}}

  # Two-space JSON the author edits and the column's source finder reads one `"key":` per line.
  def pretty(value), do: IO.iodata_to_binary([pretty(value, ""), "\n"])

  defp pretty(map, pad) when is_map(map) and map_size(map) > 0 do
    rows =
      for {k, v} <- Enum.sort(map), do: [pad, "  ", JSON.encode!(k), ": ", pretty(v, pad <> "  ")]

    ["{\n", Enum.intersperse(rows, ",\n"), "\n", pad, "}"]
  end

  defp pretty(list, pad) when is_list(list) and list != [] do
    rows = for v <- list, do: [pad, "  ", pretty(v, pad <> "  ")]
    ["[\n", Enum.intersperse(rows, ",\n"), "\n", pad, "]"]
  end

  defp pretty(value, _), do: JSON.encode!(value)
end
