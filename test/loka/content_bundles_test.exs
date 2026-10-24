defmodule Loka.ContentBundlesTest do
  use ExUnit.Case, async: true

  # speech_sampler keeps its rooms, NPCs, dialogues and reactions in one bundle.
  @bundle "areas/village.json"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})

  defp refused(changes) do
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    pairs(diags)
  end

  # Breaks: a bundle that is not an object, or a bundle member that is not a definition directory, or not an object, is dropped
  # silently; a bundled definition that repeats a plain file wins or loses without a word, or an
  # abstract repeat removes both copies before the repeat is refused (extends ran first).
  test "a bundle refuses a non-object bundle, an unknown member, a non-object member and a repeated definition" do
    assert refused([{@bundle, &Map.put(&1, "widgets", %{})}]) ==
             [{"UNKNOWN_FIELD", "areas/village.widgets", %{}}]

    assert {"SCHEMA_VIOLATION", "areas/village.npcs", %{"error" => "invalid_type"}} in refused([
             {@bundle, &Map.put(&1, "npcs", [])}
           ])

    assert {"SCHEMA_VIOLATION", "areas/village", %{"error" => "invalid_type"}} in refused([
             {@bundle, []}
           ])

    lane = fn dir -> JSON.decode!(File.read!(Path.join(dir, @bundle)))["rooms"]["lane"] end
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"rooms/lane.json", Map.put(lane.(dir), "abstract", true)}
             ])

    assert Enum.sort(pairs(diags)) == [
             {"DUPLICATE_DEFINITION", "areas/village.rooms.lane", %{}},
             {"DUPLICATE_DEFINITION", "rooms/lane", %{}}
           ]
  end

  # Breaks: a stage that pins `{rel, [], definition}` (barriers.ex hidden faces) skips a bundled
  # room, or reports it at the bundle root instead of the definition's path.
  test "a pinned stage checks a bundled room at its bundle path" do
    face = ["rooms", "lane", "exits", "east"]
    hidden = %{"fact" => "elder_heard", "equals" => true}

    diags =
      refused([
        {@bundle, &put_in(&1, face ++ ["hidden_until"], hidden)},
        {@bundle, &put_in(&1, face ++ ["barrier"], "gate")}
      ])

    assert {"BARRIER_MISMATCH", "areas/village.rooms.lane.exits.east.hidden_until", %{}} in diags
  end

  # Breaks: an `extends` refusal on a bundled definition names the bundle file's directory
  # (`areas/ghost`) instead of the definition's kind directory.
  test "an unresolved extends in a bundle names the target in the definition's directory" do
    assert {"UNRESOLVED_REFERENCE", "areas/village.npcs.elder.extends",
            %{"target" => "npcs/ghost"}} in refused([
             {@bundle, &put_in(&1, ["npcs", "elder", "extends"], "ghost")}
           ])
  end

  # Breaks: lint keys a bundled definition by its file, so a check that dispatches on the
  # directory (check 3: reactions narrate or are silent) never sees it.
  test "lint reads a bundled reaction as its definition address" do
    assert ~s(reactions/elder_hears.json: writes state with no narrate step and no "silent": true) in Loka.Content.Lint.run(
             "cartridges/speech_sampler"
           )
  end
end
