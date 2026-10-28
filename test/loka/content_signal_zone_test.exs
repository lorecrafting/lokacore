defmodule Loka.ContentSignalZoneTest do
  use ExUnit.Case, async: true

  # Source shortcuts `signal` and zones (docs/system/cartridge.md, Source shortcuts).
  @sugar "test/fixtures/signal_sugar"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})

  defp refused(src, changes) do
    dir = Loka.ContentSource.copy(src)
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    Enum.sort(pairs(diags))
  end

  # Breaks: the generated fact differs from the documented spec (scope, range, meaning), the
  # sending step or the trigger lowers to anything but fact.adjust 1 / fact_changed.
  test "signal_sugar compiles to the same artifact as its hand-expanded twin" do
    assert {:ok, _, []} = sugar = Loka.Content.compile(@sugar)
    assert sugar == Loka.Content.compile("test/fixtures/signal_expanded")
  end

  # Breaks: an authored signal_<name> silently replaced, a listener nobody sends to dropped, a
  # missing facts.json not created, or an undecodable one crashing the pass.
  test "signal refuses a taken fact name and an unheard listener" do
    assert refused(@sugar, [{"facts.json", &put_in(&1, ["facts", "signal_bell"], heard())}]) ==
             [{"FACT_NAME_COLLISION", "facts.facts.signal_bell", %{}}]

    assert refused(@sugar, [{"reactions/hear.json", &put_in(&1, ["on", "signal"], "gong")}]) ==
             [{"UNRESOLVED_REFERENCE", "reactions/hear.on.signal", %{"target" => "gong"}}]

    narrate = &Map.update!(&1, "apply", fn steps -> Enum.drop(steps, 1) end)
    dir = Loka.ContentSource.copy(@sugar)

    assert {:ok, _, []} =
             Loka.ContentSource.compile(dir, [
               {"facts.json", nil},
               {"reactions/hear.json", narrate}
             ])

    File.write!(Path.join(dir, "facts.json"), "{")
    assert {:error, diags} = Loka.Content.compile(dir)
    assert {"INVALID_JSON", "facts"} in Enum.map(pairs(diags), &Tuple.delete_at(&1, 2))
  end

  # Breaks: a lowered step loses its location, so a check on the generated fact.adjust reports
  # nowhere or at the wrong rule.
  test "a check on a lowered step or trigger reports at the author's path" do
    undeclared = &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "fact") end)
    fact = %{"capability" => "fact"}

    assert refused(@sugar, [{"cartridge.json", undeclared}]) == [
             {"UNDECLARED_CAPABILITY", "reactions/hear.apply[0].op", fact},
             {"UNDECLARED_CAPABILITY", "reactions/hear.on.event", fact},
             {"UNDECLARED_CAPABILITY", "reactions/ring.apply[0].op", fact}
           ]
  end

  @codex "cartridges/codex_sampler"

  # Breaks: a non-string signal name, a non-list apply, or a non-string zone crashes the pass
  # instead of reaching the schema check at the author's path.
  test "a malformed signal or zone shortcut is refused, not a crash" do
    assert refused(@sugar, [
             {"reactions/ring.json", &put_in(&1, ["apply", Access.at(0), "signal"], 1)},
             {"reactions/hear.json", &put_in(&1, ["on", "signal"], 1)}
           ]) == [
             {"SCHEMA_VIOLATION", "reactions/hear.on.event", %{"error" => "unknown_variant"}},
             {"SCHEMA_VIOLATION", "reactions/ring.apply[0].op", %{"error" => "unknown_variant"}}
           ]

    assert refused(@sugar, [{"reactions/ring.json", &Map.put(&1, "apply", "x")}]) == [
             {"SCHEMA_VIOLATION", "reactions/ring.apply", %{"error" => "invalid_type"}},
             {"UNRESOLVED_REFERENCE", "reactions/hear.on.signal", %{"target" => "bell"}}
           ]

    assert refused(@sugar, [
             {"reactions/ring.json", &put_in(&1, ["apply", Access.at(0), "amount"], 5)},
             {"reactions/hear.json", &put_in(&1, ["on", "fact"], "heard")}
           ]) == [
             {"SCHEMA_VIOLATION", "reactions/hear.on.event", %{"error" => "unknown_variant"}},
             {"SCHEMA_VIOLATION", "reactions/ring.apply[0].op", %{"error" => "unknown_variant"}}
           ]

    assert refused(@sugar, [
             {"reactions/ring.json", &put_in(&1, ["apply", Access.at(0), "fact"], "heard")}
           ]) == [
             {"SCHEMA_VIOLATION", "reactions/ring.apply[0].op", %{"error" => "unknown_variant"}}
           ]

    assert refused(@sugar, [
             {"reactions/ring.json", &put_in(&1, ["apply", Access.at(0), "signal"], "Bell!")}
           ]) == [
             {"SCHEMA_VIOLATION", "reactions/ring.apply[0].op", %{"error" => "unknown_variant"}},
             {"UNRESOLVED_REFERENCE", "reactions/hear.on.signal", %{"target" => "bell"}}
           ]

    assert refused(@codex, [{"reactions/wanderer.json", &Map.put(&1, "zone", 1)}]) == [
             {"SCHEMA_VIOLATION", "reactions/wanderer.on.room", %{"error" => "missing_property"}},
             {"UNKNOWN_FIELD", "reactions/wanderer.zone", %{}}
           ]
  end

  # Breaks: a sending step whose generated signal_<name> is over the Key limit lowers, so the
  # schema refuses generated paths the author never wrote; a 57-character name is refused; or a
  # listener of a refused name gets a false "no sender" UNRESOLVED_REFERENCE.
  test "a name too long for its fact or not a Key is refused once, at the sending step" do
    name = fn n -> String.duplicate("s", n) end

    named = fn signal ->
      [
        {"reactions/ring.json", &put_in(&1, ["apply", Access.at(0), "signal"], signal)},
        {"reactions/hear.json", &put_in(&1, ["on", "signal"], signal)}
      ]
    end

    op = {"SCHEMA_VIOLATION", "reactions/ring.apply[0].op", %{"error" => "unknown_variant"}}
    assert refused(@sugar, named.(name.(58))) == [op]
    assert refused(@sugar, named.("Bell")) == [op]

    assert {:ok, _, []} =
             Loka.ContentSource.compile(Loka.ContentSource.copy(@sugar), named.(name.(57)))
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

  # Breaks: a room listing a zone twice gets two same-key copies, or a cartridge with no signal
  # and no facts.json gains a facts.json entry it never wrote.
  test "a repeated zone is one membership and no signal adds no facts.json" do
    twice = &Map.put(&1, "zones", ["priory", "priory"])

    assert {:ok, _, []} =
             Loka.ContentSource.compile(Loka.ContentSource.copy(@codex), [
               {"rooms/hall.json", twice}
             ])

    dir = Loka.ContentSource.copy("cartridges/shoo_sampler")
    File.rm!(Path.join(dir, "facts.json"))
    {files, _} = Loka.Content.Source.load(dir)
    refute List.keymember?(files, "facts.json", 0)
  end

  # Breaks: copies lose the authored location, so a bad ref in a zone rule reports at a copy key
  # that has no file, or once per copy.
  test "a check on a zone copy reports once at the authored rule" do
    room = &put_in(&1, ["when", "root", "items", Access.at(0), "room"], "nowhere")
    diags = refused(@codex, [{"reactions/wanderer.json", room}])
    assert [{"UNRESOLVED_REFERENCE", "reactions/wanderer.when." <> _, _}] = diags
  end

  defp heard do
    value_type = %{"type" => "int", "minimum" => 0, "maximum" => 10, "default" => 0}
    %{"version" => 1, "value_type" => value_type, "scopes" => ["player"], "meaning" => "Taken."}
  end
end
