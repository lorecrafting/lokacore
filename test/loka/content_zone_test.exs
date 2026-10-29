defmodule Loka.ContentZoneTest do
  use ExUnit.Case, async: true

  # Source shortcut zones (docs/system/cartridge.md, Source shortcuts).
  @codex "cartridges/codex_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})

  defp refused(src, changes) do
    dir = Loka.ContentSource.copy(src)
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    Enum.sort(pairs(diags))
  end

  # Breaks: a non-string zone crashes the pass instead of reaching the schema check at the
  # author's path.
  test "a malformed zone shortcut is refused, not a crash" do
    assert refused(@codex, [{"reactions/wanderer.json", &Map.put(&1, "zone", 1)}]) == [
             {"SCHEMA_VIOLATION", "reactions/wanderer.on.room", %{"error" => "missing_property"}},
             {"UNKNOWN_FIELD", "reactions/wanderer.zone", %{}}
           ]
  end

  # Breaks: an abstract rule's unknown zone is refused (it is never validated), or a concrete
  # child that inherits it compiles or reports at the abstract parent.
  test "an abstract zone rule is not checked; a child that inherits its zone is" do
    rule = "reactions/wanderer.json"
    parent = fn dir -> JSON.decode!(File.read!(Path.join(dir, rule))) end
    dir = Loka.ContentSource.copy(@codex)
    proto = parent.(dir) |> Map.merge(%{"abstract" => true, "zone" => "nowhere"})
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [{"reactions/proto.json", proto}])

    child = %{"extends" => "proto"}

    assert refused(@codex, [{"reactions/proto.json", proto}, {rule, child}]) ==
             [{"UNRESOLVED_REFERENCE", "reactions/wanderer.zone", %{"target" => "nowhere"}}]
  end

  # Breaks: zone together with on.room accepted, an unknown zone dropped, a copy key that repeats
  # an authored rule kept once, or a malformed `zones` accepted or crashing.
  test "a zone rule refuses on.room, an unknown zone, a repeated copy key and malformed zones" do
    rule = "reactions/wanderer.json"

    assert refused(@codex, [{rule, &put_in(&1, ["on", "room"], "hall")}]) ==
             [{"SCHEMA_VIOLATION", "reactions/wanderer.zone", %{"error" => "invalid_value"}}]

    assert refused(@codex, [{rule, &Map.put(&1, "zone", "abbey")}]) ==
             [{"UNRESOLVED_REFERENCE", "reactions/wanderer.zone", %{"target" => "abbey"}}]

    hall = fn dir -> JSON.decode!(File.read!(Path.join(dir, rule))) end
    dir = Loka.ContentSource.copy(@codex)
    authored = hall.(dir) |> Map.delete("zone") |> put_in(["on", "room"], "hall")

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{"reactions/wanderer_hall.json", authored}])

    assert Enum.sort(pairs(diags)) == [
             {"DUPLICATE_DEFINITION", "reactions/wanderer", %{}},
             {"DUPLICATE_DEFINITION", "reactions/wanderer_hall", %{}}
           ]

    for zones <- ["priory", [1], ["Priory!"]] do
      assert refused(@codex, [{"rooms/hall.json", &Map.put(&1, "zones", zones)}]) ==
               [{"SCHEMA_VIOLATION", "rooms/hall.zones", %{"error" => "invalid_type"}}]
    end
  end

  # Breaks: a room listing a zone twice gets two same-key copies.
  test "a repeated zone is one membership" do
    twice = &Map.put(&1, "zones", ["priory", "priory"])

    assert {:ok, _, []} =
             Loka.ContentSource.compile(Loka.ContentSource.copy(@codex), [
               {"rooms/hall.json", twice}
             ])
  end

  # Breaks: copies lose the authored location, so a bad ref in a zone rule reports at a copy key
  # that has no file, or once per copy.
  test "a check on a zone copy reports once at the authored rule" do
    room = &put_in(&1, ["when", "root", "items", Access.at(0), "room"], "nowhere")
    diags = refused(@codex, [{"reactions/wanderer.json", room}])
    assert [{"UNRESOLVED_REFERENCE", "reactions/wanderer.when." <> _, _}] = diags
  end
end
