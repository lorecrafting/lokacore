defmodule Loka.ContentD9Test do
  use ExUnit.Case, async: true
  alias Loka.ContentSource
  setup_all do: %{dir: ContentSource.copy("cartridges/toolbox_showcase")}

  # Showcase plus an inline bell: Ring on a Drill Yard detail sets bell_rung, cued in Goblin Pit
  # and Drill Yard, and suppresses the goblins (the only pack plan) for two days.
  defp bell do
    [
      {"facts.json",
       &put_in(&1, ["facts", "bell_rung"], %{
         "version" => 1,
         "value_type" => %{"type" => "bool", "default" => false},
         "scopes" => ["player"],
         "meaning" => "The player rang the yard bell."
       })},
      {"rooms/drill_yard.json",
       &put_in(&1, ["details", "bell"], %{"aliases" => ["bell"], "description" => "detail.bell"})},
      {"actions/ring_bell.json",
       %{
         "name" => "actions.ring_bell",
         "aliases" => ["ring"],
         "target" => %{"kind" => "detail", "room" => "drill_yard", "detail" => "bell"},
         "priority" => 10,
         "policy" => %{"op" => "all", "items" => []},
         "outcomes" => %{
           "success" => %{
             "sequence" => [%{"op" => "fact.assign", "fact" => "bell_rung", "value" => true}],
             "narration" => %{"actor" => "narration.ring_bell"}
           }
         }
       }},
      {"reactions/bell_suppress_goblins.json",
       %{
         "on" => %{"event" => "fact_changed", "fact" => "bell_rung"},
         "apply" => [%{"op" => "population.suppress", "plan" => "goblins", "duration" => 172_800}]
       }},
      {"cartridge.json",
       &put_in(&1, ["world", "bell_cue"], %{
         "fact" => "bell_rung",
         "rooms" => ["goblin_pit", "drill_yard"],
         "text" => "narration.bell_cue"
       })},
      {"text.json",
       &Map.merge(&1, %{
         "detail.bell" => "A bell on a post.",
         "actions.ring_bell" => "Ring",
         "narration.ring_bell" => "You ring the bell.",
         "narration.bell_cue" => "The bell carries over the yard."
       })}
    ]
  end

  # Breaks: D9 compiles a cue with a non-boolean or unresolved source, or a suppression of a
  # non-pack plan or on a non-boolean fact.
  test "D9 source declarations reject unusable cue and suppression contracts", %{dir: dir} do
    assert {:ok, _, _warnings} = ContentSource.compile(dir, bell())
    reaction = "reactions/bell_suppress_goblins"

    for {file, change, code, path} <- [
          {"cartridge.json", &put_in(&1, ["world", "bell_cue", "fact"], "lever_stage"),
           "FACT_TYPE_MISMATCH", "cartridge.world.bell_cue.value"},
          {"cartridge.json",
           &update_in(&1, ["world", "bell_cue", "rooms"], fn r -> r ++ ["absent"] end),
           "UNRESOLVED_REFERENCE", "cartridge.world.bell_cue.rooms[2]"},
          {"cartridge.json", &put_in(&1, ["world", "bell_cue", "fact"], "absent"),
           "UNRESOLVED_REFERENCE", "cartridge.world.bell_cue.fact"},
          {"cartridge.json", &put_in(&1, ["world", "bell_cue", "text"], "narration.absent"),
           "UNRESOLVED_REFERENCE", "cartridge.world.bell_cue.text"},
          {"#{reaction}.json", &put_in(&1, ["apply", Access.at(0), "plan"], "hens"),
           "SCHEMA_VIOLATION", "#{reaction}.apply[0].plan"},
          {"#{reaction}.json", &put_in(&1, ["on", "fact"], "lever_stage"), "FACT_TYPE_MISMATCH",
           "#{reaction}.on.value"},
          {"#{reaction}.json",
           &put_in(&1, ["on"], %{"event" => "entity_entered_room", "room" => "drill_yard"}),
           "OUTCOME_MISMATCH", "#{reaction}.apply[0].op"}
        ] do
      assert {:error, diags} = ContentSource.compile(dir, bell() ++ [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
