defmodule Loka.ContentRaidTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 37a; twin of the loader test in kernel/ts/test/raid.test.ts):
  # the step's plan is never resolved.
  test "the raid step's plan resolves" do
    dir = Loka.ContentSource.copy("cartridges/raid_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    plan = &put_in(&1, ["apply", Access.at(0), "plan"], "nowhere")

    for {edits, expected} <- [
          {[{"reactions/raid.json", plan}],
           {"UNRESOLVED_REFERENCE", "reactions/raid.apply[0].plan"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row FD1; twin of the loader test in kernel/ts/test/raid.test.ts): a delayed
  # rule keeps a step that reads its
  # event (RS-4: a quest step) or a `when` leaf that reads its subject; a stamp or time_since
  # names a fact that cannot hold every clock value.
  test "after, fact.stamp and time_since keep an unbounded int fact" do
    dir = Loka.ContentSource.copy("cartridges/raid_sampler")
    since = %{"op" => "time_since", "fact" => "raided_at", "at_least" => 600}
    move = %{"op" => "item.move", "room" => "village"}
    npc_move = %{"op" => "npc.move"}
    shake = %{"op" => "status.apply", "status" => "shaken", "co_present" => true}

    mv = %{
      "op" => "resource_compare",
      "resource" => "mv",
      "at_least" => 1,
      "subject" => "subject"
    }

    mv = %{"op" => "not", "item" => mv}

    for {edits, expected} <- [
          {[{"reactions/aftershock.json", &update_in(&1, ["apply"], fn a -> a ++ [move] end)}],
           {"SCHEMA_VIOLATION", "reactions/aftershock.apply[1].op"}},
          {[
             {"reactions/aftershock.json", &update_in(&1, ["apply"], fn a -> a ++ [npc_move] end)}
           ], {"SCHEMA_VIOLATION", "reactions/aftershock.apply[1].op"}},
          {[{"reactions/raid.json", &put_in(&1, ["apply", Access.at(2), "fact"], "aftershocks")}],
           {"SCHEMA_VIOLATION", "reactions/raid.apply[2].fact"}},
          {[{"facts.json", &put_in(&1, ["facts", "raided_at", "value_type", "minimum"], 1)}],
           {"SCHEMA_VIOLATION", "reactions/raid.apply[2].fact"}},
          {[{"reactions/aftershock.json", &update_in(&1, ["apply"], fn a -> a ++ [shake] end)}],
           {"SCHEMA_VIOLATION", "reactions/aftershock.apply[1].op"}},
          {[
             {"reactions/calm.json", &put_in(&1, ["when", "root"], %{since | "fact" => "raided"})}
           ], {"SCHEMA_VIOLATION", "reactions/calm.when.root.fact"}},
          {[{"reactions/aftershock.json", &put_in(&1, ["when", "root"], mv)}],
           {"SCHEMA_VIOLATION", "reactions/aftershock.when.root.item.subject"}},
          # RS-4: the fired job keeps its actor, not the subject or trigger its quest steps read.
          {[{"reactions/called_to_hold.json", &Map.put(&1, "after", 100)}],
           {"SCHEMA_VIOLATION", "reactions/called_to_hold.apply[0].op"}},
          {[{"reactions/gate_held.json", &Map.put(&1, "after", 100)}],
           {"SCHEMA_VIOLATION", "reactions/gate_held.apply[0].op"}},
          {[{"reactions/defender_fell.json", &Map.put(&1, "after", 100)}],
           {"SCHEMA_VIOLATION", "reactions/defender_fell.apply[0].op"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
