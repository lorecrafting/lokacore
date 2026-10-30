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

  # Breaks: malformed drawing metadata, a map without knowledge@1, or a Knock face references
  # nonexistent content.
  test "map coverage, coordinate collisions and Knock references fail before artifact output", %{
    dir: dir
  } do
    assert {:ok, _, _warnings} = ContentSource.compile(dir, knock())
    map = "layout.json"
    knock = &put_in(&1, ["exits", "south", "knock", &2], &3)

    for {file, change, code, path} <- [
          {map, &tl/1, "SCHEMA_VIOLATION", "layout"},
          {map, &List.update_at(&1, 1, fn r -> Map.merge(r, Map.take(hd(&1), ~w(x y z))) end),
           "SCHEMA_VIOLATION", "layout"},
          {map, &List.update_at(&1, 1, fn r -> Map.put(r, "room", hd(&1)["room"]) end),
           "SCHEMA_VIOLATION", "layout"},
          {map, &List.update_at(&1, 0, fn r -> Map.put(r, "room", "absent") end),
           "UNRESOLVED_REFERENCE", "layout[0].room"},
          {map, &List.update_at(&1, 0, fn r -> Map.put(r, "x", 0.5) end), "SCHEMA_VIOLATION",
           "layout[0].x"},
          {"cartridge.json",
           &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "knowledge") end),
           "UNDECLARED_CAPABILITY", "layout"},
          {"rooms/smithy.json", &knock.(&1, "npc", "absent"), "UNRESOLVED_REFERENCE",
           "rooms/smithy.exits.south.knock.npc"},
          {"rooms/smithy.json", &knock.(&1, "room", "smithy"), "BARRIER_MISMATCH",
           "rooms/smithy.exits.south.knock"},
          {"rooms/smithy.json",
           &put_in(&1, ["exits", "north", "knock"], %{
             &1["exits"]["south"]["knock"]
             | "room" => &1["exits"]["north"]["to"]
           }), "BARRIER_MISMATCH", "rooms/smithy.exits.north.knock"},
          {"rooms/smithy.json", &knock.(&1, "answered", "absent"), "UNRESOLVED_REFERENCE",
           "rooms/smithy.exits.south.knock.answered"}
        ] do
      assert {:error, diags} = ContentSource.compile(dir, knock() ++ [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]})
    end
  end
end
