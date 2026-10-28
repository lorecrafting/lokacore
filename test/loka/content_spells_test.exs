defmodule Loka.ContentSpellsTest do
  use ExUnit.Case, async: true

  @dir "cartridges/spells_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row 29a): the compiler accepts an opposed check on a spell (no detail rating), two spells sharing one word,
  # or a room contribution naming a spell's key (the TS loader refuses them too; spells.test.ts).
  test "spell words are unique" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    # An opposed check on a spell: no detail rating, and no npc named.
    opposed = [
      {"cartridge.json", &put_in(&1, ["requires", "capabilities", "check"], 1)},
      {"actions/ward.json",
       &(&1
         |> Map.put("check", %{"key" => "w", "kind" => "opposed", "attribute" => "wis"})
         |> put_in(["outcomes", "failure"], &1["outcomes"]["success"]))}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, opposed)
    assert {"SCHEMA_VIOLATION", "actions/ward.check"} in pairs(diags), inspect(diags)

    same = [{"actions/noctis.json", &put_in(&1, ["target", "word"], "lux")}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, same)

    assert Enum.sort(pairs(diags)) == [
             {"DUPLICATE_DEFINITION", "actions/lux.target.word"},
             {"DUPLICATE_DEFINITION", "actions/noctis.target.word"}
           ]

    # A spell is cast by word, never by key: a room contribution naming one is unresolved.
    room = [
      {"rooms/tower.json", &Map.put(&1, "actions", [%{"op" => "union", "actions" => ["lux"]}])}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, room)
    assert pairs(diags) == [{"UNRESOLVED_REFERENCE", "rooms/tower.actions[0].actions[0]"}]
  end

  # Breaks (word bar S2): the compiler accepts a spell with no learned fact, one naming a fact this
  # cartridge lacks, a non-bool one, an instance or per_subject one (the TS loader refuses them too;
  # spells.test.ts).
  test "a spell's learned names a bool player fact of this cartridge" do
    dir = Loka.ContentSource.copy(@dir)
    learned = &{"actions/ward.json", fn r -> update_in(r, ["target"], &1) end}

    fact = fn key, spec ->
      [
        learned.(&Map.put(&1, "learned", key)),
        {"facts.json",
         &put_in(&1, ["facts", key], Map.merge(%{"version" => 1, "meaning" => "A fact."}, spec))}
      ]
    end

    bool = %{"value_type" => %{"type" => "bool", "default" => false}}

    for {edits, expected} <- [
          {[learned.(&Map.delete(&1, "learned"))],
           {"SCHEMA_VIOLATION", "actions/ward.target.learned"}},
          {[learned.(&Map.put(&1, "learned", "nope"))],
           {"UNRESOLVED_REFERENCE", "actions/ward.target.learned"}},
          {fact.("count", %{
             "value_type" => %{"type" => "int", "default" => 0},
             "scopes" => ["player"]
           }), {"FACT_TYPE_MISMATCH", "actions/ward.target.learned"}},
          {fact.("world", Map.put(bool, "scopes", ["instance"])),
           {"FACT_SCOPE_UNSUPPORTED", "actions/ward.target.learned"}},
          {fact.("pair", Map.merge(bool, %{"scopes" => ["player"], "per_subject" => true})),
           {"FACT_SCOPE_UNSUPPORTED", "actions/ward.target.learned"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == [expected]
    end
  end

  # Breaks: the recipe reason check dropped, or 1.100 read as a string (below 1.99).
  test "a recipe reason names a text key; 1.100 is above 1.99" do
    dir = Loka.ContentSource.copy(@dir)
    api = &{"cartridge.json", fn m -> put_in(m, ["requires", "kernel_api"], &1) end}
    reason = &{"actions/ward.json", &1}
    at_199 = api.(%{"at_least" => "1.99", "below" => "1.100"})

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [reason.(&Map.put(&1, "reason", "reason.nope"))])

    assert pairs(diags) == [{"UNRESOLVED_REFERENCE", "actions/ward.reason"}]

    assert {:ok, _, []} =
             Loka.ContentSource.compile(dir, [at_199, reason.(&Map.delete(&1, "reason"))])
  end
end
