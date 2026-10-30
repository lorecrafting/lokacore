defmodule Loka.ContentBehavioursTest do
  use ExUnit.Case, async: true

  # Source shortcut behaviours (docs/system/cartridge.md, Source shortcuts): fishing_sampler's
  # four items hold behaviours/spoils.json, one rule `take`.
  @fishing "cartridges/fishing_sampler"
  @spoils "behaviours/spoils.json"
  @trout "items/trout_01.json"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})

  defp refused(dir, changes) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    Enum.sort(pairs(diags))
  end

  defp reactions({:ok, artifact, []}), do: JSON.decode!(artifact)["cartridge"]["reactions"]

  # Breaks: a copy key other than <rule>_<holder>, a holder marker left unfilled, `behaviours`
  # left on an item, or a behaviour reaching the artifact. The literal is the artifact's sha256
  # on main at 9cf4619c4, before the four reactions/take_*.json became one behaviour, with
  # scripted_actions/ moved to actions/ and policies unwrapped (F3), and display names renamed to `name` (F6), and action outcome `sequence` renamed `steps` (F4).
  test "fishing_sampler compiles to the artifact of its hand-written take_* reactions" do
    {:ok, artifact, []} = Loka.Content.compile(@fishing)

    assert Base.encode16(:crypto.hash(:sha256, artifact), case: :lower) ==
             "a7161c9d4a201fdbbd3c53109f8cb3d89564eea76d369574e969ce14dbcffe9b"
  end

  # Breaks: a malformed list, an unknown name, a bad behaviour or a clashing copy passing
  # silently; a name listed twice reported (or copied) twice; `behaviours` accepted on a room;
  # an undecodable behaviour adding a false cause at its holders.
  test "behaviours refuse a bad holder list, an unknown name and a malformed behaviour" do
    dir = Loka.ContentSource.copy(@fishing)

    for names <- ["spoils", [1], ["Spoils!"]] do
      assert refused(dir, [{@trout, &Map.put(&1, "behaviours", names)}]) ==
               [{"SCHEMA_VIOLATION", "items/trout_01.behaviours", %{"error" => "invalid_type"}}]
    end

    assert refused(dir, [{@trout, &Map.put(&1, "behaviours", ["rots", "spoils", "rots"])}]) ==
             [
               {"UNRESOLVED_REFERENCE", "items/trout_01.behaviours[0]",
                %{"target" => "behaviours/rots"}}
             ]

    assert refused(dir, [{"rooms/bank.json", &Map.put(&1, "behaviours", ["spoils"])}]) ==
             [{"UNKNOWN_FIELD", "rooms/bank.behaviours", %{}}]

    assert refused(dir, [{@spoils, &Map.put(&1, "extra", 1)}]) ==
             [{"UNKNOWN_FIELD", "behaviours/spoils.extra", %{}}]

    # extends and abstract are refused on a behaviour, not flattened.
    for {field, v} <- [{"extends", "spoils"}, {"abstract", true}] do
      assert refused(dir, [{@spoils, &Map.put(&1, field, v)}]) ==
               [{"UNKNOWN_FIELD", "behaviours/spoils.#{field}", %{}}]
    end

    for spoils <- [%{"reactions" => []}, %{}] do
      assert refused(dir, [{@spoils, spoils}]) ==
               [{"SCHEMA_VIOLATION", "behaviours/spoils.reactions", %{"error" => "invalid_type"}}]
    end

    assert refused(dir, [{@spoils, []}]) ==
             [{"SCHEMA_VIOLATION", "behaviours/spoils", %{"error" => "invalid_type"}}]

    File.write!(Path.join(dir, @spoils), "{")
    assert {:error, diags} = Loka.Content.compile(dir)
    assert pairs(diags) == [{"INVALID_JSON", "behaviours/spoils", %{}}]
  end

  # Breaks: a copy that repeats an authored reaction kept silently, or a copy key over 64
  # characters accepted.
  test "a copy key equal to a reaction's or over 64 characters is refused" do
    dir = Loka.ContentSource.copy(@fishing)
    rule = JSON.decode!(File.read!(Path.join(dir, @spoils)))["reactions"]["take"]
    authored = rule |> put_in(["on", "item"], "trout_01") |> put_in(["apply"], [])

    assert refused(dir, [{"reactions/take_trout_01.json", authored}]) == [
             {"DUPLICATE_DEFINITION", "behaviours/spoils.reactions.take", %{}},
             {"DUPLICATE_DEFINITION", "reactions/take_trout_01", %{}}
           ]

    long = String.duplicate("t", 56)

    assert refused(dir, [{@spoils, %{"reactions" => %{long => rule}}}]) ==
             [
               {"SCHEMA_VIOLATION", "behaviours/spoils.reactions.#{long}",
                %{"error" => "too_long"}}
             ]
  end

  # Breaks: a copy reported once per holder or at a generated path; a marker with another
  # member or another name filled with the holder.
  test "a check on a copy reports once, at the behaviour rule" do
    dir = Loka.ContentSource.copy(@fishing)
    take = ["reactions", "take"]

    assert refused(dir, [{@spoils, &put_in(&1, take ++ ["apply"], [status("rotting")])}]) == [
             {"UNRESOLVED_REFERENCE", "behaviours/spoils.reactions.take.apply[0].status",
              %{"target" => "fishing_sampler@0.0.1:status/rotting"}}
           ]

    marker = %{"param" => "holder", "x" => 1}

    # The marker stays, so the item field refuses it as a DefinitionRef.
    item = "behaviours/spoils.reactions.take.on.item."
    missing = %{"error" => "missing_property"}

    assert refused(dir, [{@spoils, &put_in(&1, take ++ ["on", "item"], marker)}]) ==
             Enum.map(
               ~w(cartridge_id cartridge_version key kind),
               &{"SCHEMA_VIOLATION", item <> &1, missing}
             ) ++
               [{"UNKNOWN_FIELD", item <> "param", %{}}, {"UNKNOWN_FIELD", item <> "x", %{}}]
  end

  # Breaks: behaviours expanded before extends (the abstract parent gets the copy, the children
  # none) or a holder listed by an inherited `behaviours`.
  test "an abstract item's behaviours are copied to each concrete child" do
    dir = Loka.ContentSource.copy(@fishing)
    fish = JSON.decode!(File.read!(Path.join(dir, @trout))) |> Map.put("abstract", true)

    keys =
      Loka.ContentSource.compile(dir, [
        {"items/fish.json", fish},
        {"items/pike_01.json", %{"extends" => "fish"}},
        {"items/pike_02.json", %{"extends" => "fish"}}
      ])
      |> reactions()
      |> Map.keys()
      |> Enum.filter(&String.contains?(&1, "take_"))

    assert Enum.sort(keys) ==
             Enum.map(~w(eel_01 pike_01 pike_02 salmon_01 trout_01 trout_02), &id("take_" <> &1))
  end

  # Breaks: an NPC holder getting no copy, a bundled behaviour not opened, or the trigger naming
  # anything but its holder.
  test "a bundled behaviour gives each NPC holder a copy whose trigger names it" do
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")

    hears = %{
      "reactions" => %{
        "hears" => %{
          "on" => %{"event" => "spoken", "npc" => %{"param" => "holder"}},
          "apply" => [%{"op" => "fact.assign", "fact" => "elder_heard", "value" => true}]
        }
      }
    }

    hold = fn bundle ->
      bundle
      |> Map.put("behaviours", %{"listens" => hears})
      |> put_in(["npcs", "elder", "behaviours"], ["listens"])
      |> put_in(["npcs", "miller", "behaviours"], ["listens"])
    end

    rs = reactions(Loka.ContentSource.compile(dir, [{"areas/village.json", hold}]))
    at = &rs["speech_sampler@0.0.1:reaction/" <> &1]["on"]["npc"]
    assert at.("hears_elder") == at.("elder_hears")
    assert at.("hears_miller") == at.("miller_hears")
    refute at.("hears_elder") == at.("hears_miller")
  end

  # Breaks: a bundled behaviour's copies linted under the bundle file (one finding, or none).
  test "each copy of a bundled behaviour is linted under its own reaction address" do
    dir = Loka.ContentSource.copy(@fishing)
    spoils = File.read!(Path.join(dir, @spoils))
    File.rm!(Path.join(dir, @spoils))
    File.mkdir_p!(Path.join(dir, "areas"))
    File.write!(Path.join(dir, "areas/river.json"), ~s({"behaviours": {"spoils": #{spoils}}}))

    narrate = ~s(: writes state with no narrate step and no "silent": true)

    assert Enum.filter(Loka.Content.Lint.run(dir), &String.ends_with?(&1, narrate)) ==
             Enum.map(
               ~w(eel_01 salmon_01 trout_01 trout_02),
               &"reactions/take_#{&1}.json#{narrate}"
             )
  end

  defp status(key), do: %{"op" => "status.apply", "status" => key, "item" => "trout_01"}
  defp id(key), do: "fishing_sampler@0.0.1:reaction/" <> key
end
