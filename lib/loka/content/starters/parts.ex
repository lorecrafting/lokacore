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
end
