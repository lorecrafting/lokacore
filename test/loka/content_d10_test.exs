defmodule Loka.ContentD10Test do
  use ExUnit.Case, async: true
  alias Loka.ContentSource
  setup_all do: %{dir: ContentSource.copy("cartridges/toolbox_showcase")}

  # Showcase plus an inline Knock on the Smithy's south store door, answered by the smith.
  defp knock do
    [
      {"rooms/smithy.json",
       &put_in(&1, ["exits", "south", "knock"], %{
         "npc" => "smith",
         "room" => "woodstore",
         "answered" => "knock.store.answered",
         "unanswered" => "knock.store.unanswered"
       })},
      {"text.json",
       &Map.merge(&1, %{
         "knock.store.answered" => "The smith calls back.",
         "knock.store.unanswered" => "No one answers."
       })}
    ]
  end

  # Breaks: malformed drawing metadata or a Knock face references nonexistent content.
  test "map coverage, coordinate collisions and Knock references fail before artifact output", %{
    dir: dir
  } do
    assert {:ok, _, _warnings} = ContentSource.compile(dir, knock())
    map = "map_positions.json"
    knock = &put_in(&1, ["exits", "south", "knock", &2], &3)

    for {file, change, code, path} <- [
          {map, &tl/1, "SCHEMA_VIOLATION", "map_positions"},
          {map, &List.update_at(&1, 1, fn r -> Map.merge(r, Map.take(hd(&1), ~w(x y z))) end),
           "SCHEMA_VIOLATION", "map_positions"},
          {map, &[hd(&1) | tl(&1) |> List.replace_at(0, hd(&1))], "SCHEMA_VIOLATION",
           "map_positions"},
          {map, &List.update_at(&1, 0, fn r -> Map.put(r, "room", "absent") end),
           "UNRESOLVED_REFERENCE", "map_positions[0].room"},
          {map, &List.update_at(&1, 0, fn r -> Map.put(r, "x", 0.5) end), "SCHEMA_VIOLATION",
           "map_positions[0].x"},
          {"rooms/smithy.json", &knock.(&1, "npc", "absent"), "UNRESOLVED_REFERENCE",
           "rooms/smithy.exits.south.knock.npc"},
          {"rooms/smithy.json", &knock.(&1, "room", "smithy"), "BARRIER_MISMATCH",
           "rooms/smithy.exits.south.knock"},
          {"rooms/smithy.json", &knock.(&1, "answered", "absent"), "UNRESOLVED_REFERENCE",
           "rooms/smithy.exits.south.knock.answered"}
        ] do
      assert {:error, diags} = ContentSource.compile(dir, knock() ++ [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]})
    end
  end
end
